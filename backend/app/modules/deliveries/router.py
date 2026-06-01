from fastapi import APIRouter, HTTPException, status

from app.core.dependencies import CurrentUser, DbSession
from app.modules.deliveries.schemas import (
    AvailableDeliveryTaskResponse,
    DeliveryAcceptRequest,
    DeliveryResponse,
)
from app.modules.deliveries.service import (
    CourierProfileRequiredError,
    CourierUnavailableError,
    DeliveryNotFoundError,
    DeliveryTaskNotFoundError,
    ForbiddenDeliveryActionError,
    InvalidDeliveryStateError,
    accept_delivery_task,
    list_available_delivery_tasks,
    list_my_deliveries,
    mark_delivery_delivered,
    mark_delivery_failed,
    mark_delivery_picked_up,
)

router = APIRouter()


@router.get(
    "/deliveries/available",
    response_model=list[AvailableDeliveryTaskResponse],
    tags=["deliveries"],
)
def read_available_deliveries(db: DbSession, current_user: CurrentUser) -> list[AvailableDeliveryTaskResponse]:
    try:
        tasks = list_available_delivery_tasks(db, current_user)
    except CourierProfileRequiredError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Courier profile required.",
        ) from None
    return [AvailableDeliveryTaskResponse.model_validate(task, from_attributes=True) for task in tasks]


@router.get("/deliveries/me", response_model=list[DeliveryResponse], tags=["deliveries"])
def read_my_deliveries(db: DbSession, current_user: CurrentUser) -> list[DeliveryResponse]:
    try:
        deliveries = list_my_deliveries(db, current_user)
    except CourierProfileRequiredError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Courier profile required.",
        ) from None
    return [DeliveryResponse.model_validate(delivery) for delivery in deliveries]


@router.post(
    "/deliveries/transactions/{transaction_id}/accept",
    response_model=DeliveryResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["deliveries"],
)
def accept_task(
    transaction_id: int,
    payload: DeliveryAcceptRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> DeliveryResponse:
    try:
        delivery = accept_delivery_task(db, current_user, transaction_id, payload)
    except CourierProfileRequiredError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Courier profile required.",
        ) from None
    except CourierUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Courier must be available to accept a delivery.",
        ) from None
    except DeliveryTaskNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Available delivery task not found.",
        ) from None
    except InvalidDeliveryStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Delivery task is already assigned.",
        ) from None
    return DeliveryResponse.model_validate(delivery)


@router.post(
    "/deliveries/{delivery_id}/pickup",
    response_model=DeliveryResponse,
    tags=["deliveries"],
)
def pickup(delivery_id: int, db: DbSession, current_user: CurrentUser) -> DeliveryResponse:
    try:
        delivery = mark_delivery_picked_up(db, current_user, delivery_id)
    except DeliveryNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery not found.") from None
    except CourierProfileRequiredError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Courier profile required.") from None
    except ForbiddenDeliveryActionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned courier can update this delivery.",
        ) from None
    except InvalidDeliveryStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only assigned deliveries can be picked up.",
        ) from None
    return DeliveryResponse.model_validate(delivery)


@router.post(
    "/deliveries/{delivery_id}/delivered",
    response_model=DeliveryResponse,
    tags=["deliveries"],
)
def delivered(delivery_id: int, db: DbSession, current_user: CurrentUser) -> DeliveryResponse:
    try:
        delivery = mark_delivery_delivered(db, current_user, delivery_id)
    except DeliveryNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery not found.") from None
    except CourierProfileRequiredError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Courier profile required.") from None
    except ForbiddenDeliveryActionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned courier can update this delivery.",
        ) from None
    except InvalidDeliveryStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only picked-up deliveries can be delivered.",
        ) from None
    return DeliveryResponse.model_validate(delivery)


@router.post(
    "/deliveries/{delivery_id}/failed",
    response_model=DeliveryResponse,
    tags=["deliveries"],
)
def failed(delivery_id: int, db: DbSession, current_user: CurrentUser) -> DeliveryResponse:
    try:
        delivery = mark_delivery_failed(db, current_user, delivery_id)
    except DeliveryNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery not found.") from None
    except CourierProfileRequiredError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Courier profile required.") from None
    except ForbiddenDeliveryActionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned courier can update this delivery.",
        ) from None
    except InvalidDeliveryStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only assigned or picked-up deliveries can be failed.",
        ) from None
    return DeliveryResponse.model_validate(delivery)
