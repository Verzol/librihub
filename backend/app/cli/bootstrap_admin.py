import argparse
import os
import secrets
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.enums import AccountStatus, ActivityType, AdminStatus, UserRole
from app.models.erd import ActivityLog, AdminProfile, User

DEFAULT_ADMIN_EMAIL = "admin@librihub.local"
DEFAULT_ADMIN_FULL_NAME = "LibriHub Admin"
DEFAULT_ADMIN_PHONE = "0999999999"
DEFAULT_ADMIN_LEVEL = "GLOBAL"


@dataclass(frozen=True)
class BootstrapAdminResult:
    user: User
    created_user: bool
    created_profile: bool
    password_generated: bool
    plain_password: str | None


class BootstrapAdminError(Exception):
    pass


def bootstrap_admin(
    db: Session,
    *,
    email: str,
    password: str | None,
    full_name: str,
    phone: str,
    admin_level: str,
) -> BootstrapAdminResult:
    user = db.scalar(select(User).where(User.email == email))
    created_user = user is None
    created_profile = False
    generated_password = None

    if user is None:
        if password is None:
            generated_password = secrets.token_urlsafe(18)
            password = generated_password
        phone_owner = db.scalar(select(User).where(User.phone == phone))
        if phone_owner is not None:
            raise BootstrapAdminError(
                f"Phone {phone!r} already belongs to another account. "
                "Pass a different --phone value."
            )
        user = User(
            full_name=full_name,
            email=email,
            phone=phone,
            password_hash=hash_password(password),
            role=UserRole.ADMIN,
            current_points=0,
            account_status=AccountStatus.ACTIVE,
        )
        db.add(user)
        db.flush()
    else:
        conflicting_phone_owner = db.scalar(select(User).where(User.phone == phone))
        if conflicting_phone_owner is not None and conflicting_phone_owner.user_id != user.user_id:
            raise BootstrapAdminError(
                f"Phone {phone!r} already belongs to another account. "
                "Pass a different --phone value."
            )
        user.role = UserRole.ADMIN
        user.account_status = AccountStatus.ACTIVE
        if full_name:
            user.full_name = full_name
        if phone and user.phone != phone:
            user.phone = phone
        if password:
            user.password_hash = hash_password(password)

    admin_profile = db.scalar(select(AdminProfile).where(AdminProfile.user_id == user.user_id))
    if admin_profile is None:
        db.add(
            AdminProfile(
                user_id=user.user_id,
                admin_level=admin_level,
                admin_status=AdminStatus.ACTIVE,
            )
        )
        created_profile = True
    else:
        admin_profile.admin_level = admin_level
        admin_profile.admin_status = AdminStatus.ACTIVE

    if created_user:
        db.add(
            ActivityLog(
                user_id=user.user_id,
                activity_type=ActivityType.REGISTER,
                activity_description="Initial admin account bootstrapped.",
            )
        )

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise BootstrapAdminError("Could not bootstrap admin account due to a duplicate value.") from error

    db.refresh(user)
    return BootstrapAdminResult(
        user=user,
        created_user=created_user,
        created_profile=created_profile,
        password_generated=generated_password is not None,
        plain_password=generated_password,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap the first LibriHub admin account.")
    parser.add_argument("--email", default=os.getenv("LIBRIHUB_ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL))
    parser.add_argument("--password", default=os.getenv("LIBRIHUB_ADMIN_PASSWORD"))
    parser.add_argument(
        "--full-name",
        default=os.getenv("LIBRIHUB_ADMIN_FULL_NAME", DEFAULT_ADMIN_FULL_NAME),
    )
    parser.add_argument("--phone", default=os.getenv("LIBRIHUB_ADMIN_PHONE", DEFAULT_ADMIN_PHONE))
    parser.add_argument(
        "--admin-level",
        default=os.getenv("LIBRIHUB_ADMIN_LEVEL", DEFAULT_ADMIN_LEVEL),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    with SessionLocal() as db:
        result = bootstrap_admin(
            db,
            email=args.email,
            password=args.password,
            full_name=args.full_name,
            phone=args.phone,
            admin_level=args.admin_level,
        )

    action = "created" if result.created_user else "updated"
    print(f"Admin account {action}: {result.user.email}")
    print(f"User ID: {result.user.user_id}")
    print(f"Admin profile: {'created' if result.created_profile else 'active'}")
    if result.password_generated and result.plain_password:
        print(f"Generated password: {result.plain_password}")
    else:
        print("Password source: provided by argument or environment variable")


if __name__ == "__main__":
    main()
