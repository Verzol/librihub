from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import AccountStatus, CourierStatus, MembershipStatus, UserRole


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    phone: str = Field(min_length=6, max_length=32)
    password: str = Field(min_length=8, max_length=72)
    student_code: str = Field(min_length=1, max_length=64)
    address: str = Field(min_length=1)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
            raise ValueError("Invalid email address.")
        return normalized

    @field_validator("full_name", "phone", "student_code", "address")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class LoginRequest(BaseModel):
    login: str = Field(min_length=1, max_length=255, description="Email or phone.")
    password: str = Field(min_length=1, max_length=72)

    @field_validator("login")
    @classmethod
    def normalize_login(cls, value: str) -> str:
        return value.strip().lower()


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, min_length=6, max_length=32)
    student_code: str | None = Field(default=None, min_length=1, max_length=64)
    address: str | None = Field(default=None, min_length=1)

    @field_validator("full_name", "phone", "student_code", "address")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is not None:
            return value.strip()
        return value


class CourierProfileCreateRequest(BaseModel):
    delivery_area: str = Field(min_length=1, max_length=255)
    contact_name: str | None = Field(default=None, min_length=1, max_length=255)
    contact_phone: str | None = Field(default=None, min_length=6, max_length=32)
    contact_address: str | None = Field(default=None, min_length=1)
    vehicle_type: str | None = Field(default=None, min_length=1, max_length=120)
    document_url: str | None = Field(default=None, max_length=1024)
    application_note: str | None = Field(default=None, max_length=5000)

    @field_validator("delivery_area")
    @classmethod
    def strip_delivery_area(cls, value: str) -> str:
        return value.strip()

    @field_validator(
        "contact_name",
        "contact_phone",
        "contact_address",
        "vehicle_type",
        "document_url",
        "application_note",
    )
    @classmethod
    def strip_optional_courier_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class MemberProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    member_id: int
    user_id: int
    student_code: str
    address: str
    membership_status: MembershipStatus
    registered_at: datetime


class CourierProfileResponse(BaseModel):
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


class UserResponse(BaseModel):
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
    member_profile: MemberProfileResponse | None = None
    courier_profile: CourierProfileResponse | None = None


class PublicUserSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    full_name: str
    role: UserRole
    current_points: int
    account_status: AccountStatus
    membership_status: MembershipStatus | None = None
    courier_status: CourierStatus | None = None
    joined_at: datetime


class RegisterResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "bearer"
