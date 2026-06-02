from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import DeliveryStatus


class DeliveryAcceptRequest(BaseModel):
    expected_delivery_at: datetime | None = None


class AvailableDeliveryTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: int
    book_id: int
    owner_id: int
    requester_id: int
    pickup_address: str | None
    receiver_address: str
    pickup_lat: float | None
    pickup_lng: float | None
    receiver_lat: float | None
    receiver_lng: float | None
    requested_at: datetime


class DeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    delivery_id: int
    transaction_id: int
    book_id: int | None = None
    owner_id: int | None = None
    requester_id: int | None = None
    courier_id: int | None
    pickup_address: str | None
    receiver_address: str
    pickup_lat: float | None
    pickup_lng: float | None
    receiver_lat: float | None
    receiver_lng: float | None
    delivery_status: DeliveryStatus
    assigned_at: datetime | None
    picked_up_at: datetime | None
    delivered_at: datetime | None
    expected_delivery_at: datetime | None
