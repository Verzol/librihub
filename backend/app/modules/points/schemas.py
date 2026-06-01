from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import PointLedgerReason, RoleInTransaction


class PointBalanceResponse(BaseModel):
    current_points: int


class PointLedgerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ledger_id: int
    transaction_id: int | None
    user_id: int
    role_in_transaction: RoleInTransaction
    points_before: int
    point_change: int
    points_after: int
    reason: PointLedgerReason
    created_at: datetime
