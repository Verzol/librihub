from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import (
    AccountStatus,
    ActivityType,
    AdminActionType,
    BookStatus,
    PointLedgerReason,
    RoleInTransaction,
    TransactionStatus,
    UserRole,
)


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    full_name: str
    email: str
    phone: str
    role: UserRole
    current_points: int
    account_status: AccountStatus
    created_at: datetime
    updated_at: datetime


class AdminBookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    book_id: int
    owner_id: int
    category_id: int
    title: str
    author: str
    book_status: BookStatus
    cover_image_url: str | None
    created_at: datetime
    updated_at: datetime


class AdminTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: int
    book_id: int
    owner_id: int
    requester_id: int
    transaction_status: TransactionStatus
    requested_at: datetime
    completed_at: datetime | None


class AdminPointAdjustmentRequest(BaseModel):
    point_change: int
    reason: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def validate_point_change(self) -> "AdminPointAdjustmentRequest":
        if self.point_change == 0:
            raise ValueError("point_change must not be zero")
        return self

    @field_validator("reason")
    @classmethod
    def strip_reason(cls, value: str) -> str:
        return value.strip()


class AdminPointAdjustmentResponse(BaseModel):
    ledger_id: int
    user_id: int
    points_before: int
    point_change: int
    points_after: int
    role_in_transaction: RoleInTransaction
    reason: PointLedgerReason
    admin_action_id: int


class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    activity_id: int
    user_id: int
    activity_type: ActivityType
    activity_description: str
    created_at: datetime


class AdminActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    admin_action_id: int
    admin_id: int
    target_user_id: int | None
    action_type: AdminActionType
    action_description: str
    created_at: datetime
