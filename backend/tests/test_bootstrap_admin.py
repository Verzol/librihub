from collections.abc import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.cli.bootstrap_admin import BootstrapAdminError, bootstrap_admin
from app.core.security import hash_password, verify_password
from app.db.base import Base
from app.models import *  # noqa: F403
from app.models.enums import AccountStatus, AdminStatus, UserRole
from app.models.erd import AdminProfile, User


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_bootstrap_admin_creates_active_admin_user_and_profile(db: Session) -> None:
    result = bootstrap_admin(
        db,
        email="admin@librihub.local",
        password=None,
        full_name="LibriHub Admin",
        phone="0999999999",
        admin_level="GLOBAL",
    )

    assert result.created_user is True
    assert result.created_profile is True
    assert result.password_generated is True
    assert result.plain_password is not None
    assert result.user.role == UserRole.ADMIN
    assert result.user.account_status == AccountStatus.ACTIVE
    assert verify_password(result.plain_password, result.user.password_hash)

    profile = db.query(AdminProfile).filter(AdminProfile.user_id == result.user.user_id).one()
    assert profile.admin_level == "GLOBAL"
    assert profile.admin_status == AdminStatus.ACTIVE


def test_bootstrap_existing_admin_does_not_reset_password_without_password_arg(
    db: Session,
) -> None:
    original_hash = hash_password("OriginalPass123!")
    admin = User(
        full_name="Existing Admin",
        email="admin@librihub.local",
        phone="0999999999",
        password_hash=original_hash,
        role=UserRole.ADMIN,
        account_status=AccountStatus.ACTIVE,
    )
    db.add(admin)
    db.commit()

    result = bootstrap_admin(
        db,
        email="admin@librihub.local",
        password=None,
        full_name="Existing Admin",
        phone="0999999999",
        admin_level="GLOBAL",
    )

    assert result.created_user is False
    assert result.created_profile is True
    assert result.password_generated is False
    assert result.plain_password is None
    assert result.user.password_hash == original_hash


def test_bootstrap_admin_rejects_phone_owned_by_another_user(db: Session) -> None:
    db.add(
        User(
            full_name="Member",
            email="member@example.com",
            phone="0999999999",
            password_hash=hash_password("MemberPass123!"),
            role=UserRole.MEMBER,
            account_status=AccountStatus.ACTIVE,
        )
    )
    db.commit()

    with pytest.raises(BootstrapAdminError):
        bootstrap_admin(
            db,
            email="admin@librihub.local",
            password="AdminPass123!",
            full_name="LibriHub Admin",
            phone="0999999999",
            admin_level="GLOBAL",
        )
