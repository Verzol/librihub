from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import (
    AccountStatus,
    ActivityType,
    CourierStatus,
    MembershipStatus,
    PointLedgerReason,
    RoleInTransaction,
    UserRole,
)
from app.models.erd import ActivityLog, CourierProfile, MemberProfile, TransactionPointLedger, User
from app.modules.users.schemas import CourierProfileCreateRequest, LoginRequest, ProfileUpdateRequest, RegisterRequest

INITIAL_MEMBER_POINTS = 20


class DuplicateIdentityError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class InactiveAccountError(Exception):
    pass


class DuplicateCourierProfileError(Exception):
    pass


class UserNotFoundError(Exception):
    pass


def get_user_by_id(db: Session, user_id: int) -> User | None:
    statement = (
        select(User)
        .options(
            selectinload(User.member_profile),
            selectinload(User.courier_profile),
            selectinload(User.admin_profile),
        )
        .where(User.user_id == user_id)
    )
    return db.scalar(statement)


def get_public_user_summary(db: Session, user_id: int) -> User:
    user = get_user_by_id(db, user_id)
    if user is None:
        raise UserNotFoundError
    return user


def register_member(db: Session, payload: RegisterRequest) -> tuple[User, str]:
    existing = db.scalar(
        select(User.user_id).where(or_(User.email == payload.email, User.phone == payload.phone))
    )
    existing_student = db.scalar(
        select(MemberProfile.member_id).where(MemberProfile.student_code == payload.student_code)
    )
    if existing is not None or existing_student is not None:
        raise DuplicateIdentityError

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role=UserRole.MEMBER,
        current_points=INITIAL_MEMBER_POINTS,
        account_status=AccountStatus.ACTIVE,
    )
    db.add(user)

    try:
        db.flush()
        db.add(
            MemberProfile(
                user_id=user.user_id,
                student_code=payload.student_code,
                address=payload.address,
                membership_status=MembershipStatus.ACTIVE,
            )
        )
        db.add(
            TransactionPointLedger(
                transaction_id=None,
                user_id=user.user_id,
                role_in_transaction=RoleInTransaction.SYSTEM,
                points_before=0,
                point_change=INITIAL_MEMBER_POINTS,
                points_after=INITIAL_MEMBER_POINTS,
                reason=PointLedgerReason.INITIAL_BONUS,
            )
        )
        db.add(
            ActivityLog(
                user_id=user.user_id,
                activity_type=ActivityType.REGISTER,
                activity_description="Member account registered with initial point bonus.",
            )
        )
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise DuplicateIdentityError from error

    created_user = get_user_by_id(db, user.user_id)
    if created_user is None:
        raise RuntimeError("Registered user could not be reloaded.")

    return created_user, create_access_token(str(created_user.user_id))


def authenticate_user(db: Session, payload: LoginRequest) -> tuple[User, str]:
    statement = select(User).where(or_(User.email == payload.login, User.phone == payload.login))
    user = db.scalar(statement)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise InvalidCredentialsError
    if user.account_status != AccountStatus.ACTIVE:
        raise InactiveAccountError

    db.add(
        ActivityLog(
            user_id=user.user_id,
            activity_type=ActivityType.LOGIN,
            activity_description="User logged in successfully.",
        )
    )
    db.commit()

    reloaded_user = get_user_by_id(db, user.user_id)
    if reloaded_user is None:
        raise RuntimeError("Authenticated user could not be reloaded.")

    return reloaded_user, create_access_token(str(reloaded_user.user_id))


def register_courier_profile(
    db: Session,
    current_user: User,
    payload: CourierProfileCreateRequest,
) -> User:
    existing = db.scalar(
        select(CourierProfile.courier_id).where(CourierProfile.user_id == current_user.user_id)
    )
    if existing is not None:
        raise DuplicateCourierProfileError

    courier_profile = CourierProfile(
        user_id=current_user.user_id,
        delivery_area=payload.delivery_area,
        courier_status=CourierStatus.PENDING,
        successful_delivery_count=0,
        contact_name=payload.contact_name,
        contact_phone=payload.contact_phone,
        contact_address=payload.contact_address,
        vehicle_type=payload.vehicle_type,
        document_url=payload.document_url,
        application_note=payload.application_note,
    )
    db.add(courier_profile)
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.UPDATE_PROFILE,
            activity_description="Courier application submitted for admin review.",
        )
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise DuplicateCourierProfileError from error

    user = get_user_by_id(db, current_user.user_id)
    if user is None:
        raise RuntimeError("Courier user could not be reloaded.")
    return user


def update_member_profile(
    db: Session,
    current_user: User,
    payload: ProfileUpdateRequest,
) -> User:
    # Check if new phone is duplicate
    if payload.phone is not None and payload.phone != current_user.phone:
        existing_phone = db.scalar(
            select(User.user_id).where(User.phone == payload.phone)
        )
        if existing_phone is not None:
            raise DuplicateIdentityError

    # Check if new student code is duplicate
    if payload.student_code is not None:
        if current_user.member_profile and payload.student_code != current_user.member_profile.student_code:
            existing_student = db.scalar(
                select(MemberProfile.member_id).where(MemberProfile.student_code == payload.student_code)
            )
            if existing_student is not None:
                raise DuplicateIdentityError

    # Update User fields
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.phone is not None:
        current_user.phone = payload.phone

    # Update MemberProfile fields
    if current_user.member_profile is not None:
        if payload.student_code is not None:
            current_user.member_profile.student_code = payload.student_code
        if payload.address is not None:
            current_user.member_profile.address = payload.address
    elif payload.student_code is not None or payload.address is not None:
        # If member profile doesn't exist but fields are provided, create it (edge case, usually shouldn't happen for valid users)
        db.add(
            MemberProfile(
                user_id=current_user.user_id,
                student_code=payload.student_code or "UNKNOWN",
                address=payload.address or "UNKNOWN",
                membership_status=MembershipStatus.ACTIVE,
            )
        )

    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.UPDATE_PROFILE,
            activity_description="User updated their profile information.",
        )
    )

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise DuplicateIdentityError from error

    updated_user = get_user_by_id(db, current_user.user_id)
    if updated_user is None:
        raise RuntimeError("Updated user could not be reloaded.")
    return updated_user
