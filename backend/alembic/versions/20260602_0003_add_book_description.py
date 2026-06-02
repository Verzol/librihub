"""add book description

Revision ID: 20260602_0003
Revises: 20260601_0002
Create Date: 2026-06-02 12:00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260602_0003"
down_revision: str | None = "20260601_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("BOOK", sa.Column("book_description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("BOOK", "book_description")
