from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import DeliveryMethod, TransactionStatus, TransactionType


class TransactionCreateRequest(BaseModel):
    book_id: int
    transaction_type: TransactionType
    delivery_method: DeliveryMethod


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: int
    book_id: int
    owner_id: int
    requester_id: int
    transaction_type: TransactionType
    delivery_method: DeliveryMethod
    transaction_status: TransactionStatus
    owner_confirmed: bool
    requester_confirmed: bool
    courier_confirmed: bool
    requested_at: datetime
    completed_at: datetime | None
