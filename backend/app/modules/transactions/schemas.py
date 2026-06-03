from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import DeliveryMethod, TransactionStatus, TransactionType


class DeliveryLocationRequest(BaseModel):
    address: str = Field(min_length=1)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class TransactionCreateRequest(BaseModel):
    book_id: int
    transaction_type: TransactionType
    delivery_method: DeliveryMethod
    borrow_duration_days: int | None = Field(default=None, gt=0)
    receiver_address: str | None = Field(default=None, min_length=1)
    receiver_lat: float | None = Field(default=None, ge=-90, le=90)
    receiver_lng: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def validate_borrow_duration(self) -> "TransactionCreateRequest":
        if self.transaction_type == TransactionType.BORROW_RETURN and self.borrow_duration_days is None:
            raise ValueError("borrow_duration_days is required for BORROW_RETURN transactions.")
        if self.transaction_type != TransactionType.BORROW_RETURN and self.borrow_duration_days is not None:
            raise ValueError("borrow_duration_days is only allowed for BORROW_RETURN transactions.")
        receiver_fields = [self.receiver_address, self.receiver_lat, self.receiver_lng]
        if self.delivery_method == DeliveryMethod.FREE_COURIER and any(value is None for value in receiver_fields):
            raise ValueError("receiver address and coordinates are required for FREE_COURIER transactions.")
        if self.delivery_method != DeliveryMethod.FREE_COURIER and any(value is not None for value in receiver_fields):
            raise ValueError("receiver address and coordinates are only allowed for FREE_COURIER transactions.")
        return self


class TransactionAcceptRequest(BaseModel):
    pickup_address: str | None = Field(default=None, min_length=1)
    pickup_lat: float | None = Field(default=None, ge=-90, le=90)
    pickup_lng: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def validate_pickup_fields(self) -> "TransactionAcceptRequest":
        values = [self.pickup_address, self.pickup_lat, self.pickup_lng]
        if any(value is not None for value in values) and any(value is None for value in values):
            raise ValueError("pickup address and coordinates must be provided together.")
        return self


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: int
    book_id: int
    book_title: str | None = None
    book_author: str | None = None
    owner_id: int
    owner_full_name: str | None = None
    requester_id: int
    requester_full_name: str | None = None
    pickup_address: str | None = None
    receiver_address: str | None = None
    pickup_lat: float | None = None
    pickup_lng: float | None = None
    receiver_lat: float | None = None
    receiver_lng: float | None = None
    transaction_type: TransactionType
    delivery_method: DeliveryMethod
    transaction_status: TransactionStatus
    owner_confirmed: bool
    requester_confirmed: bool
    courier_confirmed: bool
    borrow_duration_days: int | None
    expected_return_at: datetime | None
    borrowed_at: datetime | None
    return_requested_at: datetime | None
    returned_at: datetime | None
    late_days: int
    late_fee_points: int
    requested_at: datetime
    completed_at: datetime | None
