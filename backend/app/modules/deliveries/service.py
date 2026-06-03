from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.delivery_area import is_courier_area_compatible
from app.models.enums import (
    ActivityType,
    CourierStatus,
    DeliveryMethod,
    DeliveryStatus,
    PointLedgerReason,
    RoleInTransaction,
    TransactionStatus,
    TransactionType,
)
from app.models.erd import ActivityLog, CourierProfile, Delivery, Transaction, User
from app.modules.deliveries.schemas import DeliveryAcceptRequest
from app.modules.points.service import add_point_change
from app.modules.transactions.service import (
    cancel_delivery_transaction,
    complete_transaction_if_ready,
)

DELIVERY_REWARD_POINTS = 2
MAX_EXPECTED_DELIVERY_DAYS = 3


class CourierProfileRequiredError(Exception):
    pass


class CourierUnavailableError(Exception):
    pass


class DeliveryTaskNotFoundError(Exception):
    pass


class DeliveryNotFoundError(Exception):
    pass


class ForbiddenDeliveryActionError(Exception):
    pass


class InvalidDeliveryStateError(Exception):
    pass


class InvalidDeliveryScheduleError(Exception):
    pass


def list_available_delivery_tasks(db: Session, current_user: User) -> list[Transaction]:
    courier = _get_current_courier(db, current_user)
    if courier.courier_status != CourierStatus.AVAILABLE:
        raise CourierUnavailableError
    statement = (
        select(Transaction)
        .join(Delivery, Delivery.transaction_id == Transaction.transaction_id)
        .where(
            Transaction.delivery_method == DeliveryMethod.FREE_COURIER,
            Transaction.transaction_status == TransactionStatus.DELIVERING,
            Delivery.delivery_status == DeliveryStatus.PENDING,
            Delivery.courier_id.is_(None),
            Delivery.pickup_address.is_not(None),
            Delivery.receiver_address.is_not(None),
        )
        .order_by(Transaction.requested_at)
    )
    return [
        transaction
        for transaction in db.scalars(statement)
        if _is_ready_for_courier_assignment(transaction)
        and _courier_can_handle_transaction(db, courier, transaction)
    ]


def list_my_deliveries(db: Session, current_user: User) -> list[Delivery]:
    courier = _get_current_courier(db, current_user)
    statement = (
        select(Delivery)
        .where(Delivery.courier_id == courier.courier_id)
        .order_by(Delivery.assigned_at.desc(), Delivery.delivery_id.desc())
    )
    return list(db.scalars(statement))


def list_user_deliveries(db: Session, user_id: int) -> list[Delivery]:
    courier = db.scalar(select(CourierProfile).where(CourierProfile.user_id == user_id))
    if courier is None:
        return []
    statement = (
        select(Delivery)
        .where(Delivery.courier_id == courier.courier_id)
        .order_by(Delivery.delivered_at.desc(), Delivery.assigned_at.desc(), Delivery.delivery_id.desc())
    )
    return list(db.scalars(statement))


def accept_delivery_task(
    db: Session,
    current_user: User,
    transaction_id: int,
    payload: DeliveryAcceptRequest,
) -> Delivery:
    courier = _get_current_courier(db, current_user, for_update=True)
    if courier.courier_status != CourierStatus.AVAILABLE:
        raise CourierUnavailableError

    transaction = db.scalar(
        select(Transaction)
        .where(Transaction.transaction_id == transaction_id)
        .with_for_update()
    )
    if (
        transaction is None
        or transaction.delivery_method != DeliveryMethod.FREE_COURIER
        or transaction.transaction_status != TransactionStatus.DELIVERING
        or not _is_ready_for_courier_assignment(transaction)
        or not _courier_can_handle_transaction(db, courier, transaction)
    ):
        raise DeliveryTaskNotFoundError

    delivery = db.scalar(
        select(Delivery)
        .where(
            Delivery.transaction_id == transaction.transaction_id,
            Delivery.delivery_status == DeliveryStatus.PENDING,
            Delivery.courier_id.is_(None),
            Delivery.pickup_address.is_not(None),
        )
        .with_for_update()
    )
    if delivery is None:
        raise InvalidDeliveryStateError

    now = datetime.now(UTC)
    _validate_expected_delivery_at(payload.expected_delivery_at, now)
    delivery.courier_id = courier.courier_id
    delivery.delivery_status = DeliveryStatus.ASSIGNED
    delivery.assigned_at = now
    delivery.expected_delivery_at = payload.expected_delivery_at
    courier.courier_status = CourierStatus.BUSY
    db.flush()
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.DELIVERY_UPDATE,
            activity_description=f"Accepted delivery #{delivery.delivery_id}.",
        )
    )
    db.commit()
    db.refresh(delivery)
    return delivery


def mark_delivery_picked_up(db: Session, current_user: User, delivery_id: int) -> Delivery:
    delivery, _ = _get_owned_delivery(db, current_user, delivery_id)
    if delivery.delivery_status != DeliveryStatus.ASSIGNED:
        raise InvalidDeliveryStateError

    delivery.delivery_status = DeliveryStatus.PICKED_UP
    delivery.picked_up_at = datetime.now(UTC)
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.DELIVERY_UPDATE,
            activity_description=f"Picked up delivery #{delivery.delivery_id}.",
        )
    )
    db.commit()
    db.refresh(delivery)
    return delivery


def mark_delivery_delivered(db: Session, current_user: User, delivery_id: int) -> Delivery:
    delivery, courier = _get_owned_delivery(db, current_user, delivery_id)
    if delivery.delivery_status != DeliveryStatus.PICKED_UP:
        raise InvalidDeliveryStateError

    transaction = _get_transaction_for_delivery(db, delivery)
    user = db.scalar(select(User).where(User.user_id == current_user.user_id).with_for_update())
    if user is None:
        raise CourierProfileRequiredError

    delivery.delivery_status = DeliveryStatus.DELIVERED
    delivery.delivered_at = datetime.now(UTC)
    courier.courier_status = CourierStatus.AVAILABLE
    courier.successful_delivery_count += 1
    transaction.courier_confirmed = True
    add_point_change(
        db,
        user=user,
        transaction_id=transaction.transaction_id,
        role_in_transaction=RoleInTransaction.COURIER,
        point_change=DELIVERY_REWARD_POINTS,
        reason=PointLedgerReason.DELIVERY_REWARD,
    )
    complete_transaction_if_ready(db, transaction)
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.DELIVERY_UPDATE,
            activity_description=f"Delivered delivery #{delivery.delivery_id}.",
        )
    )
    db.commit()
    db.refresh(delivery)
    return delivery


def mark_delivery_failed(db: Session, current_user: User, delivery_id: int) -> Delivery:
    delivery, courier = _get_owned_delivery(db, current_user, delivery_id)
    if delivery.delivery_status not in {DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP}:
        raise InvalidDeliveryStateError

    transaction = _get_transaction_for_delivery(db, delivery)
    delivery.delivery_status = DeliveryStatus.FAILED
    courier.courier_status = CourierStatus.AVAILABLE
    cancel_delivery_transaction(db, transaction)
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.DELIVERY_UPDATE,
            activity_description=f"Failed delivery #{delivery.delivery_id}.",
        )
    )
    db.commit()
    db.refresh(delivery)
    return delivery


def _get_current_courier(
    db: Session,
    current_user: User,
    *,
    for_update: bool = False,
) -> CourierProfile:
    statement = select(CourierProfile).where(CourierProfile.user_id == current_user.user_id)
    if for_update:
        statement = statement.with_for_update()
    courier = db.scalar(statement)
    if courier is None:
        raise CourierProfileRequiredError
    return courier


def _get_owned_delivery(
    db: Session,
    current_user: User,
    delivery_id: int,
) -> tuple[Delivery, CourierProfile]:
    courier = _get_current_courier(db, current_user, for_update=True)
    delivery = db.scalar(
        select(Delivery).where(Delivery.delivery_id == delivery_id).with_for_update()
    )
    if delivery is None:
        raise DeliveryNotFoundError
    if delivery.courier_id != courier.courier_id:
        raise ForbiddenDeliveryActionError
    return delivery, courier


def _get_transaction_for_delivery(db: Session, delivery: Delivery) -> Transaction:
    transaction = db.scalar(
        select(Transaction)
        .where(Transaction.transaction_id == delivery.transaction_id)
        .with_for_update()
    )
    if transaction is None:
        raise DeliveryTaskNotFoundError
    return transaction


def _is_ready_for_courier_assignment(transaction: Transaction) -> bool:
    if transaction.transaction_type == TransactionType.PERMANENT_EXCHANGE:
        return transaction.owner_confirmed and transaction.requester_confirmed
    if transaction.transaction_type == TransactionType.BORROW_RETURN:
        return True
    return False


def _courier_can_handle_transaction(
    db: Session,
    courier: CourierProfile,
    transaction: Transaction,
) -> bool:
    delivery = db.scalar(
        select(Delivery).where(Delivery.transaction_id == transaction.transaction_id)
    )
    if delivery is None:
        return False
    return is_courier_area_compatible(
        courier.delivery_area,
        delivery.pickup_address,
        delivery.pickup_lat,
        delivery.pickup_lng,
        delivery.receiver_address,
        delivery.receiver_lat,
        delivery.receiver_lng,
    )


def _validate_expected_delivery_at(expected_delivery_at: datetime | None, now: datetime) -> None:
    if expected_delivery_at is None:
        return
    expected = _as_utc(expected_delivery_at)
    if expected < now or expected > now + timedelta(days=MAX_EXPECTED_DELIVERY_DAYS):
        raise InvalidDeliveryScheduleError


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
