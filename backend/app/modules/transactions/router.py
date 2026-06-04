from fastapi import APIRouter, Body, HTTPException, Query, status

from app.core.dependencies import CurrentUser, DbSession
from app.modules.points.service import InsufficientPointsError
from app.modules.transactions.schemas import (
    TransactionAcceptRequest,
    TransactionCreateRequest,
    TransactionResponse,
)
from app.modules.transactions.service import (
    BookNotAvailableError,
    DeliveryAreaNotSupportedError,
    ForbiddenTransactionActionError,
    InvalidTransactionRequestError,
    InvalidTransactionStateError,
    TransactionNotFoundError,
    accept_transaction,
    cancel_transaction,
    confirm_borrow_receipt,
    confirm_borrow_return,
    confirm_transaction,
    create_transaction,
    list_my_transactions,
    reject_transaction,
    request_borrow_return,
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
    except DeliveryAreaNotSupportedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Free courier only supports configured campus handoff points near UET.",
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
def accept(
    transaction_id: int,
    db: DbSession,
    current_user: CurrentUser,
    payload: TransactionAcceptRequest | None = Body(default=None),
) -> TransactionResponse:
    try:
        transaction = accept_transaction(db, current_user, transaction_id, payload)
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
    except InvalidTransactionRequestError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pickup address and coordinates are required for courier delivery.",
        ) from None
    except DeliveryAreaNotSupportedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Free courier only supports configured campus handoff points near UET.",
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
    "/transactions/{transaction_id}/confirm-receipt",
    response_model=TransactionResponse,
    tags=["transactions"],
)
def confirm_receipt(transaction_id: int, db: DbSession, current_user: CurrentUser) -> TransactionResponse:
    try:
        transaction = confirm_borrow_receipt(db, current_user, transaction_id)
    except TransactionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.") from None
    except ForbiddenTransactionActionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the requester can confirm receipt for this transaction.",
        ) from None
    except InvalidTransactionStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This transaction cannot be marked as received in its current state.",
        ) from None
    except InsufficientPointsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Requester has insufficient points to start this borrow transaction.",
        ) from None
    return TransactionResponse.model_validate(transaction)


@router.post(
    "/transactions/{transaction_id}/return",
    response_model=TransactionResponse,
    tags=["transactions"],
)
def request_return(transaction_id: int, db: DbSession, current_user: CurrentUser) -> TransactionResponse:
    try:
        transaction = request_borrow_return(db, current_user, transaction_id)
    except TransactionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.") from None
    except ForbiddenTransactionActionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the requester can return this borrowed book.",
        ) from None
    except InvalidTransactionStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This transaction cannot be returned in its current state.",
        ) from None
    return TransactionResponse.model_validate(transaction)


@router.post(
    "/transactions/{transaction_id}/confirm-return",
    response_model=TransactionResponse,
    tags=["transactions"],
)
def confirm_return(transaction_id: int, db: DbSession, current_user: CurrentUser) -> TransactionResponse:
    try:
        transaction = confirm_borrow_return(db, current_user, transaction_id)
    except TransactionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.") from None
    except ForbiddenTransactionActionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can confirm returned books.",
        ) from None
    except InvalidTransactionStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This transaction cannot be confirmed returned in its current state.",
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
