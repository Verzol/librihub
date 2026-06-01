from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.enums import ActivityType, ReviewType, TransactionStatus
from app.models.erd import ActivityLog, CourierProfile, Delivery, Review, Transaction, User
from app.modules.reviews.schemas import ReviewCreateRequest


class ReviewNotFoundError(Exception):
    pass


class TransactionNotReviewableError(Exception):
    pass


class ForbiddenReviewError(Exception):
    pass


class DuplicateReviewError(Exception):
    pass


def create_review(db: Session, current_user: User, payload: ReviewCreateRequest) -> Review:
    transaction = db.scalar(
        select(Transaction).where(Transaction.transaction_id == payload.transaction_id)
    )
    if transaction is None or transaction.transaction_status != TransactionStatus.COMPLETED:
        raise TransactionNotReviewableError

    participant_user_ids = _get_participant_user_ids(db, transaction)
    if current_user.user_id not in participant_user_ids:
        raise ForbiddenReviewError
    if payload.reviewee_user_id not in participant_user_ids:
        raise ForbiddenReviewError
    if payload.reviewee_user_id == current_user.user_id:
        raise ForbiddenReviewError
    if not _review_type_matches_reviewee(db, transaction, payload):
        raise ForbiddenReviewError

    review = Review(
        transaction_id=transaction.transaction_id,
        reviewer_user_id=current_user.user_id,
        reviewee_user_id=payload.reviewee_user_id,
        rating_score=payload.rating_score,
        review_content=payload.review_content,
        review_type=payload.review_type,
    )
    db.add(review)
    try:
        db.flush()
        db.add(
            ActivityLog(
                user_id=current_user.user_id,
                activity_type=ActivityType.CREATE_REVIEW,
                activity_description=(
                    f"Created review #{review.review_id} for transaction "
                    f"#{transaction.transaction_id}."
                ),
            )
        )
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise DuplicateReviewError from error
    db.refresh(review)
    return review


def list_reviews_for_user(db: Session, user_id: int) -> list[Review]:
    statement = (
        select(Review)
        .where(Review.reviewee_user_id == user_id)
        .order_by(Review.created_at.desc(), Review.review_id.desc())
    )
    return list(db.scalars(statement))


def _get_participant_user_ids(db: Session, transaction: Transaction) -> set[int]:
    participants = {transaction.owner_id, transaction.requester_id}
    courier_user_id = _get_transaction_courier_user_id(db, transaction.transaction_id)
    if courier_user_id is not None:
        participants.add(courier_user_id)
    return participants


def _get_transaction_courier_user_id(db: Session, transaction_id: int) -> int | None:
    statement = (
        select(CourierProfile.user_id)
        .join(Delivery, Delivery.courier_id == CourierProfile.courier_id)
        .where(Delivery.transaction_id == transaction_id)
    )
    return db.scalar(statement)


def _review_type_matches_reviewee(
    db: Session,
    transaction: Transaction,
    payload: ReviewCreateRequest,
) -> bool:
    if payload.review_type == ReviewType.OWNER_REVIEW:
        return payload.reviewee_user_id == transaction.owner_id
    if payload.review_type == ReviewType.REQUESTER_REVIEW:
        return payload.reviewee_user_id == transaction.requester_id

    courier_user_id = _get_transaction_courier_user_id(db, transaction.transaction_id)
    return courier_user_id is not None and payload.reviewee_user_id == courier_user_id
