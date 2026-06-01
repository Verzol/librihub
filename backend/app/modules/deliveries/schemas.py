from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import DeliveryStatus


class DeliveryAcceptRequest(BaseModel):
    pickup_address: str = Field(min_length=1)
    receiver_address: str = Field(min_length=1)

    @field_validator("pickup_address", "receiver_address")
    @classmethod
    def strip_address(cls, value: str) -> str:
        return value.strip()


class AvailableDeliveryTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: int
    book_id: int
    owner_id: int
    requester_id: int
    requested_at: datetime


class DeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    delivery_id: int
    transaction_id: int
    courier_id: int
    pickup_address: str
    receiver_address: str
    delivery_status: DeliveryStatus
    assigned_at: datetime | None
    picked_up_at: datetime | None
    delivered_at: datetime | None
