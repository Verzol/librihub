"""add delivery coordinates

Revision ID: 20260602_0004
Revises: 20260602_0003
Create Date: 2026-06-02 13:00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260602_0004"
down_revision: str | None = "20260602_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("DELIVERY", "courier_id", existing_type=sa.Integer(), nullable=True)
    op.alter_column("DELIVERY", "pickup_address", existing_type=sa.Text(), nullable=True)
    op.add_column("DELIVERY", sa.Column("pickup_lat", sa.Float(), nullable=True))
    op.add_column("DELIVERY", sa.Column("pickup_lng", sa.Float(), nullable=True))
    op.add_column("DELIVERY", sa.Column("receiver_lat", sa.Float(), nullable=True))
    op.add_column("DELIVERY", sa.Column("receiver_lng", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("DELIVERY", "receiver_lng")
    op.drop_column("DELIVERY", "receiver_lat")
    op.drop_column("DELIVERY", "pickup_lng")
    op.drop_column("DELIVERY", "pickup_lat")
    op.alter_column("DELIVERY", "pickup_address", existing_type=sa.Text(), nullable=False)
    op.alter_column("DELIVERY", "courier_id", existing_type=sa.Integer(), nullable=False)
