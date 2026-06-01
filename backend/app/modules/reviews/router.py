from fastapi import APIRouter, HTTPException, status

from app.core.dependencies import CurrentUser, DbSession
from app.modules.reviews.schemas import ReviewCreateRequest, ReviewResponse
from app.modules.reviews.service import (
    DuplicateReviewError,
    ForbiddenReviewError,
    TransactionNotReviewableError,
    create_review,
    list_reviews_for_user,
)

router = APIRouter()


@router.post(
    "/reviews",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["reviews"],
)
def add_review(
    payload: ReviewCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> ReviewResponse:
    try:
        review = create_review(db, current_user, payload)
    except TransactionNotReviewableError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Reviews are allowed only after a completed transaction.",
        ) from None
    except ForbiddenReviewError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reviewer and reviewee must be valid transaction participants.",
        ) from None
    except DuplicateReviewError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A matching review already exists.",
        ) from None
    return ReviewResponse.model_validate(review)


@router.get("/users/{user_id}/reviews", response_model=list[ReviewResponse], tags=["reviews"])
def read_user_reviews(
    user_id: int,
    db: DbSession,
    current_user: CurrentUser,
) -> list[ReviewResponse]:
    return [ReviewResponse.model_validate(review) for review in list_reviews_for_user(db, user_id)]
