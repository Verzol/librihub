from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import BookCondition, BookStatus, CourierStatus, ExchangeMode


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category_id: int
    category_name: str
    category_description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CategorySummaryResponse(BaseModel):
    category_id: int
    category_name: str
    category_description: str | None
    book_count: int


class CategoryCreateRequest(BaseModel):
    category_name: str = Field(min_length=1, max_length=120)
    category_description: str | None = None
    is_active: bool = True

    @field_validator("category_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("category_description")
    @classmethod
    def strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class CategoryUpdateRequest(BaseModel):
    category_name: str | None = Field(default=None, min_length=1, max_length=120)
    category_description: str | None = None
    is_active: bool | None = None

    @field_validator("category_name")
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()

    @field_validator("category_description")
    @classmethod
    def strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class BookCreateRequest(BaseModel):
    category_id: int
    title: str = Field(min_length=1, max_length=255)
    author: str = Field(min_length=1, max_length=255)
    book_description: str | None = Field(default=None, max_length=5000)
    publication_year: int | None = Field(default=None, ge=0, le=9999)
    book_condition: BookCondition
    exchange_mode: ExchangeMode
    cover_image_url: str | None = Field(default=None, max_length=1024)

    @field_validator("title", "author")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("book_description", "cover_image_url")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class BookUpdateRequest(BaseModel):
    category_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    author: str | None = Field(default=None, min_length=1, max_length=255)
    book_description: str | None = Field(default=None, max_length=5000)
    publication_year: int | None = Field(default=None, ge=0, le=9999)
    book_condition: BookCondition | None = None
    exchange_mode: ExchangeMode | None = None
    cover_image_url: str | None = Field(default=None, max_length=1024)

    @field_validator("title", "author")
    @classmethod
    def strip_required_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()

    @field_validator("book_description", "cover_image_url")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class BookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    book_id: int
    owner_id: int
    owner_full_name: str | None = None
    category_id: int
    title: str
    author: str
    book_description: str | None
    publication_year: int | None
    book_condition: BookCondition
    exchange_mode: ExchangeMode
    book_status: BookStatus
    created_at: datetime
    updated_at: datetime
    cover_image_url: str | None
    category: CategoryResponse | None = None


class BookCoverUploadResponse(BaseModel):
    book: BookResponse
    cover_image_url: str


class TopBookResponse(BaseModel):
    book_id: int
    title: str
    author: str
    cover_image_url: str | None
    category_name: str | None
    borrow_count: int


class TopCourierResponse(BaseModel):
    courier_id: int
    user_id: int
    full_name: str
    delivery_area: str
    courier_status: CourierStatus
    successful_delivery_count: int


class TopPointUserResponse(BaseModel):
    user_id: int
    full_name: str
    current_points: int


class CommunityLeaderboardResponse(BaseModel):
    top_books: list[TopBookResponse]
    top_couriers: list[TopCourierResponse]
    top_point_users: list[TopPointUserResponse]
