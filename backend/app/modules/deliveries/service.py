from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import (
    ActivityType,
    CourierStatus,
    DeliveryMethod,
    DeliveryStatus,
    PointLedgerReason,
    RoleInTransaction,
    TransactionStatus,
)
from app.models.erd import ActivityLog, CourierProfile, Delivery, Transaction, User
from app.modules.deliveries.schemas import DeliveryAcceptRequest
from app.modules.points.service import add_point_change
from app.modules.transactions.service import (
    cancel_delivery_transaction,
    complete_transaction_if_ready,
)

DELIVERY_REWARD_POINTS = 2


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


def list_available_delivery_tasks(db: Session, current_user: User) -> list[Transaction]:
    _get_current_courier(db, current_user)
    assigned_transaction_ids = select(Delivery.transaction_id)
    statement = (
        select(Transaction)
        .where(
            Transaction.delivery_method == DeliveryMethod.FREE_COURIER,
            Transaction.transaction_status == TransactionStatus.DELIVERING,
            Transaction.transaction_id.not_in(assigned_transaction_ids),
        )
        .order_by(Transaction.requested_at)
    )
    return list(db.scalars(statement))


def list_my_deliveries(db: Session, current_user: User) -> list[Delivery]:
    courier = _get_current_courier(db, current_user)
    statement = (
        select(Delivery)
        .where(Delivery.courier_id == courier.courier_id)
        .order_by(Delivery.assigned_at.desc(), Delivery.delivery_id.desc())
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
    ):
        raise DeliveryTaskNotFoundError

    existing_delivery = db.scalar(
        select(Delivery.delivery_id).where(Delivery.transaction_id == transaction.transaction_id)
    )
    if existing_delivery is not None:
        raise InvalidDeliveryStateError

    now = datetime.now(UTC)
    delivery = Delivery(
        transaction_id=transaction.transaction_id,
        courier_id=courier.courier_id,
        pickup_address=payload.pickup_address,
        receiver_address=payload.receiver_address,
        delivery_status=DeliveryStatus.ASSIGNED,
        assigned_at=now,
    )
    courier.courier_status = CourierStatus.BUSY
    db.add(delivery)
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
