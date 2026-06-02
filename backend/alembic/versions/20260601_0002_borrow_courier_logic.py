"""add borrow return and courier approval fields

Revision ID: 20260601_0002
Revises: 20260530_0001
Create Date: 2026-06-01 17:00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260601_0002"
down_revision: str | None = "20260530_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE book_status_enum ADD VALUE IF NOT EXISTS 'UNLISTED'")
    op.execute("ALTER TYPE transaction_status_enum ADD VALUE IF NOT EXISTS 'BORROWING'")
    op.execute("ALTER TYPE transaction_status_enum ADD VALUE IF NOT EXISTS 'RETURN_PENDING'")
    op.execute("ALTER TYPE point_ledger_reason_enum ADD VALUE IF NOT EXISTS 'LATE_RETURN_PENALTY'")

    op.add_column("TRANSACTION", sa.Column("borrow_duration_days", sa.Integer(), nullable=True))
    op.add_column(
        "TRANSACTION",
        sa.Column("expected_return_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("TRANSACTION", sa.Column("borrowed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "TRANSACTION",
        sa.Column("return_requested_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("TRANSACTION", sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "TRANSACTION",
        sa.Column("late_days", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "TRANSACTION",
        sa.Column("late_fee_points", sa.Integer(), server_default="0", nullable=False),
    )
    op.create_check_constraint(
        "ck_TRANSACTION_borrow_duration_positive",
        "TRANSACTION",
        "borrow_duration_days IS NULL OR borrow_duration_days > 0",
    )
    op.create_check_constraint(
        "ck_TRANSACTION_late_days_nonnegative",
        "TRANSACTION",
        "late_days >= 0",
    )
    op.create_check_constraint(
        "ck_TRANSACTION_late_fee_points_nonnegative",
        "TRANSACTION",
        "late_fee_points >= 0",
    )

    op.add_column(
        "DELIVERY",
        sa.Column("expected_delivery_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.add_column("COURIER_PROFILE", sa.Column("contact_name", sa.String(length=255), nullable=True))
    op.add_column("COURIER_PROFILE", sa.Column("contact_phone", sa.String(length=32), nullable=True))
    op.add_column("COURIER_PROFILE", sa.Column("contact_address", sa.Text(), nullable=True))
    op.add_column("COURIER_PROFILE", sa.Column("vehicle_type", sa.String(length=120), nullable=True))
    op.add_column("COURIER_PROFILE", sa.Column("document_url", sa.String(length=1024), nullable=True))
    op.add_column("COURIER_PROFILE", sa.Column("application_note", sa.Text(), nullable=True))
    op.add_column("COURIER_PROFILE", sa.Column("reviewed_by_admin_id", sa.Integer(), nullable=True))
    op.add_column(
        "COURIER_PROFILE",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("COURIER_PROFILE", sa.Column("review_note", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_COURIER_PROFILE_reviewed_by_admin_id_ADMIN_PROFILE",
        "COURIER_PROFILE",
        "ADMIN_PROFILE",
        ["reviewed_by_admin_id"],
        ["admin_id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_COURIER_PROFILE_reviewed_by_admin_id_ADMIN_PROFILE",
        "COURIER_PROFILE",
        type_="foreignkey",
    )
    op.drop_column("COURIER_PROFILE", "review_note")
    op.drop_column("COURIER_PROFILE", "reviewed_at")
    op.drop_column("COURIER_PROFILE", "reviewed_by_admin_id")
    op.drop_column("COURIER_PROFILE", "application_note")
    op.drop_column("COURIER_PROFILE", "document_url")
    op.drop_column("COURIER_PROFILE", "vehicle_type")
    op.drop_column("COURIER_PROFILE", "contact_address")
    op.drop_column("COURIER_PROFILE", "contact_phone")
    op.drop_column("COURIER_PROFILE", "contact_name")

    op.drop_column("DELIVERY", "expected_delivery_at")

    op.drop_constraint("ck_TRANSACTION_late_fee_points_nonnegative", "TRANSACTION", type_="check")
    op.drop_constraint("ck_TRANSACTION_late_days_nonnegative", "TRANSACTION", type_="check")
    op.drop_constraint("ck_TRANSACTION_borrow_duration_positive", "TRANSACTION", type_="check")
    op.drop_column("TRANSACTION", "late_fee_points")
    op.drop_column("TRANSACTION", "late_days")
    op.drop_column("TRANSACTION", "returned_at")
    op.drop_column("TRANSACTION", "return_requested_at")
    op.drop_column("TRANSACTION", "borrowed_at")
    op.drop_column("TRANSACTION", "expected_return_at")
    op.drop_column("TRANSACTION", "borrow_duration_days")
    # PostgreSQL enum values are intentionally retained on downgrade.
