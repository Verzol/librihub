from fastapi import APIRouter, HTTPException, status

from app.core.dependencies import CurrentUser, DbSession
from app.modules.users.schemas import (
    CourierProfileCreateRequest,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserResponse,
)
from app.modules.users.service import (
    DuplicateCourierProfileError,
    DuplicateIdentityError,
    InactiveAccountError,
    InvalidCredentialsError,
    authenticate_user,
    register_courier_profile,
    register_member,
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
