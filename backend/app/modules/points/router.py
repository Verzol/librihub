from fastapi import APIRouter

from app.core.dependencies import CurrentUser, DbSession
from app.modules.points.schemas import PointBalanceResponse, PointLedgerResponse
from app.modules.points.service import list_my_ledger

router = APIRouter()


@router.get("/points/me", response_model=PointBalanceResponse, tags=["points"])
def read_my_points(current_user: CurrentUser) -> PointBalanceResponse:
    return PointBalanceResponse(current_points=current_user.current_points)


@router.get("/points/me/ledger", response_model=list[PointLedgerResponse], tags=["points"])
def read_my_point_ledger(db: DbSession, current_user: CurrentUser) -> list[PointLedgerResponse]:
    return [PointLedgerResponse.model_validate(entry) for entry in list_my_ledger(db, current_user)]
