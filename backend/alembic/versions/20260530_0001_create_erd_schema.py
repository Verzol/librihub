"""create ERD schema

Revision ID: 20260530_0001
Revises:
Create Date: 2026-05-30 00:01:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260530_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


account_status_enum = postgresql.ENUM(
    "PENDING", "ACTIVE", "LOCKED", "INACTIVE", name="account_status_enum"
)
user_role_enum = postgresql.ENUM("USER", "MEMBER", "COURIER", "ADMIN", name="user_role_enum")
membership_status_enum = postgresql.ENUM(
    "PENDING", "ACTIVE", "SUSPENDED", "INACTIVE", name="membership_status_enum"
)
courier_status_enum = postgresql.ENUM(
    "PENDING", "AVAILABLE", "BUSY", "SUSPENDED", "INACTIVE", name="courier_status_enum"
)
admin_status_enum = postgresql.ENUM(
    "ACTIVE", "SUSPENDED", "INACTIVE", name="admin_status_enum"
)
book_condition_enum = postgresql.ENUM("NEW", "GOOD", "FAIR", "WORN", name="book_condition_enum")
exchange_mode_enum = postgresql.ENUM(
    "PERMANENT_EXCHANGE", "BORROW_RETURN", "BOTH", name="exchange_mode_enum"
)
book_status_enum = postgresql.ENUM(
    "AVAILABLE",
    "PENDING_TRANSACTION",
    "BORROWED",
    "EXCHANGED",
    "REMOVED",
    name="book_status_enum",
)
transaction_type_enum = postgresql.ENUM(
    "PERMANENT_EXCHANGE", "BORROW_RETURN", name="transaction_type_enum"
)
delivery_method_enum = postgresql.ENUM(
    "DIRECT_CONTACT", "FREE_COURIER", name="delivery_method_enum"
)
transaction_status_enum = postgresql.ENUM(
    "PENDING",
    "ACCEPTED",
    "DELIVERING",
    "COMPLETED",
    "CANCELLED",
    "REJECTED",
    name="transaction_status_enum",
)
delivery_status_enum = postgresql.ENUM(
    "PENDING",
    "ASSIGNED",
    "PICKED_UP",
    "DELIVERED",
    "FAILED",
    "CANCELLED",
    name="delivery_status_enum",
)
role_in_transaction_enum = postgresql.ENUM(
    "OWNER", "REQUESTER", "COURIER", "SYSTEM", "ADMIN", name="role_in_transaction_enum"
)
point_ledger_reason_enum = postgresql.ENUM(
    "INITIAL_BONUS",
    "EXCHANGE_REWARD",
    "EXCHANGE_COST",
    "BORROW_REWARD",
    "BORROW_COST",
    "DELIVERY_REWARD",
    "ADMIN_ADJUSTMENT",
    name="point_ledger_reason_enum",
)
review_type_enum = postgresql.ENUM(
    "OWNER_REVIEW", "REQUESTER_REVIEW", "COURIER_REVIEW", name="review_type_enum"
)
activity_type_enum = postgresql.ENUM(
    "REGISTER",
    "LOGIN",
    "UPDATE_PROFILE",
    "CREATE_BOOK",
    "UPDATE_BOOK",
    "CREATE_TRANSACTION",
    "CONFIRM_TRANSACTION",
    "DELIVERY_UPDATE",
    "CREATE_REVIEW",
    "POINT_UPDATE",
    name="activity_type_enum",
)
admin_action_type_enum = postgresql.ENUM(
    "LOCK_USER",
    "UNLOCK_USER",
    "HIDE_BOOK",
    "RESTORE_BOOK",
    "CANCEL_TRANSACTION",
    "HIDE_REVIEW",
    "POINT_ADJUSTMENT",
    "OTHER",
    name="admin_action_type_enum",
)

ENUMS = (
    account_status_enum,
    user_role_enum,
    membership_status_enum,
    courier_status_enum,
    admin_status_enum,
    book_condition_enum,
    exchange_mode_enum,
    book_status_enum,
    transaction_type_enum,
    delivery_method_enum,
    transaction_status_enum,
    delivery_status_enum,
    role_in_transaction_enum,
    point_ledger_reason_enum,
    review_type_enum,
    activity_type_enum,
    admin_action_type_enum,
)


def upgrade() -> None:
    bind = op.get_bind()
    for enum in ENUMS:
        enum.create(bind, checkfirst=True)

    op.create_table(
        "USER",
        sa.Column("user_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            postgresql.ENUM(name="user_role_enum", create_type=False),
            server_default="MEMBER",
            nullable=False,
        ),
        sa.Column("current_points", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "account_status",
            postgresql.ENUM(name="account_status_enum", create_type=False),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("current_points >= 0", name="ck_USER_current_points_nonnegative"),
        sa.UniqueConstraint("email", name="uq_USER_email"),
        sa.UniqueConstraint("phone", name="uq_USER_phone"),
    )
    op.create_index("ix_USER_email", "USER", ["email"])
    op.create_index("ix_USER_phone", "USER", ["phone"])

    op.create_table(
        "CATEGORY",
        sa.Column("category_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("category_name", sa.String(length=120), nullable=False),
        sa.Column("category_description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.UniqueConstraint("category_name", name="uq_CATEGORY_category_name"),
    )

    op.create_table(
        "MEMBER_PROFILE",
        sa.Column("member_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("student_code", sa.String(length=64), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column(
            "membership_status",
            postgresql.ENUM(name="membership_status_enum", create_type=False),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column(
            "registered_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["USER.user_id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("student_code", name="uq_MEMBER_PROFILE_student_code"),
        sa.UniqueConstraint("user_id", name="uq_MEMBER_PROFILE_user_id"),
    )
    op.create_index("ix_MEMBER_PROFILE_user_id", "MEMBER_PROFILE", ["user_id"])

    op.create_table(
        "COURIER_PROFILE",
        sa.Column("courier_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("delivery_area", sa.String(length=255), nullable=False),
        sa.Column(
            "courier_status",
            postgresql.ENUM(name="courier_status_enum", create_type=False),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column("successful_delivery_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "registered_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "successful_delivery_count >= 0",
            name="ck_COURIER_PROFILE_successful_delivery_count_nonnegative",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["USER.user_id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("user_id", name="uq_COURIER_PROFILE_user_id"),
    )
    op.create_index("ix_COURIER_PROFILE_user_id", "COURIER_PROFILE", ["user_id"])
    op.create_index(
        "ix_COURIER_PROFILE_courier_status", "COURIER_PROFILE", ["courier_status"]
    )

    op.create_table(
        "ADMIN_PROFILE",
        sa.Column("admin_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("admin_level", sa.String(length=64), nullable=False),
        sa.Column(
            "admin_status",
            postgresql.ENUM(name="admin_status_enum", create_type=False),
            server_default="ACTIVE",
            nullable=False,
        ),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["USER.user_id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("user_id", name="uq_ADMIN_PROFILE_user_id"),
    )
    op.create_index("ix_ADMIN_PROFILE_user_id", "ADMIN_PROFILE", ["user_id"])

    op.create_table(
        "BOOK",
        sa.Column("book_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=False),
        sa.Column("publication_year", sa.Integer(), nullable=True),
        sa.Column(
            "book_condition",
            postgresql.ENUM(name="book_condition_enum", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "exchange_mode",
            postgresql.ENUM(name="exchange_mode_enum", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "book_status",
            postgresql.ENUM(name="book_status_enum", create_type=False),
            server_default="AVAILABLE",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("cover_image_url", sa.String(length=1024), nullable=True),
        sa.CheckConstraint(
            "publication_year IS NULL OR publication_year BETWEEN 0 AND 9999",
            name="ck_BOOK_publication_year_range",
        ),
        sa.ForeignKeyConstraint(["category_id"], ["CATEGORY.category_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["owner_id"], ["USER.user_id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_BOOK_title", "BOOK", ["title"])
    op.create_index("ix_BOOK_category_id", "BOOK", ["category_id"])
    op.create_index("ix_BOOK_owner_id", "BOOK", ["owner_id"])
    op.create_index("ix_BOOK_book_status", "BOOK", ["book_status"])

    op.create_table(
        "TRANSACTION",
        sa.Column("transaction_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("requester_id", sa.Integer(), nullable=False),
        sa.Column(
            "transaction_type",
            postgresql.ENUM(name="transaction_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "delivery_method",
            postgresql.ENUM(name="delivery_method_enum", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "transaction_status",
            postgresql.ENUM(name="transaction_status_enum", create_type=False),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column("owner_confirmed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "requester_confirmed",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "courier_confirmed",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("owner_id <> requester_id", name="ck_TRANSACTION_owner_not_requester"),
        sa.ForeignKeyConstraint(["book_id"], ["BOOK.book_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["owner_id"], ["USER.user_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requester_id"], ["USER.user_id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_TRANSACTION_owner_id", "TRANSACTION", ["owner_id"])
    op.create_index("ix_TRANSACTION_requester_id", "TRANSACTION", ["requester_id"])
    op.create_index(
        "ix_TRANSACTION_transaction_status", "TRANSACTION", ["transaction_status"]
    )
    op.create_index("ix_TRANSACTION_book_id", "TRANSACTION", ["book_id"])

    op.create_table(
        "DELIVERY",
        sa.Column("delivery_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=False),
        sa.Column("courier_id", sa.Integer(), nullable=False),
        sa.Column("pickup_address", sa.Text(), nullable=False),
        sa.Column("receiver_address", sa.Text(), nullable=False),
        sa.Column(
            "delivery_status",
            postgresql.ENUM(name="delivery_status_enum", create_type=False),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("picked_up_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["courier_id"], ["COURIER_PROFILE.courier_id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["TRANSACTION.transaction_id"], ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("transaction_id", name="uq_DELIVERY_transaction_id"),
    )
    op.create_index("ix_DELIVERY_transaction_id", "DELIVERY", ["transaction_id"])
    op.create_index("ix_DELIVERY_courier_id", "DELIVERY", ["courier_id"])
    op.create_index("ix_DELIVERY_delivery_status", "DELIVERY", ["delivery_status"])

    op.create_table(
        "TRANSACTION_POINT_LEDGER",
        sa.Column("ledger_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "role_in_transaction",
            postgresql.ENUM(name="role_in_transaction_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("points_before", sa.Integer(), nullable=False),
        sa.Column("point_change", sa.Integer(), nullable=False),
        sa.Column("points_after", sa.Integer(), nullable=False),
        sa.Column(
            "reason",
            postgresql.ENUM(name="point_ledger_reason_enum", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "points_after = points_before + point_change",
            name="ck_TRANSACTION_POINT_LEDGER_balance_math",
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["TRANSACTION.transaction_id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["USER.user_id"], ondelete="RESTRICT"),
    )
    op.create_index(
        "ix_TRANSACTION_POINT_LEDGER_transaction_id",
        "TRANSACTION_POINT_LEDGER",
        ["transaction_id"],
    )
    op.create_index(
        "ix_TRANSACTION_POINT_LEDGER_user_id", "TRANSACTION_POINT_LEDGER", ["user_id"]
    )
    op.create_index(
        "ix_TRANSACTION_POINT_LEDGER_created_at", "TRANSACTION_POINT_LEDGER", ["created_at"]
    )

    op.create_table(
        "REVIEW",
        sa.Column("review_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=False),
        sa.Column("reviewer_user_id", sa.Integer(), nullable=False),
        sa.Column("reviewee_user_id", sa.Integer(), nullable=False),
        sa.Column("rating_score", sa.Integer(), nullable=False),
        sa.Column("review_content", sa.Text(), nullable=True),
        sa.Column(
            "review_type",
            postgresql.ENUM(name="review_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("rating_score BETWEEN 1 AND 5", name="ck_REVIEW_rating_score_range"),
        sa.CheckConstraint("reviewer_user_id <> reviewee_user_id", name="ck_REVIEW_not_self"),
        sa.ForeignKeyConstraint(
            ["reviewee_user_id"], ["USER.user_id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_user_id"], ["USER.user_id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["TRANSACTION.transaction_id"], ondelete="RESTRICT"
        ),
        sa.UniqueConstraint(
            "transaction_id",
            "reviewer_user_id",
            "reviewee_user_id",
            "review_type",
            name="uq_REVIEW_transaction_reviewer_reviewee_type",
        ),
    )
    op.create_index("ix_REVIEW_transaction_id", "REVIEW", ["transaction_id"])
    op.create_index("ix_REVIEW_reviewee_user_id", "REVIEW", ["reviewee_user_id"])

    op.create_table(
        "ACTIVITY_LOG",
        sa.Column("activity_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "activity_type",
            postgresql.ENUM(name="activity_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("activity_description", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["USER.user_id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_ACTIVITY_LOG_user_id", "ACTIVITY_LOG", ["user_id"])
    op.create_index("ix_ACTIVITY_LOG_activity_type", "ACTIVITY_LOG", ["activity_type"])
    op.create_index("ix_ACTIVITY_LOG_created_at", "ACTIVITY_LOG", ["created_at"])

    op.create_table(
        "ADMIN_ACTION",
        sa.Column("admin_action_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("admin_id", sa.Integer(), nullable=False),
        sa.Column("target_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "action_type",
            postgresql.ENUM(name="admin_action_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("action_description", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["admin_id"], ["ADMIN_PROFILE.admin_id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["target_user_id"], ["USER.user_id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_ADMIN_ACTION_admin_id", "ADMIN_ACTION", ["admin_id"])
    op.create_index("ix_ADMIN_ACTION_target_user_id", "ADMIN_ACTION", ["target_user_id"])
    op.create_index("ix_ADMIN_ACTION_action_type", "ADMIN_ACTION", ["action_type"])
    op.create_index("ix_ADMIN_ACTION_created_at", "ADMIN_ACTION", ["created_at"])

    category_table = sa.table(
        "CATEGORY",
        sa.column("category_name", sa.String),
        sa.column("category_description", sa.Text),
        sa.column("is_active", sa.Boolean),
    )
    op.bulk_insert(
        category_table,
        [
            {
                "category_name": "Công nghệ thông tin",
                "category_description": "Danh mục sách về công nghệ thông tin.",
                "is_active": True,
            },
            {
                "category_name": "Tiểu thuyết",
                "category_description": "Danh mục sách tiểu thuyết và văn học.",
                "is_active": True,
            },
            {
                "category_name": "Kỹ năng mềm",
                "category_description": "Danh mục sách về kỹ năng mềm.",
                "is_active": True,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_ADMIN_ACTION_created_at", table_name="ADMIN_ACTION")
    op.drop_index("ix_ADMIN_ACTION_action_type", table_name="ADMIN_ACTION")
    op.drop_index("ix_ADMIN_ACTION_target_user_id", table_name="ADMIN_ACTION")
    op.drop_index("ix_ADMIN_ACTION_admin_id", table_name="ADMIN_ACTION")
    op.drop_table("ADMIN_ACTION")

    op.drop_index("ix_ACTIVITY_LOG_created_at", table_name="ACTIVITY_LOG")
    op.drop_index("ix_ACTIVITY_LOG_activity_type", table_name="ACTIVITY_LOG")
    op.drop_index("ix_ACTIVITY_LOG_user_id", table_name="ACTIVITY_LOG")
    op.drop_table("ACTIVITY_LOG")

    op.drop_index("ix_REVIEW_reviewee_user_id", table_name="REVIEW")
    op.drop_index("ix_REVIEW_transaction_id", table_name="REVIEW")
    op.drop_table("REVIEW")

    op.drop_index("ix_TRANSACTION_POINT_LEDGER_created_at", table_name="TRANSACTION_POINT_LEDGER")
    op.drop_index("ix_TRANSACTION_POINT_LEDGER_user_id", table_name="TRANSACTION_POINT_LEDGER")
    op.drop_index(
        "ix_TRANSACTION_POINT_LEDGER_transaction_id", table_name="TRANSACTION_POINT_LEDGER"
    )
    op.drop_table("TRANSACTION_POINT_LEDGER")

    op.drop_index("ix_DELIVERY_delivery_status", table_name="DELIVERY")
    op.drop_index("ix_DELIVERY_courier_id", table_name="DELIVERY")
    op.drop_index("ix_DELIVERY_transaction_id", table_name="DELIVERY")
    op.drop_table("DELIVERY")

    op.drop_index("ix_TRANSACTION_book_id", table_name="TRANSACTION")
    op.drop_index("ix_TRANSACTION_transaction_status", table_name="TRANSACTION")
    op.drop_index("ix_TRANSACTION_requester_id", table_name="TRANSACTION")
    op.drop_index("ix_TRANSACTION_owner_id", table_name="TRANSACTION")
    op.drop_table("TRANSACTION")

    op.drop_index("ix_BOOK_book_status", table_name="BOOK")
    op.drop_index("ix_BOOK_owner_id", table_name="BOOK")
    op.drop_index("ix_BOOK_category_id", table_name="BOOK")
    op.drop_index("ix_BOOK_title", table_name="BOOK")
    op.drop_table("BOOK")

    op.drop_index("ix_ADMIN_PROFILE_user_id", table_name="ADMIN_PROFILE")
    op.drop_table("ADMIN_PROFILE")

    op.drop_index("ix_COURIER_PROFILE_courier_status", table_name="COURIER_PROFILE")
    op.drop_index("ix_COURIER_PROFILE_user_id", table_name="COURIER_PROFILE")
    op.drop_table("COURIER_PROFILE")

    op.drop_index("ix_MEMBER_PROFILE_user_id", table_name="MEMBER_PROFILE")
    op.drop_table("MEMBER_PROFILE")

    op.drop_table("CATEGORY")

    op.drop_index("ix_USER_phone", table_name="USER")
    op.drop_index("ix_USER_email", table_name="USER")
    op.drop_table("USER")

    bind = op.get_bind()
    for enum in reversed(ENUMS):
        enum.drop(bind, checkfirst=True)
