from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import (
    AccountStatus,
    ActivityType,
    AdminActionType,
    AdminStatus,
    BookCondition,
    BookStatus,
    CourierStatus,
    DeliveryMethod,
    DeliveryStatus,
    ExchangeMode,
    MembershipStatus,
    PointLedgerReason,
    ReviewType,
    RoleInTransaction,
    TransactionStatus,
    TransactionType,
    UserRole,
)


class User(Base):
    __tablename__ = "USER"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    phone: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum", native_enum=True),
        nullable=False,
        default=UserRole.MEMBER,
        server_default=UserRole.MEMBER.value,
    )
    current_points: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    account_status: Mapped[AccountStatus] = mapped_column(
        Enum(AccountStatus, name="account_status_enum", native_enum=True),
        nullable=False,
        default=AccountStatus.PENDING,
        server_default=AccountStatus.PENDING.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    member_profile: Mapped["MemberProfile | None"] = relationship(back_populates="user")
    courier_profile: Mapped["CourierProfile | None"] = relationship(back_populates="user")
    admin_profile: Mapped["AdminProfile | None"] = relationship(back_populates="user")

    __table_args__ = (
        CheckConstraint("current_points >= 0", name="ck_USER_current_points_nonnegative"),
        Index("ix_USER_email", "email"),
        Index("ix_USER_phone", "phone"),
    )


class MemberProfile(Base):
    __tablename__ = "MEMBER_PROFILE"

    member_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("USER.user_id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    student_code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    membership_status: Mapped[MembershipStatus] = mapped_column(
        Enum(MembershipStatus, name="membership_status_enum", native_enum=True),
        nullable=False,
        default=MembershipStatus.PENDING,
        server_default=MembershipStatus.PENDING.value,
    )
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user: Mapped[User] = relationship(back_populates="member_profile")

    __table_args__ = (Index("ix_MEMBER_PROFILE_user_id", "user_id"),)


class CourierProfile(Base):
    __tablename__ = "COURIER_PROFILE"

    courier_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("USER.user_id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    delivery_area: Mapped[str] = mapped_column(String(255), nullable=False)
    courier_status: Mapped[CourierStatus] = mapped_column(
        Enum(CourierStatus, name="courier_status_enum", native_enum=True),
        nullable=False,
        default=CourierStatus.PENDING,
        server_default=CourierStatus.PENDING.value,
    )
    successful_delivery_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    contact_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    vehicle_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    document_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    application_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("ADMIN_PROFILE.admin_id", ondelete="RESTRICT"),
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user: Mapped[User] = relationship(back_populates="courier_profile")

    __table_args__ = (
        CheckConstraint(
            "successful_delivery_count >= 0",
            name="ck_COURIER_PROFILE_successful_delivery_count_nonnegative",
        ),
        Index("ix_COURIER_PROFILE_user_id", "user_id"),
        Index("ix_COURIER_PROFILE_courier_status", "courier_status"),
    )


class AdminProfile(Base):
    __tablename__ = "ADMIN_PROFILE"

    admin_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("USER.user_id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    admin_level: Mapped[str] = mapped_column(String(64), nullable=False)
    admin_status: Mapped[AdminStatus] = mapped_column(
        Enum(AdminStatus, name="admin_status_enum", native_enum=True),
        nullable=False,
        default=AdminStatus.ACTIVE,
        server_default=AdminStatus.ACTIVE.value,
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user: Mapped[User] = relationship(back_populates="admin_profile")

    __table_args__ = (Index("ix_ADMIN_PROFILE_user_id", "user_id"),)


class Category(Base):
    __tablename__ = "CATEGORY"

    category_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    category_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    books: Mapped[list["Book"]] = relationship(back_populates="category")


class Book(Base):
    __tablename__ = "BOOK"

    book_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("USER.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("CATEGORY.category_id", ondelete="RESTRICT"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    author: Mapped[str] = mapped_column(String(255), nullable=False)
    book_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    publication_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    book_condition: Mapped[BookCondition] = mapped_column(
        Enum(BookCondition, name="book_condition_enum", native_enum=True),
        nullable=False,
    )
    exchange_mode: Mapped[ExchangeMode] = mapped_column(
        Enum(ExchangeMode, name="exchange_mode_enum", native_enum=True),
        nullable=False,
    )
    book_status: Mapped[BookStatus] = mapped_column(
        Enum(BookStatus, name="book_status_enum", native_enum=True),
        nullable=False,
        default=BookStatus.AVAILABLE,
        server_default=BookStatus.AVAILABLE.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    cover_image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    category: Mapped[Category] = relationship(back_populates="books")

    __table_args__ = (
        CheckConstraint(
            "publication_year IS NULL OR publication_year BETWEEN 0 AND 9999",
            name="ck_BOOK_publication_year_range",
        ),
        Index("ix_BOOK_title", "title"),
        Index("ix_BOOK_category_id", "category_id"),
        Index("ix_BOOK_owner_id", "owner_id"),
        Index("ix_BOOK_book_status", "book_status"),
    )


class Transaction(Base):
    __tablename__ = "TRANSACTION"

    transaction_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    book_id: Mapped[int] = mapped_column(
        ForeignKey("BOOK.book_id", ondelete="RESTRICT"),
        nullable=False,
    )
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("USER.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    requester_id: Mapped[int] = mapped_column(
        ForeignKey("USER.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType, name="transaction_type_enum", native_enum=True),
        nullable=False,
    )
    delivery_method: Mapped[DeliveryMethod] = mapped_column(
        Enum(DeliveryMethod, name="delivery_method_enum", native_enum=True),
        nullable=False,
    )
    transaction_status: Mapped[TransactionStatus] = mapped_column(
        Enum(TransactionStatus, name="transaction_status_enum", native_enum=True),
        nullable=False,
        default=TransactionStatus.PENDING,
        server_default=TransactionStatus.PENDING.value,
    )
    owner_confirmed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    requester_confirmed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    courier_confirmed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    borrow_duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    expected_return_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    borrowed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    return_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    late_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    late_fee_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    book: Mapped[Book] = relationship()
    owner: Mapped[User] = relationship(foreign_keys=[owner_id])
    requester: Mapped[User] = relationship(foreign_keys=[requester_id])

    @property
    def book_title(self) -> str | None:
        return self.book.title if self.book else None

    @property
    def book_author(self) -> str | None:
        return self.book.author if self.book else None

    @property
    def owner_full_name(self) -> str | None:
        return self.owner.full_name if self.owner else None

    @property
    def requester_full_name(self) -> str | None:
        return self.requester.full_name if self.requester else None

    __table_args__ = (
        CheckConstraint("owner_id <> requester_id", name="ck_TRANSACTION_owner_not_requester"),
        CheckConstraint(
            "borrow_duration_days IS NULL OR borrow_duration_days > 0",
            name="ck_TRANSACTION_borrow_duration_positive",
        ),
        CheckConstraint("late_days >= 0", name="ck_TRANSACTION_late_days_nonnegative"),
        CheckConstraint("late_fee_points >= 0", name="ck_TRANSACTION_late_fee_points_nonnegative"),
        Index("ix_TRANSACTION_owner_id", "owner_id"),
        Index("ix_TRANSACTION_requester_id", "requester_id"),
        Index("ix_TRANSACTION_transaction_status", "transaction_status"),
        Index("ix_TRANSACTION_book_id", "book_id"),
    )


class Delivery(Base):
    __tablename__ = "DELIVERY"

    delivery_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("TRANSACTION.transaction_id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    courier_id: Mapped[int | None] = mapped_column(
        ForeignKey("COURIER_PROFILE.courier_id", ondelete="RESTRICT"),
        nullable=True,
    )
    pickup_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    receiver_address: Mapped[str] = mapped_column(Text, nullable=False)
    pickup_lat: Mapped[float | None] = mapped_column(nullable=True)
    pickup_lng: Mapped[float | None] = mapped_column(nullable=True)
    receiver_lat: Mapped[float | None] = mapped_column(nullable=True)
    receiver_lng: Mapped[float | None] = mapped_column(nullable=True)
    delivery_status: Mapped[DeliveryStatus] = mapped_column(
        Enum(DeliveryStatus, name="delivery_status_enum", native_enum=True),
        nullable=False,
        default=DeliveryStatus.PENDING,
        server_default=DeliveryStatus.PENDING.value,
    )
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    picked_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expected_delivery_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_DELIVERY_transaction_id", "transaction_id"),
        Index("ix_DELIVERY_courier_id", "courier_id"),
        Index("ix_DELIVERY_delivery_status", "delivery_status"),
    )


class TransactionPointLedger(Base):
    __tablename__ = "TRANSACTION_POINT_LEDGER"

    ledger_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("TRANSACTION.transaction_id", ondelete="RESTRICT"),
        nullable=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("USER.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    role_in_transaction: Mapped[RoleInTransaction] = mapped_column(
        Enum(RoleInTransaction, name="role_in_transaction_enum", native_enum=True),
        nullable=False,
    )
    points_before: Mapped[int] = mapped_column(Integer, nullable=False)
    point_change: Mapped[int] = mapped_column(Integer, nullable=False)
    points_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[PointLedgerReason] = mapped_column(
        Enum(PointLedgerReason, name="point_ledger_reason_enum", native_enum=True),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        CheckConstraint(
            "points_after = points_before + point_change",
            name="ck_TRANSACTION_POINT_LEDGER_balance_math",
        ),
        Index("ix_TRANSACTION_POINT_LEDGER_transaction_id", "transaction_id"),
        Index("ix_TRANSACTION_POINT_LEDGER_user_id", "user_id"),
        Index("ix_TRANSACTION_POINT_LEDGER_created_at", "created_at"),
    )


class Review(Base):
    __tablename__ = "REVIEW"

    review_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("TRANSACTION.transaction_id", ondelete="RESTRICT"),
        nullable=False,
    )
    reviewer_user_id: Mapped[int] = mapped_column(
        ForeignKey("USER.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    reviewee_user_id: Mapped[int] = mapped_column(
        ForeignKey("USER.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    rating_score: Mapped[int] = mapped_column(Integer, nullable=False)
    review_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_type: Mapped[ReviewType] = mapped_column(
        Enum(ReviewType, name="review_type_enum", native_enum=True),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    transaction: Mapped[Transaction] = relationship()
    reviewer: Mapped[User] = relationship(foreign_keys=[reviewer_user_id])
    reviewee: Mapped[User] = relationship(foreign_keys=[reviewee_user_id])

    @property
    def reviewer_full_name(self) -> str | None:
        return self.reviewer.full_name if self.reviewer else None

    @property
    def reviewee_full_name(self) -> str | None:
        return self.reviewee.full_name if self.reviewee else None

    @property
    def book_title(self) -> str | None:
        return self.transaction.book_title if self.transaction else None

    @property
    def book_author(self) -> str | None:
        return self.transaction.book_author if self.transaction else None

    __table_args__ = (
        CheckConstraint("rating_score BETWEEN 1 AND 5", name="ck_REVIEW_rating_score_range"),
        CheckConstraint("reviewer_user_id <> reviewee_user_id", name="ck_REVIEW_not_self"),
        UniqueConstraint(
            "transaction_id",
            "reviewer_user_id",
            "reviewee_user_id",
            "review_type",
            name="uq_REVIEW_transaction_reviewer_reviewee_type",
        ),
        Index("ix_REVIEW_transaction_id", "transaction_id"),
        Index("ix_REVIEW_reviewee_user_id", "reviewee_user_id"),
    )


class ActivityLog(Base):
    __tablename__ = "ACTIVITY_LOG"

    activity_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("USER.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    activity_type: Mapped[ActivityType] = mapped_column(
        Enum(ActivityType, name="activity_type_enum", native_enum=True),
        nullable=False,
    )
    activity_description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_ACTIVITY_LOG_user_id", "user_id"),
        Index("ix_ACTIVITY_LOG_activity_type", "activity_type"),
        Index("ix_ACTIVITY_LOG_created_at", "created_at"),
    )


class AdminAction(Base):
    __tablename__ = "ADMIN_ACTION"

    admin_action_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_id: Mapped[int] = mapped_column(
        ForeignKey("ADMIN_PROFILE.admin_id", ondelete="RESTRICT"),
        nullable=False,
    )
    target_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("USER.user_id", ondelete="RESTRICT"),
        nullable=True,
    )
    action_type: Mapped[AdminActionType] = mapped_column(
        Enum(AdminActionType, name="admin_action_type_enum", native_enum=True),
        nullable=False,
    )
    action_description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_ADMIN_ACTION_admin_id", "admin_id"),
        Index("ix_ADMIN_ACTION_target_user_id", "target_user_id"),
        Index("ix_ADMIN_ACTION_action_type", "action_type"),
        Index("ix_ADMIN_ACTION_created_at", "created_at"),
    )
