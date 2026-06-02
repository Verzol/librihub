from fastapi import APIRouter, HTTPException, status

from app.core.dependencies import CurrentUser, DbSession
from app.modules.users.schemas import (
    CourierProfileCreateRequest,
    LoginRequest,
    ProfileUpdateRequest,
    PublicUserSummaryResponse,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserNotificationResponse,
    UserResponse,
)
from app.modules.users.service import (
    DuplicateCourierProfileError,
    DuplicateIdentityError,
    InactiveAccountError,
    InvalidCredentialsError,
    UserNotFoundError,
    authenticate_user,
    get_public_user_summary,
    list_user_notifications,
    register_courier_profile,
    register_member,
    update_member_profile,
)

router = APIRouter()


@router.post(
    "/auth/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["auth"],
)
def register(payload: RegisterRequest, db: DbSession) -> RegisterResponse:
    try:
        user, token = register_member(db, payload)
    except DuplicateIdentityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email, phone, or student code already exists.",
        ) from None

    return RegisterResponse(user=UserResponse.model_validate(user), access_token=token)


@router.post("/auth/login", response_model=TokenResponse, tags=["auth"])
def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    try:
        _, token = authenticate_user(db, payload)
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid login or password.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except InactiveAccountError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active.",
        ) from None

    return TokenResponse(access_token=token)


@router.get("/users/me", response_model=UserResponse, tags=["users"])
def read_current_user(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.get("/users/me/notifications", response_model=list[UserNotificationResponse], tags=["users"])
def read_my_notifications(db: DbSession, current_user: CurrentUser) -> list[UserNotificationResponse]:
    return [
        UserNotificationResponse.model_validate(notification)
        for notification in list_user_notifications(db, current_user)
    ]


@router.get("/users/{user_id}/summary", response_model=PublicUserSummaryResponse, tags=["users"])
def read_user_summary(user_id: int, db: DbSession, current_user: CurrentUser) -> PublicUserSummaryResponse:
    try:
        user = get_public_user_summary(db, user_id)
    except UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.") from None

    return PublicUserSummaryResponse(
        user_id=user.user_id,
        full_name=user.full_name,
        role=user.role,
        current_points=user.current_points,
        account_status=user.account_status,
        membership_status=user.member_profile.membership_status if user.member_profile else None,
        courier_status=user.courier_profile.courier_status if user.courier_profile else None,
        joined_at=user.created_at,
    )


@router.patch("/users/me/profile", response_model=UserResponse, tags=["users"])
def update_my_profile(
    payload: ProfileUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> UserResponse:
    try:
        user = update_member_profile(db, current_user, payload)
    except DuplicateIdentityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone or student code already exists.",
        ) from None
    return UserResponse.model_validate(user)


@router.post("/users/me/courier-profile", response_model=UserResponse, tags=["users"])
def create_my_courier_profile(
    payload: CourierProfileCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> UserResponse:
    try:
        user = register_courier_profile(db, current_user, payload)
    except DuplicateCourierProfileError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Courier profile already exists.",
        ) from None
    return UserResponse.model_validate(user)
