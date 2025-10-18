"""
User service layer implementing business logic.
"""
import secrets
import time
from typing import Optional

from fastapi import HTTPException, status

from app.api.v1.users.interfaces import IUserRepository
from app.api.v1.users.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    ResetPasswordConfirm,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserUpdate,
    UserInDB,
    UserResponse,
)
from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)


class UserService:
    """Service class handling user business logic."""

    def __init__(self, repository: IUserRepository):
        """
        Initialize user service with repository.

        Args:
            repository: User repository implementation
        """
        self.repository = repository

    async def register_user(self, user_data: UserCreate) -> UserResponse:
        """
        Register a new user.

        Args:
            user_data: User registration data

        Returns:
            Created user information

        Raises:
            HTTPException: If user already exists
        """
        existing_user = await self.repository.get_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists",
            )

        user = await self.repository.create(user_data)

        return UserResponse(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            created_at=user.created_at,
        )

    async def login(self, login_data: LoginRequest) -> Token:
        """
        Authenticate user and generate access token.

        Args:
            login_data: Login credentials

        Returns:
            JWT access token

        Raises:
            HTTPException: If credentials are invalid
        """
        user = await self.repository.get_by_email(login_data.email)
        if not user or not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user",
            )

        access_token = create_access_token(subject=user.email)
        return Token(access_token=access_token)

    async def change_password(
        self, user_email: str, password_data: ChangePasswordRequest
    ) -> dict:
        """
        Change user password (authenticated endpoint).

        Args:
            user_email: Email of authenticated user
            password_data: Current and new password

        Returns:
            Success message

        Raises:
            HTTPException: If current password is incorrect
        """
        user = await self.repository.get_by_email(user_email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if not verify_password(password_data.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect current password",
            )

        new_hashed_password = get_password_hash(password_data.new_password)
        await self.repository.update_password(str(user.id), new_hashed_password)

        return {"message": "Password changed successfully"}

    async def request_password_reset(self, reset_data: ResetPasswordRequest) -> dict:
        """
        Request password reset token.

        Args:
            reset_data: Email for password reset

        Returns:
            Success message and reset token

        Note:
            In production, send token via email instead of returning it
        """
        user = await self.repository.get_by_email(reset_data.email)
        if not user:
            # Return success to prevent user enumeration
            return {
                "message": "If the email exists, a reset token has been sent",
                "token": None,
            }

        # Generate secure reset token
        reset_token = secrets.token_urlsafe(32)
        expires_at = time.time() + 3600  # 1 hour expiration

        await self.repository.save_reset_token(
            reset_data.email, reset_token, expires_at
        )

        # TODO: Send email with reset token in production
        # For development, return the token
        return {
            "message": "If the email exists, a reset token has been sent",
            "token": reset_token,  # Remove this in production
        }

    async def confirm_password_reset(self, reset_data: ResetPasswordConfirm) -> dict:
        """
        Confirm password reset with token.

        Args:
            reset_data: Email, token, and new password

        Returns:
            Success message

        Raises:
            HTTPException: If token is invalid or expired
        """
        is_valid = await self.repository.verify_reset_token(
            reset_data.email, reset_data.token
        )
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token",
            )

        user = await self.repository.get_by_email(reset_data.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        new_hashed_password = get_password_hash(reset_data.new_password)
        await self.repository.update_password(str(user.id), new_hashed_password)
        await self.repository.clear_reset_token(reset_data.email)

        return {"message": "Password reset successfully"}

    async def get_current_user(self, email: str) -> Optional[UserInDB]:
        """
        Get current authenticated user by email.

        Args:
            email: User email from JWT token

        Returns:
            User information or None
        """
        return await self.repository.get_by_email(email)

    async def update_user_profile(
        self, user_email: str, update_data: UserUpdate
    ) -> Optional[UserInDB]:
        """
        Update user profile information.

        Args:
            user_email: Email of authenticated user
            update_data: Updated user data (full_name, profile_picture)

        Returns:
            Updated user information

        Raises:
            HTTPException: If user not found
        """
        user = await self.repository.get_by_email(user_email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        return await self.repository.update_profile(str(user.id), update_data)
