"""drop USER current_points nonnegative check

Revision ID: 20260604_0006
Revises: a1d5154a2606
Create Date: 2026-06-04 18:45:00
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260604_0006"
down_revision: str | None = "a1d5154a2606"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute('ALTER TABLE "USER" DROP CONSTRAINT IF EXISTS ck_USER_current_points_nonnegative')


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'ck_USER_current_points_nonnegative'
            ) THEN
                ALTER TABLE "USER"
                ADD CONSTRAINT ck_USER_current_points_nonnegative
                CHECK (current_points >= 0);
            END IF;
        END
        $$;
        """
    )
