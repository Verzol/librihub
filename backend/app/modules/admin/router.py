from fastapi import APIRouter, HTTPException, status

from app.core.dependencies import CurrentUser, DbSession
from app.modules.admin.schemas import (
    ActivityLogResponse,
    AdminActionResponse,
    AdminBookResponse,
    AdminPointAdjustmentRequest,
    AdminPointAdjustmentResponse,
    AdminTransactionResponse,
    AdminUserResponse,
)
from app.modules.admin.service import (
    AdminRequiredError,
    BookNotFoundError,
    InvalidAdminActionError,
    TransactionNotFoundError,
    UserNotFoundError,
    adjust_user_points,
    cancel_transaction,
    hide_book,
    list_activity_logs,
    list_admin_actions,
    list_users,
    lock_user,
    restore_book,
    unlock_user,
)
from app.modules.points.service import InsufficientPointsError

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[AdminUserResponse])
def read_users(db: DbSession, current_user: CurrentUser) -> list[AdminUserResponse]:
    try:
        return [AdminUserResponse.model_validate(user) for user in list_users(db, current_user)]
    except AdminRequiredError:
        raise _admin_required_error() from None


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
) -> list[ActivityLogResponse]:
    try:
        return [
            ActivityLogResponse.model_validate(log)
            for log in list_activity_logs(db, current_user)
        ]
    except AdminRequiredError:
        raise _admin_required_error() from None


@router.get("/admin-actions", response_model=list[AdminActionResponse])
def read_admin_actions(
    db: DbSession,
    current_user: CurrentUser,
) -> list[AdminActionResponse]:
    try:
        return [
            AdminActionResponse.model_validate(action)
            for action in list_admin_actions(db, current_user)
        ]
    except AdminRequiredError:
        raise _admin_required_error() from None


def _admin_required_error() -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required.")
