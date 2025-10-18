"""
User API routes for authentication and user management.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.api.v1.users.repository import UserRepository
from app.api.v1.users.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    ResetPasswordConfirm,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserUpdate,
    UserResponse,
    UserRole,
)
from app.api.v1.users.services import UserService
from app.core.security import decode_access_token

router = APIRouter(prefix="/users", tags=["users"])
security = HTTPBearer()


def get_user_service() -> UserService:
    """Dependency injection for user service."""
    repository = UserRepository()
    return UserService(repository)


async def get_current_user_email(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> str:
    """
    Dependency to extract and validate current user from JWT token.

    Args:
        credentials: HTTP Bearer token from Authorization header

    Returns:
        User email from token

    Raises:
        HTTPException: If token is invalid or missing
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    return email


@router.get("/installation-status")
async def check_installation_status(
    service: Annotated[UserService, Depends(get_user_service)],
) -> dict:
    """
    Check if the system has been initialized (any users exist).

    Returns:
        Dictionary with 'needs_setup' boolean indicating if setup wizard should be shown
    """
    return await service.check_installation_status()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserResponse:
    """
    Register a new user.

    If this is the first user (installation), they will be created as admin.

    Args:
        user_data: User registration information
        service: User service instance

    Returns:
        Created user information
    """
    return await service.register_user(user_data)


@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    service: Annotated[UserService, Depends(get_user_service)],
) -> Token:
    """
    Authenticate user and return JWT token.

    Args:
        login_data: Login credentials
        service: User service instance

    Returns:
        JWT access token
    """
    return await service.login(login_data)


@router.put("/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    service: Annotated[UserService, Depends(get_user_service)],
) -> dict:
    """
    Change password for authenticated user.

    Args:
        password_data: Current and new password
        current_user_email: Email of authenticated user
        service: User service instance

    Returns:
        Success message
    """
    return await service.change_password(current_user_email, password_data)


@router.post("/reset-password-request")
async def reset_password_request(
    reset_data: ResetPasswordRequest,
    service: Annotated[UserService, Depends(get_user_service)],
) -> dict:
    """
    Request password reset token.

    Args:
        reset_data: Email for password reset
        service: User service instance

    Returns:
        Success message (and token in development)
    """
    return await service.request_password_reset(reset_data)


@router.post("/reset-password-confirm")
async def reset_password_confirm(
    reset_data: ResetPasswordConfirm,
    service: Annotated[UserService, Depends(get_user_service)],
) -> dict:
    """
    Confirm password reset with token.

    Args:
        reset_data: Email, token, and new password
        service: User service instance

    Returns:
        Success message
    """
    return await service.confirm_password_reset(reset_data)


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserResponse:
    """
    Get current authenticated user information.

    Args:
        current_user_email: Email from JWT token
        service: User service instance

    Returns:
        Current user information
    """
    user = await service.get_current_user(current_user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        profile_picture=user.profile_picture,
        timezone=user.timezone,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    update_data: UserUpdate,
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserResponse:
    """
    Update current authenticated user information.

    Args:
        update_data: User update data (full_name, profile_picture, timezone)
        current_user_email: Email from JWT token
        service: User service instance

    Returns:
        Updated user information
    """
    user = await service.update_user_profile(current_user_email, update_data)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        profile_picture=user.profile_picture,
        timezone=user.timezone,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )
