from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.enums import (
    AccountStatus,
    ActivityType,
    AdminActionType,
    AdminStatus,
    BookStatus,
    CourierStatus,
    DeliveryMethod,
    DeliveryStatus,
    PointLedgerReason,
    RoleInTransaction,
    TransactionStatus,
    TransactionType,
    UserRole,
)
from app.models.erd import (
    ActivityLog,
    AdminAction,
    AdminProfile,
    Book,
    CourierProfile,
    Delivery,
    Transaction,
    TransactionPointLedger,
    User,
)
from app.modules.admin.schemas import AdminPointAdjustmentRequest
from app.modules.admin.schemas import DashboardMetricPoint
from app.modules.admin.schemas import CourierApplicationReviewRequest
from app.modules.points.service import InsufficientPointsError, add_point_change


class AdminRequiredError(Exception):
    pass


class UserNotFoundError(Exception):
    pass


class BookNotFoundError(Exception):
    pass


class TransactionNotFoundError(Exception):
    pass


class InvalidAdminActionError(Exception):
    pass


class CourierApplicationNotFoundError(Exception):
    pass


def list_users(
    db: Session,
    current_user: User,
    *,
    query: str | None = None,
    role: UserRole | None = None,
    status: AccountStatus | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> list[User]:
    _ensure_admin(current_user)
    statement = select(User).order_by(User.created_at.desc(), User.user_id.desc())
    if query:
        pattern = f"%{query.strip()}%"
        statement = statement.where(
            or_(User.full_name.ilike(pattern), User.email.ilike(pattern), User.phone.ilike(pattern))
        )
    if role is not None:
        statement = statement.where(User.role == role)
    if status is not None:
        statement = statement.where(User.account_status == status)
    if offset:
        statement = statement.offset(offset)
    if limit is not None:
        statement = statement.limit(limit)
    return list(db.scalars(statement))


def list_books_for_admin(
    db: Session,
    current_user: User,
    *,
    query: str | None = None,
    status: BookStatus | None = None,
    category_id: int | None = None,
    owner_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Book]:
    _ensure_admin(current_user)
    statement = (
        select(Book)
        .options(selectinload(Book.category), selectinload(Book.owner))
        .order_by(Book.created_at.desc(), Book.book_id.desc())
        .offset(offset)
        .limit(limit)
    )
    if query:
        pattern = f"%{query.strip()}%"
        statement = statement.where(or_(Book.title.ilike(pattern), Book.author.ilike(pattern)))
    if status is not None:
        statement = statement.where(Book.book_status == status)
    if category_id is not None:
        statement = statement.where(Book.category_id == category_id)
    if owner_id is not None:
        statement = statement.where(Book.owner_id == owner_id)
    return list(db.scalars(statement))


def list_transactions_for_admin(
    db: Session,
    current_user: User,
    *,
    status: TransactionStatus | None = None,
    transaction_type: TransactionType | None = None,
    user_id: int | None = None,
    book_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Transaction]:
    _ensure_admin(current_user)
    statement = (
        select(Transaction)
        .options(
            selectinload(Transaction.book),
            selectinload(Transaction.owner),
            selectinload(Transaction.requester),
            selectinload(Transaction.delivery),
        )
        .order_by(Transaction.requested_at.desc(), Transaction.transaction_id.desc())
        .offset(offset)
        .limit(limit)
    )
    if status is not None:
        statement = statement.where(Transaction.transaction_status == status)
    if transaction_type is not None:
        statement = statement.where(Transaction.transaction_type == transaction_type)
    if user_id is not None:
        statement = statement.where(or_(Transaction.owner_id == user_id, Transaction.requester_id == user_id))
    if book_id is not None:
        statement = statement.where(Transaction.book_id == book_id)
    return list(db.scalars(statement))


def get_dashboard_metrics(
    db: Session,
    current_user: User,
    *,
    days: int = 14,
) -> dict[str, object]:
    _ensure_admin(current_user)
    today = date.today()
    first_day = today - timedelta(days=days - 1)
    total_users = db.scalar(select(func.count(User.user_id))) or 0
    pending_couriers = db.scalar(
        select(func.count(CourierProfile.courier_id)).where(CourierProfile.courier_status == CourierStatus.PENDING)
    ) or 0
    activity_log_count = db.scalar(select(func.count(ActivityLog.activity_id))) or 0
    admin_action_count = db.scalar(select(func.count(AdminAction.admin_action_id))) or 0

    users = list(db.scalars(select(User.created_at)))
    create_transaction_logs = list(
        db.scalars(
            select(ActivityLog.created_at).where(
                ActivityLog.activity_type == ActivityType.CREATE_TRANSACTION,
                ActivityLog.created_at >= datetime.combine(first_day, datetime.min.time(), tzinfo=UTC),
            )
        )
    )
    transactions_by_day: dict[date, int] = {}
    for created_at in create_transaction_logs:
        key = _as_utc(created_at).date()
        transactions_by_day[key] = transactions_by_day.get(key, 0) + 1

    chart = []
    for index in range(days):
        day = first_day + timedelta(days=index)
        day_end = datetime.combine(day + timedelta(days=1), datetime.min.time(), tzinfo=UTC)
        chart.append(
            DashboardMetricPoint(
                date=day.isoformat(),
                total_users=sum(1 for created_at in users if _as_utc(created_at) < day_end),
                transactions_created=transactions_by_day.get(day, 0),
            )
        )

    return {
        "total_users": int(total_users),
        "pending_courier_applications": int(pending_couriers),
        "activity_log_count": int(activity_log_count),
        "admin_action_count": int(admin_action_count),
        "chart": chart,
    }


def list_courier_applications(db: Session, current_user: User) -> list[CourierProfile]:
    _ensure_admin(current_user)
    statement = select(CourierProfile).order_by(
        CourierProfile.registered_at.desc(),
        CourierProfile.courier_id.desc(),
    )
    return list(db.scalars(statement))


def approve_courier_application(
    db: Session,
    current_user: User,
    courier_id: int,
    payload: CourierApplicationReviewRequest,
) -> CourierProfile:
    admin = _ensure_admin(current_user)
    courier = _get_courier_application_for_update(db, courier_id)
    if courier.courier_status != CourierStatus.PENDING:
        raise InvalidAdminActionError
    user = _get_user_for_update(db, courier.user_id)

    now = datetime.now(UTC)
    courier.courier_status = CourierStatus.AVAILABLE
    courier.reviewed_by_admin_id = admin.admin_id
    courier.reviewed_at = now
    courier.review_note = payload.review_note
    user.role = UserRole.COURIER
    _add_admin_action(
        db,
        admin=admin,
        target_user_id=user.user_id,
        action_type=AdminActionType.OTHER,
        description=f"Approved courier application #{courier.courier_id}.",
    )
    db.commit()
    db.refresh(courier)
    return courier


def reject_courier_application(
    db: Session,
    current_user: User,
    courier_id: int,
    payload: CourierApplicationReviewRequest,
) -> CourierProfile:
    admin = _ensure_admin(current_user)
    courier = _get_courier_application_for_update(db, courier_id)
    if courier.courier_status != CourierStatus.PENDING:
        raise InvalidAdminActionError

    now = datetime.now(UTC)
    courier.courier_status = CourierStatus.INACTIVE
    courier.reviewed_by_admin_id = admin.admin_id
    courier.reviewed_at = now
    courier.review_note = payload.review_note
    _add_admin_action(
        db,
        admin=admin,
        target_user_id=courier.user_id,
        action_type=AdminActionType.OTHER,
        description=f"Rejected courier application #{courier.courier_id}.",
    )
    db.commit()
    db.refresh(courier)
    return courier


def lock_user(db: Session, current_user: User, user_id: int) -> User:
    admin = _ensure_admin(current_user)
    user = _get_user_for_update(db, user_id)
    if user.user_id == current_user.user_id:
        raise InvalidAdminActionError
    user.account_status = AccountStatus.LOCKED
    _add_admin_action(
        db,
        admin=admin,
        target_user_id=user.user_id,
        action_type=AdminActionType.LOCK_USER,
        description=f"Locked user #{user.user_id}.",
    )
    db.commit()
    db.refresh(user)
    return user


def unlock_user(db: Session, current_user: User, user_id: int) -> User:
    admin = _ensure_admin(current_user)
    user = _get_user_for_update(db, user_id)
    user.account_status = AccountStatus.ACTIVE
    _add_admin_action(
        db,
        admin=admin,
        target_user_id=user.user_id,
        action_type=AdminActionType.UNLOCK_USER,
        description=f"Unlocked user #{user.user_id}.",
    )
    db.commit()
    db.refresh(user)
    return user


def hide_book(db: Session, current_user: User, book_id: int) -> Book:
    admin = _ensure_admin(current_user)
    book = _get_book_for_update(db, book_id)
    if book.book_status == BookStatus.PENDING_TRANSACTION:
        raise InvalidAdminActionError
    book.book_status = BookStatus.REMOVED
    _add_admin_action(
        db,
        admin=admin,
        target_user_id=book.owner_id,
        action_type=AdminActionType.HIDE_BOOK,
        description=f"Hid book #{book.book_id}: {book.title}.",
    )
    db.commit()
    db.refresh(book)
    return book


def restore_book(db: Session, current_user: User, book_id: int) -> Book:
    admin = _ensure_admin(current_user)
    book = _get_book_for_update(db, book_id)
    if book.book_status != BookStatus.REMOVED:
        raise InvalidAdminActionError
    book.book_status = BookStatus.AVAILABLE
    _add_admin_action(
        db,
        admin=admin,
        target_user_id=book.owner_id,
        action_type=AdminActionType.RESTORE_BOOK,
        description=f"Restored book #{book.book_id}: {book.title}.",
    )
    db.commit()
    db.refresh(book)
    return book


def cancel_transaction(db: Session, current_user: User, transaction_id: int) -> Transaction:
    admin = _ensure_admin(current_user)
    transaction = db.scalar(
        select(Transaction)
        .where(Transaction.transaction_id == transaction_id)
        .with_for_update()
    )
    if transaction is None:
        raise TransactionNotFoundError
    if transaction.transaction_status in {
        TransactionStatus.COMPLETED,
        TransactionStatus.CANCELLED,
        TransactionStatus.REJECTED,
    }:
        raise InvalidAdminActionError

    transaction.transaction_status = TransactionStatus.CANCELLED
    if transaction.delivery_method == DeliveryMethod.FREE_COURIER:
        _cancel_active_delivery(db, transaction.transaction_id)
    book = db.scalar(select(Book).where(Book.book_id == transaction.book_id).with_for_update())
    if book is not None and book.book_status == BookStatus.PENDING_TRANSACTION:
        book.book_status = BookStatus.AVAILABLE
    _add_admin_action(
        db,
        admin=admin,
        target_user_id=transaction.requester_id,
        action_type=AdminActionType.CANCEL_TRANSACTION,
        description=f"Cancelled transaction #{transaction.transaction_id}.",
    )
    db.commit()
    db.refresh(transaction)
    return transaction


def adjust_user_points(
    db: Session,
    current_user: User,
    user_id: int,
    payload: AdminPointAdjustmentRequest,
) -> tuple[TransactionPointLedger, AdminAction]:
    admin = _ensure_admin(current_user)
    user = _get_user_for_update(db, user_id)
    try:
        ledger = add_point_change(
            db,
            user=user,
            transaction_id=None,
            role_in_transaction=RoleInTransaction.ADMIN,
            point_change=payload.point_change,
            reason=PointLedgerReason.ADMIN_ADJUSTMENT,
        )
    except InsufficientPointsError:
        db.rollback()
        raise
    action = _add_admin_action(
        db,
        admin=admin,
        target_user_id=user.user_id,
        action_type=AdminActionType.POINT_ADJUSTMENT,
        description=f"Adjusted user #{user.user_id} points by {payload.point_change}: {payload.reason}.",
    )
    db.commit()
    db.refresh(ledger)
    db.refresh(action)
    return ledger, action


def list_activity_logs(
    db: Session,
    current_user: User,
    *,
    limit: int = 100,
    offset: int = 0,
) -> list[ActivityLog]:
    _ensure_admin(current_user)
    statement = (
        select(ActivityLog)
        .order_by(ActivityLog.created_at.desc(), ActivityLog.activity_id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(statement))


def list_admin_actions(
    db: Session,
    current_user: User,
    *,
    limit: int = 100,
    offset: int = 0,
) -> list[AdminAction]:
    _ensure_admin(current_user)
    statement = (
        select(AdminAction)
        .order_by(AdminAction.created_at.desc(), AdminAction.admin_action_id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(statement))


def _ensure_admin(current_user: User) -> AdminProfile:
    if (
        current_user.role != UserRole.ADMIN
        or current_user.admin_profile is None
        or current_user.admin_profile.admin_status != AdminStatus.ACTIVE
    ):
        raise AdminRequiredError
    return current_user.admin_profile


def _get_user_for_update(db: Session, user_id: int) -> User:
    user = db.scalar(select(User).where(User.user_id == user_id).with_for_update())
    if user is None:
        raise UserNotFoundError
    return user


def _get_book_for_update(db: Session, book_id: int) -> Book:
    book = db.scalar(select(Book).where(Book.book_id == book_id).with_for_update())
    if book is None:
        raise BookNotFoundError
    return book


def _get_courier_application_for_update(db: Session, courier_id: int) -> CourierProfile:
    courier = db.scalar(
        select(CourierProfile)
        .where(CourierProfile.courier_id == courier_id)
        .with_for_update()
    )
    if courier is None:
        raise CourierApplicationNotFoundError
    return courier


def _cancel_active_delivery(db: Session, transaction_id: int) -> None:
    delivery = db.scalar(
        select(Delivery)
        .where(Delivery.transaction_id == transaction_id)
        .with_for_update()
    )
    if delivery is None or delivery.delivery_status in {
        DeliveryStatus.DELIVERED,
        DeliveryStatus.FAILED,
        DeliveryStatus.CANCELLED,
    }:
        return

    delivery.delivery_status = DeliveryStatus.CANCELLED
    if delivery.courier_id is None:
        return
    courier = db.scalar(
        select(CourierProfile)
        .where(CourierProfile.courier_id == delivery.courier_id)
        .with_for_update()
    )
    if courier is not None:
        courier.courier_status = CourierStatus.AVAILABLE


def _add_admin_action(
    db: Session,
    *,
    admin: AdminProfile,
    target_user_id: int | None,
    action_type: AdminActionType,
    description: str,
) -> AdminAction:
    action = AdminAction(
        admin_id=admin.admin_id,
        target_user_id=target_user_id,
        action_type=action_type,
        action_description=description,
    )
    db.add(action)
    return action


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
