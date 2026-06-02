from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import ReviewType


class ReviewCreateRequest(BaseModel):
    transaction_id: int
    reviewee_user_id: int
    rating_score: int = Field(ge=1, le=5)
    review_content: str | None = Field(default=None, max_length=5000)
    review_type: ReviewType

    @field_validator("review_content")
    @classmethod
    def strip_content(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    review_id: int
    transaction_id: int
    reviewer_user_id: int
    reviewer_full_name: str | None = None
    reviewee_user_id: int
    reviewee_full_name: str | None = None
    book_title: str | None = None
    book_author: str | None = None
    rating_score: int
    review_content: str | None
    review_type: ReviewType
    created_at: datetime
