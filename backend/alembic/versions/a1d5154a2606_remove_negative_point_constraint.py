"""remove negative point constraint

Revision ID: a1d5154a2606
Revises: 20260602_0005
Create Date: 2026-06-03 15:17:49.600756
"""

from collections.abc import Sequence

from alembic import op


revision: str = "a1d5154a2606"
down_revision: str | None = "20260602_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Superseded by 20260604_0006. Keep this no-op stable for databases
    # that already recorded this revision when it was generated empty.
    pass


def downgrade() -> None:
    pass
