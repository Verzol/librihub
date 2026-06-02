from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.delivery_area import is_within_free_courier_area
from app.models.enums import (
    ActivityType,
    BookStatus,
    DeliveryMethod,
    DeliveryStatus,
    ExchangeMode,
    PointLedgerReason,
    RoleInTransaction,
    TransactionStatus,
    TransactionType,
)
from app.models.erd import ActivityLog, Book, Delivery, Transaction, User
from app.modules.points.service import InsufficientPointsError, add_point_change
from app.modules.transactions.schemas import TransactionAcceptRequest, TransactionCreateRequest

OWNER_EXCHANGE_POINTS = 10
REQUESTER_EXCHANGE_POINTS = -10
OWNER_BORROW_POINTS = 5
REQUESTER_BORROW_POINTS = -5
LATE_RETURN_PENALTY_PER_DAY = 2


class TransactionNotFoundError(Exception):
    pass


class BookNotAvailableError(Exception):
    pass


class InvalidTransactionRequestError(Exception):
    pass


class ForbiddenTransactionActionError(Exception):
    pass


class InvalidTransactionStateError(Exception):
    pass


class DeliveryAreaNotSupportedError(Exception):
    pass


def list_my_transactions(
    db: Session,
    current_user: User,
    *,
    role: str | None = None,
) -> list[Transaction]:
    statement = (
        select(Transaction)
        .options(
            selectinload(Transaction.book),
            selectinload(Transaction.owner),
            selectinload(Transaction.requester),
        )
        .order_by(Transaction.requested_at.desc())
    )
    if role == "owner":
        statement = statement.where(Transaction.owner_id == current_user.user_id)
    elif role == "requester":
        statement = statement.where(Transaction.requester_id == current_user.user_id)
    else:
        statement = statement.where(
            (Transaction.owner_id == current_user.user_id)
            | (Transaction.requester_id == current_user.user_id)
        )
    return list(db.scalars(statement))


def create_transaction(
    db: Session,
    current_user: User,
    payload: TransactionCreateRequest,
) -> Transaction:
    book = db.scalar(select(Book).where(Book.book_id == payload.book_id).with_for_update())
    if book is None or book.book_status == BookStatus.REMOVED:
        raise BookNotAvailableError
    if book.owner_id == current_user.user_id:
        raise InvalidTransactionRequestError
    if book.book_status != BookStatus.AVAILABLE:
        raise BookNotAvailableError
    if not _book_allows_transaction_type(book, payload.transaction_type):
        raise InvalidTransactionRequestError

    existing_active = db.scalar(
        select(Transaction.transaction_id).where(
            Transaction.book_id == book.book_id,
            Transaction.transaction_status.in_(
                [
                    TransactionStatus.PENDING,
                    TransactionStatus.ACCEPTED,
                    TransactionStatus.DELIVERING,
                ]
            ),
        )
    )
    if existing_active is not None:
        raise BookNotAvailableError
    if payload.delivery_method == DeliveryMethod.FREE_COURIER and not is_within_free_courier_area(
        payload.receiver_lat or 0,
        payload.receiver_lng or 0,
    ):
        raise DeliveryAreaNotSupportedError

    transaction = Transaction(
        book_id=book.book_id,
        owner_id=book.owner_id,
        requester_id=current_user.user_id,
        transaction_type=payload.transaction_type,
        delivery_method=payload.delivery_method,
        borrow_duration_days=payload.borrow_duration_days,
        transaction_status=TransactionStatus.PENDING,
    )
    book.book_status = BookStatus.PENDING_TRANSACTION
    db.add(transaction)
    db.flush()
    if payload.delivery_method == DeliveryMethod.FREE_COURIER:
        db.add(
            Delivery(
                transaction_id=transaction.transaction_id,
                courier_id=None,
                pickup_address=None,
                receiver_address=payload.receiver_address or "",
                delivery_status=DeliveryStatus.PENDING,
                receiver_lat=payload.receiver_lat,
                receiver_lng=payload.receiver_lng,
            )
        )
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.CREATE_TRANSACTION,
            activity_description=f"Created transaction request #{transaction.transaction_id}.",
        )
    )
    db.commit()
    db.refresh(transaction)
    return transaction


def accept_transaction(
    db: Session,
    current_user: User,
    transaction_id: int,
    payload: TransactionAcceptRequest | None = None,
) -> Transaction:
    transaction = _get_transaction_for_update(db, transaction_id)
    if transaction.owner_id != current_user.user_id:
        raise ForbiddenTransactionActionError
    if transaction.transaction_status != TransactionStatus.PENDING:
        raise InvalidTransactionStateError

    if transaction.delivery_method == DeliveryMethod.FREE_COURIER:
        if payload is None or payload.pickup_address is None or payload.pickup_lat is None or payload.pickup_lng is None:
            raise InvalidTransactionRequestError
        if not is_within_free_courier_area(payload.pickup_lat, payload.pickup_lng):
            raise DeliveryAreaNotSupportedError
        delivery = db.scalar(
            select(Delivery)
            .where(Delivery.transaction_id == transaction.transaction_id)
            .with_for_update()
        )
        if delivery is None:
            raise InvalidTransactionStateError
        delivery.pickup_address = payload.pickup_address
        delivery.pickup_lat = payload.pickup_lat
        delivery.pickup_lng = payload.pickup_lng
        transaction.transaction_status = TransactionStatus.DELIVERING
    else:
        transaction.transaction_status = TransactionStatus.ACCEPTED
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.CREATE_TRANSACTION,
            activity_description=f"Accepted transaction #{transaction.transaction_id}.",
        )
    )
    db.commit()
    db.refresh(transaction)
    return transaction


def reject_transaction(db: Session, current_user: User, transaction_id: int) -> Transaction:
    transaction = _get_transaction_for_update(db, transaction_id)
    if transaction.owner_id != current_user.user_id:
        raise ForbiddenTransactionActionError
    if transaction.transaction_status != TransactionStatus.PENDING:
        raise InvalidTransactionStateError

    transaction.transaction_status = TransactionStatus.REJECTED
    _cancel_delivery_if_present(db, transaction)
    _release_book(db, transaction)
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.CREATE_TRANSACTION,
            activity_description=f"Rejected transaction #{transaction.transaction_id}.",
        )
    )
    db.commit()
    db.refresh(transaction)
    return transaction


def cancel_transaction(db: Session, current_user: User, transaction_id: int) -> Transaction:
    transaction = _get_transaction_for_update(db, transaction_id)
    if current_user.user_id not in {transaction.owner_id, transaction.requester_id}:
        raise ForbiddenTransactionActionError
    if transaction.transaction_status not in {TransactionStatus.PENDING, TransactionStatus.ACCEPTED}:
        raise InvalidTransactionStateError

    transaction.transaction_status = TransactionStatus.CANCELLED
    _cancel_delivery_if_present(db, transaction)
    _release_book(db, transaction)
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.CREATE_TRANSACTION,
            activity_description=f"Cancelled transaction #{transaction.transaction_id}.",
        )
    )
    db.commit()
    db.refresh(transaction)
    return transaction


def confirm_transaction(db: Session, current_user: User, transaction_id: int) -> Transaction:
    transaction = _get_transaction_for_update(db, transaction_id)
    if transaction.transaction_type == TransactionType.BORROW_RETURN:
        raise InvalidTransactionStateError
    if current_user.user_id == transaction.owner_id:
        transaction.owner_confirmed = True
    elif current_user.user_id == transaction.requester_id:
        transaction.requester_confirmed = True
    else:
        raise ForbiddenTransactionActionError

    if transaction.transaction_status not in {TransactionStatus.ACCEPTED, TransactionStatus.DELIVERING}:
        raise InvalidTransactionStateError

    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.CONFIRM_TRANSACTION,
            activity_description=f"Confirmed transaction #{transaction.transaction_id}.",
        )
    )
    try:
        if _has_required_confirmations(transaction):
            _complete_transaction(db, transaction)
        db.commit()
    except InsufficientPointsError:
        db.rollback()
        raise
    db.refresh(transaction)
    return transaction


def confirm_borrow_receipt(db: Session, current_user: User, transaction_id: int) -> Transaction:
    transaction = _get_transaction_for_update(db, transaction_id)
    if transaction.requester_id != current_user.user_id:
        raise ForbiddenTransactionActionError
    if transaction.transaction_type != TransactionType.BORROW_RETURN:
        raise InvalidTransactionStateError
    if transaction.transaction_status == TransactionStatus.ACCEPTED:
        pass
    elif (
        transaction.transaction_status == TransactionStatus.DELIVERING
        and transaction.delivery_method == DeliveryMethod.FREE_COURIER
        and transaction.courier_confirmed
    ):
        pass
    else:
        raise InvalidTransactionStateError
    if transaction.borrow_duration_days is None:
        raise InvalidTransactionStateError

    now = datetime.now(UTC)
    transaction.requester_confirmed = True
    transaction.borrowed_at = now
    transaction.expected_return_at = now + timedelta(days=transaction.borrow_duration_days)
    transaction.transaction_status = TransactionStatus.BORROWING
    _set_book_status(db, transaction, BookStatus.BORROWED)
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.CONFIRM_TRANSACTION,
            activity_description=f"Confirmed receipt for borrow transaction #{transaction.transaction_id}.",
        )
    )
    db.commit()
    db.refresh(transaction)
    return transaction


def request_borrow_return(db: Session, current_user: User, transaction_id: int) -> Transaction:
    transaction = _get_transaction_for_update(db, transaction_id)
    if transaction.requester_id != current_user.user_id:
        raise ForbiddenTransactionActionError
    if (
        transaction.transaction_type != TransactionType.BORROW_RETURN
        or transaction.transaction_status != TransactionStatus.BORROWING
    ):
        raise InvalidTransactionStateError

    transaction.return_requested_at = datetime.now(UTC)
    transaction.transaction_status = TransactionStatus.RETURN_PENDING
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.CONFIRM_TRANSACTION,
            activity_description=f"Requested return confirmation for transaction #{transaction.transaction_id}.",
        )
    )
    db.commit()
    db.refresh(transaction)
    return transaction


def confirm_borrow_return(db: Session, current_user: User, transaction_id: int) -> Transaction:
    transaction = _get_transaction_for_update(db, transaction_id)
    if transaction.owner_id != current_user.user_id:
        raise ForbiddenTransactionActionError
    if (
        transaction.transaction_type != TransactionType.BORROW_RETURN
        or transaction.transaction_status != TransactionStatus.RETURN_PENDING
    ):
        raise InvalidTransactionStateError

    now = datetime.now(UTC)
    requester = db.scalar(
        select(User).where(User.user_id == transaction.requester_id).with_for_update()
    )
    owner = db.scalar(select(User).where(User.user_id == transaction.owner_id).with_for_update())
    if requester is None or owner is None:
        raise TransactionNotFoundError

    late_days = _calculate_late_days(transaction.expected_return_at, now)
    late_fee_points = late_days * LATE_RETURN_PENALTY_PER_DAY
    transaction.returned_at = now
    transaction.owner_confirmed = True
    transaction.late_days = late_days
    transaction.late_fee_points = late_fee_points
    try:
        add_point_change(
            db,
            user=requester,
            transaction_id=transaction.transaction_id,
            role_in_transaction=RoleInTransaction.REQUESTER,
            point_change=REQUESTER_BORROW_POINTS,
            reason=PointLedgerReason.BORROW_COST,
        )
        add_point_change(
            db,
            user=owner,
            transaction_id=transaction.transaction_id,
            role_in_transaction=RoleInTransaction.OWNER,
            point_change=OWNER_BORROW_POINTS,
            reason=PointLedgerReason.BORROW_REWARD,
        )
        if late_fee_points:
            add_point_change(
                db,
                user=requester,
                transaction_id=transaction.transaction_id,
                role_in_transaction=RoleInTransaction.REQUESTER,
                point_change=-late_fee_points,
                reason=PointLedgerReason.LATE_RETURN_PENALTY,
            )
        transaction.transaction_status = TransactionStatus.COMPLETED
        transaction.completed_at = now
        _set_book_status(db, transaction, BookStatus.UNLISTED)
        db.add(
            ActivityLog(
                user_id=current_user.user_id,
                activity_type=ActivityType.CONFIRM_TRANSACTION,
                activity_description=f"Confirmed returned book for transaction #{transaction.transaction_id}.",
            )
        )
        db.commit()
    except InsufficientPointsError:
        db.rollback()
        raise
    db.refresh(transaction)
    return transaction


def complete_transaction_if_ready(db: Session, transaction: Transaction) -> bool:
    if transaction.transaction_type == TransactionType.BORROW_RETURN:
        return False
    if transaction.transaction_status not in {TransactionStatus.ACCEPTED, TransactionStatus.DELIVERING}:
        return False
    if not _has_required_confirmations(transaction):
        return False
    _complete_transaction(db, transaction)
    return True


def cancel_delivery_transaction(db: Session, transaction: Transaction) -> None:
    if transaction.transaction_status != TransactionStatus.COMPLETED:
        transaction.transaction_status = TransactionStatus.CANCELLED
        _cancel_delivery_if_present(db, transaction)
        _release_book(db, transaction)


def _book_allows_transaction_type(book: Book, transaction_type: TransactionType) -> bool:
    if book.exchange_mode == ExchangeMode.BOTH:
        return True
    return book.exchange_mode.value == transaction_type.value


def _get_transaction_for_update(db: Session, transaction_id: int) -> Transaction:
    transaction = db.scalar(
        select(Transaction)
        .where(Transaction.transaction_id == transaction_id)
        .with_for_update()
    )
    if transaction is None:
        raise TransactionNotFoundError
    return transaction


def _has_required_confirmations(transaction: Transaction) -> bool:
    if transaction.delivery_method == DeliveryMethod.FREE_COURIER:
        return (
            transaction.owner_confirmed
            and transaction.requester_confirmed
            and transaction.courier_confirmed
        )
    return transaction.owner_confirmed and transaction.requester_confirmed


def _complete_transaction(db: Session, transaction: Transaction) -> None:
    owner = db.scalar(select(User).where(User.user_id == transaction.owner_id).with_for_update())
    requester = db.scalar(
        select(User).where(User.user_id == transaction.requester_id).with_for_update()
    )
    book = db.scalar(select(Book).where(Book.book_id == transaction.book_id).with_for_update())
    if owner is None or requester is None or book is None:
        raise TransactionNotFoundError

    if transaction.transaction_type != TransactionType.PERMANENT_EXCHANGE:
        raise InvalidTransactionStateError

    owner_change = OWNER_EXCHANGE_POINTS
    requester_change = REQUESTER_EXCHANGE_POINTS
    owner_reason = PointLedgerReason.EXCHANGE_REWARD
    requester_reason = PointLedgerReason.EXCHANGE_COST
    final_book_status = BookStatus.EXCHANGED

    add_point_change(
        db,
        user=requester,
        transaction_id=transaction.transaction_id,
        role_in_transaction=RoleInTransaction.REQUESTER,
        point_change=requester_change,
        reason=requester_reason,
    )
    add_point_change(
        db,
        user=owner,
        transaction_id=transaction.transaction_id,
        role_in_transaction=RoleInTransaction.OWNER,
        point_change=owner_change,
        reason=owner_reason,
    )
    book.book_status = final_book_status
    transaction.transaction_status = TransactionStatus.COMPLETED
    transaction.completed_at = datetime.now(UTC)


def _release_book(db: Session, transaction: Transaction) -> None:
    book = db.scalar(select(Book).where(Book.book_id == transaction.book_id).with_for_update())
    if book is not None and book.book_status == BookStatus.PENDING_TRANSACTION:
        book.book_status = BookStatus.AVAILABLE


def _cancel_delivery_if_present(db: Session, transaction: Transaction) -> None:
    if transaction.delivery_method != DeliveryMethod.FREE_COURIER:
        return
    delivery = db.scalar(
        select(Delivery)
        .where(Delivery.transaction_id == transaction.transaction_id)
        .with_for_update()
    )
    if delivery is None or delivery.delivery_status in {
        DeliveryStatus.DELIVERED,
        DeliveryStatus.FAILED,
        DeliveryStatus.CANCELLED,
    }:
        return
    delivery.delivery_status = DeliveryStatus.CANCELLED


def _set_book_status(db: Session, transaction: Transaction, status: BookStatus) -> None:
    book = db.scalar(select(Book).where(Book.book_id == transaction.book_id).with_for_update())
    if book is not None:
        book.book_status = status


def _calculate_late_days(expected_return_at: datetime | None, returned_at: datetime) -> int:
    if expected_return_at is None:
        return 0
    expected = _as_utc(expected_return_at)
    returned = _as_utc(returned_at)
    if returned <= expected:
        return 0
    overdue_seconds = (returned - expected).total_seconds()
    seconds_per_day = 24 * 60 * 60
    return int((overdue_seconds + seconds_per_day - 1) // seconds_per_day)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
