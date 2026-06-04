from fastapi import APIRouter, HTTPException, Query, status

from app.core.dependencies import CurrentUser, DbSession
from app.models.enums import AccountStatus, BookStatus, TransactionStatus, TransactionType, UserRole
from app.modules.admin.schemas import (
    ActivityLogResponse,
    AdminActionResponse,
    AdminBookResponse,
    AdminDashboardMetricsResponse,
    AdminPointAdjustmentRequest,
    AdminPointAdjustmentResponse,
    AdminTransactionResponse,
    AdminUserResponse,
    CourierApplicationResponse,
    CourierApplicationReviewRequest,
)
from app.modules.admin.service import (
    AdminRequiredError,
    BookNotFoundError,
    CourierApplicationNotFoundError,
    InvalidAdminActionError,
    TransactionNotFoundError,
    UserNotFoundError,
    adjust_user_points,
    approve_courier_application,
    cancel_transaction,
    hide_book,
    list_activity_logs,
    list_admin_actions,
    get_dashboard_metrics,
    list_books_for_admin,
    list_courier_applications,
    list_transactions_for_admin,
    list_users,
    lock_user,
    reject_courier_application,
    restore_book,
    unlock_user,
)
from app.modules.points.service import InsufficientPointsError

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[AdminUserResponse])
def read_users(
    db: DbSession,
    current_user: CurrentUser,
    q: str | None = Query(default=None, min_length=1, max_length=255),
    role: UserRole | None = None,
    account_status: AccountStatus | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[AdminUserResponse]:
    try:
        return [
            AdminUserResponse.model_validate(user)
            for user in list_users(
                db,
                current_user,
                query=q,
                role=role,
                status=account_status,
                limit=limit,
                offset=offset,
            )
        ]
    except AdminRequiredError:
        raise _admin_required_error() from None


@router.get("/dashboard-metrics", response_model=AdminDashboardMetricsResponse)
def read_dashboard_metrics(
    db: DbSession,
    current_user: CurrentUser,
    days: int = Query(default=14, ge=1, le=90),
) -> AdminDashboardMetricsResponse:
    try:
        return AdminDashboardMetricsResponse.model_validate(
            get_dashboard_metrics(db, current_user, days=days)
        )
    except AdminRequiredError:
        raise _admin_required_error() from None


@router.get("/books", response_model=list[AdminBookResponse])
def read_books(
    db: DbSession,
    current_user: CurrentUser,
    q: str | None = Query(default=None, min_length=1, max_length=255),
    book_status: BookStatus | None = None,
    category_id: int | None = None,
    owner_id: int | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[AdminBookResponse]:
    try:
        return [
            AdminBookResponse.model_validate(book)
            for book in list_books_for_admin(
                db,
                current_user,
                query=q,
                status=book_status,
                category_id=category_id,
                owner_id=owner_id,
                limit=limit,
                offset=offset,
            )
        ]
    except AdminRequiredError:
        raise _admin_required_error() from None


@router.get("/transactions", response_model=list[AdminTransactionResponse])
def read_transactions(
    db: DbSession,
    current_user: CurrentUser,
    transaction_status: TransactionStatus | None = None,
    transaction_type: TransactionType | None = None,
    user_id: int | None = None,
    book_id: int | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[AdminTransactionResponse]:
    try:
        return [
            AdminTransactionResponse.model_validate(transaction)
            for transaction in list_transactions_for_admin(
                db,
                current_user,
                status=transaction_status,
                transaction_type=transaction_type,
                user_id=user_id,
                book_id=book_id,
                limit=limit,
                offset=offset,
            )
        ]
    except AdminRequiredError:
        raise _admin_required_error() from None


@router.get("/courier-applications", response_model=list[CourierApplicationResponse])
def read_courier_applications(
    db: DbSession,
    current_user: CurrentUser,
) -> list[CourierApplicationResponse]:
    try:
        return [
            CourierApplicationResponse.model_validate(application)
            for application in list_courier_applications(db, current_user)
        ]
    except AdminRequiredError:
        raise _admin_required_error() from None


@router.post(
    "/courier-applications/{courier_id}/approve",
    response_model=CourierApplicationResponse,
)
def approve_courier(
    courier_id: int,
    payload: CourierApplicationReviewRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> CourierApplicationResponse:
    try:
        courier = approve_courier_application(db, current_user, courier_id, payload)
    except AdminRequiredError:
        raise _admin_required_error() from None
    except CourierApplicationNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Courier application not found.",
        ) from None
    except InvalidAdminActionError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending courier applications can be approved.",
        ) from None
    return CourierApplicationResponse.model_validate(courier)


@router.post(
    "/courier-applications/{courier_id}/reject",
    response_model=CourierApplicationResponse,
)
def reject_courier(
    courier_id: int,
    payload: CourierApplicationReviewRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> CourierApplicationResponse:
    try:
        courier = reject_courier_application(db, current_user, courier_id, payload)
    except AdminRequiredError:
        raise _admin_required_error() from None
    except CourierApplicationNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Courier application not found.",
        ) from None
    except InvalidAdminActionError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending courier applications can be rejected.",
        ) from None
    return CourierApplicationResponse.model_validate(courier)


@router.post("/users/{user_id}/lock", response_model=AdminUserResponse)
def lock(user_id: int, db: DbSession, current_user: CurrentUser) -> AdminUserResponse:
    try:
        user = lock_user(db, current_user, user_id)
    except AdminRequiredError:
        raise _admin_required_error() from None
    except UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.") from None
    except InvalidAdminActionError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This admin action is not allowed.",
        ) from None
    return AdminUserResponse.model_validate(user)


@router.post("/users/{user_id}/unlock", response_model=AdminUserResponse)
def unlock(user_id: int, db: DbSession, current_user: CurrentUser) -> AdminUserResponse:
    try:
        user = unlock_user(db, current_user, user_id)
    except AdminRequiredError:
        raise _admin_required_error() from None
    except UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.") from None
    return AdminUserResponse.model_validate(user)


@router.post("/books/{book_id}/hide", response_model=AdminBookResponse)
def hide(book_id: int, db: DbSession, current_user: CurrentUser) -> AdminBookResponse:
    try:
        book = hide_book(db, current_user, book_id)
    except AdminRequiredError:
        raise _admin_required_error() from None
    except BookNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.") from None
    except InvalidAdminActionError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This book cannot be hidden in its current state.",
        ) from None
    return AdminBookResponse.model_validate(book)


@router.post("/books/{book_id}/restore", response_model=AdminBookResponse)
def restore(book_id: int, db: DbSession, current_user: CurrentUser) -> AdminBookResponse:
    try:
        book = restore_book(db, current_user, book_id)
    except AdminRequiredError:
        raise _admin_required_error() from None
    except BookNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.") from None
    except InvalidAdminActionError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only removed books can be restored.",
        ) from None
    return AdminBookResponse.model_validate(book)


@router.post("/transactions/{transaction_id}/cancel", response_model=AdminTransactionResponse)
def cancel(
    transaction_id: int,
    db: DbSession,
    current_user: CurrentUser,
) -> AdminTransactionResponse:
    try:
        transaction = cancel_transaction(db, current_user, transaction_id)
    except AdminRequiredError:
        raise _admin_required_error() from None
    except TransactionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        ) from None
    except InvalidAdminActionError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This transaction cannot be cancelled in its current state.",
        ) from None
    return AdminTransactionResponse.model_validate(transaction)


@router.post("/users/{user_id}/point-adjustments", response_model=AdminPointAdjustmentResponse)
def adjust_points(
    user_id: int,
    payload: AdminPointAdjustmentRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> AdminPointAdjustmentResponse:
    try:
        ledger, action = adjust_user_points(db, current_user, user_id, payload)
    except AdminRequiredError:
        raise _admin_required_error() from None
    except UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.") from None
    except InsufficientPointsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Point adjustment would make the balance negative.",
        ) from None
    return AdminPointAdjustmentResponse(
        ledger_id=ledger.ledger_id,
        user_id=ledger.user_id,
        points_before=ledger.points_before,
        point_change=ledger.point_change,
        points_after=ledger.points_after,
        role_in_transaction=ledger.role_in_transaction,
        reason=ledger.reason,
        admin_action_id=action.admin_action_id,
    )


@router.get("/activity-logs", response_model=list[ActivityLogResponse])
def read_activity_logs(
    db: DbSession,
    current_user: CurrentUser,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[ActivityLogResponse]:
    try:
        return [
            ActivityLogResponse.model_validate(log)
            for log in list_activity_logs(db, current_user, limit=limit, offset=offset)
        ]
    except AdminRequiredError:
        raise _admin_required_error() from None


@router.get("/admin-actions", response_model=list[AdminActionResponse])
def read_admin_actions(
    db: DbSession,
    current_user: CurrentUser,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[AdminActionResponse]:
    try:
        return [
            AdminActionResponse.model_validate(action)
            for action in list_admin_actions(db, current_user, limit=limit, offset=offset)
        ]
    except AdminRequiredError:
        raise _admin_required_error() from None


def _admin_required_error() -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required.")
