from fastapi import APIRouter, HTTPException, Query, status

from app.core.dependencies import CurrentUser, DbSession
from app.modules.points.service import InsufficientPointsError
from app.modules.transactions.schemas import TransactionCreateRequest, TransactionResponse
from app.modules.transactions.service import (
    BookNotAvailableError,
    ForbiddenTransactionActionError,
    InvalidTransactionRequestError,
    InvalidTransactionStateError,
    TransactionNotFoundError,
    accept_transaction,
    cancel_transaction,
    confirm_transaction,
    create_transaction,
    list_my_transactions,
    reject_transaction,
)

router = APIRouter()


@router.post(
    "/transactions",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["transactions"],
)
def add_transaction(
    payload: TransactionCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> TransactionResponse:
    try:
        transaction = create_transaction(db, current_user, payload)
    except BookNotAvailableError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Book is not available for transaction.",
        ) from None
    except InvalidTransactionRequestError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid transaction request for this book.",
        ) from None
    return TransactionResponse.model_validate(transaction)


@router.get("/transactions/me", response_model=list[TransactionResponse], tags=["transactions"])
def read_my_transactions(
    db: DbSession,
    current_user: CurrentUser,
    role: str | None = Query(default=None, pattern="^(owner|requester)$"),
) -> list[TransactionResponse]:
    return [
        TransactionResponse.model_validate(transaction)
        for transaction in list_my_transactions(db, current_user, role=role)
    ]


@router.post(
    "/transactions/{transaction_id}/accept",
    response_model=TransactionResponse,
    tags=["transactions"],
)
def accept(transaction_id: int, db: DbSession, current_user: CurrentUser) -> TransactionResponse:
    try:
        transaction = accept_transaction(db, current_user, transaction_id)
    except TransactionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.") from None
    except ForbiddenTransactionActionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can accept this transaction.",
        ) from None
    except InvalidTransactionStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending transactions can be accepted.",
        ) from None
    return TransactionResponse.model_validate(transaction)


@router.post(
    "/transactions/{transaction_id}/reject",
    response_model=TransactionResponse,
    tags=["transactions"],
)
def reject(transaction_id: int, db: DbSession, current_user: CurrentUser) -> TransactionResponse:
    try:
        transaction = reject_transaction(db, current_user, transaction_id)
    except TransactionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.") from None
    except ForbiddenTransactionActionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can reject this transaction.",
        ) from None
    except InvalidTransactionStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending transactions can be rejected.",
        ) from None
    return TransactionResponse.model_validate(transaction)


@router.post(
    "/transactions/{transaction_id}/cancel",
    response_model=TransactionResponse,
    tags=["transactions"],
)
def cancel(transaction_id: int, db: DbSession, current_user: CurrentUser) -> TransactionResponse:
    try:
        transaction = cancel_transaction(db, current_user, transaction_id)
    except TransactionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.") from None
    except ForbiddenTransactionActionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only participants can cancel this transaction.",
        ) from None
    except InvalidTransactionStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This transaction cannot be cancelled in its current state.",
        ) from None
    return TransactionResponse.model_validate(transaction)


@router.post(
    "/transactions/{transaction_id}/confirm",
    response_model=TransactionResponse,
    tags=["transactions"],
)
def confirm(transaction_id: int, db: DbSession, current_user: CurrentUser) -> TransactionResponse:
    try:
        transaction = confirm_transaction(db, current_user, transaction_id)
    except TransactionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.") from None
    except ForbiddenTransactionActionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only participants can confirm this transaction.",
        ) from None
    except InvalidTransactionStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This transaction cannot be confirmed in its current state.",
        ) from None
    except InsufficientPointsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Requester has insufficient points for settlement.",
        ) from None
    return TransactionResponse.model_validate(transaction)
