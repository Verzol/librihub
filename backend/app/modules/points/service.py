from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import ActivityType, PointLedgerReason, RoleInTransaction
from app.models.erd import ActivityLog, TransactionPointLedger, User


class InsufficientPointsError(Exception):
    pass


def list_my_ledger(db: Session, current_user: User) -> list[TransactionPointLedger]:
    statement = (
        select(TransactionPointLedger)
        .where(TransactionPointLedger.user_id == current_user.user_id)
        .order_by(TransactionPointLedger.created_at.desc(), TransactionPointLedger.ledger_id.desc())
    )
    return list(db.scalars(statement))


def add_point_change(
    db: Session,
    *,
    user: User,
    transaction_id: int | None,
    role_in_transaction: RoleInTransaction,
    point_change: int,
    reason: PointLedgerReason,
) -> TransactionPointLedger:
    points_before = user.current_points
    points_after = points_before + point_change
    if points_after < 0:
        raise InsufficientPointsError

    user.current_points = points_after
    ledger = TransactionPointLedger(
        transaction_id=transaction_id,
        user_id=user.user_id,
        role_in_transaction=role_in_transaction,
        points_before=points_before,
        point_change=point_change,
        points_after=points_after,
        reason=reason,
    )
    db.add(ledger)
    db.add(
        ActivityLog(
            user_id=user.user_id,
            activity_type=ActivityType.POINT_UPDATE,
            activity_description=f"Point balance changed by {point_change} for {reason.value}.",
        )
    )
    return ledger
