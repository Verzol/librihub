from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import (
    AccountStatus,
    ActivityType,
    AdminActionType,
    BookStatus,
    CourierStatus,
    DeliveryMethod,
    PointLedgerReason,
    RoleInTransaction,
    TransactionStatus,
    TransactionType,
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
    book_title: str | None = None
    book_author: str | None = None
    owner_id: int
    owner_full_name: str | None = None
    requester_id: int
    requester_full_name: str | None = None
    transaction_type: TransactionType
    delivery_method: DeliveryMethod
    transaction_status: TransactionStatus
    owner_confirmed: bool
    requester_confirmed: bool
    courier_confirmed: bool
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


class CourierApplicationReviewRequest(BaseModel):
    review_note: str | None = Field(default=None, max_length=1000)

    @field_validator("review_note")
    @classmethod
    def strip_review_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class CourierApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    courier_id: int
    user_id: int
    delivery_area: str
    courier_status: CourierStatus
    successful_delivery_count: int
    contact_name: str | None
    contact_phone: str | None
    contact_address: str | None
    vehicle_type: str | None
    document_url: str | None
    application_note: str | None
    reviewed_by_admin_id: int | None
    reviewed_at: datetime | None
    review_note: str | None
    registered_at: datetime


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


class DashboardMetricPoint(BaseModel):
    date: str
    total_users: int
    transactions_created: int


class AdminDashboardMetricsResponse(BaseModel):
    total_users: int
    pending_courier_applications: int
    activity_log_count: int
    admin_action_count: int
    chart: list[DashboardMetricPoint]
