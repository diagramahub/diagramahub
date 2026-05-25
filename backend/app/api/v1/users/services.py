"""
User service layer implementing business logic.
"""
import logging
import secrets
import time
from datetime import timedelta
from typing import Optional, Union

from fastapi import HTTPException, status

from app.api.v1.users.interfaces import IUserRepository
from app.api.v1.users.schemas import (
    SimplifiedChangePasswordRequest,
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
    create_mfa_temp_token,
    get_password_hash,
    pwd_context,
    verify_password,
)

logger = logging.getLogger(__name__)


class UserService:
    """Service class handling user business logic."""

    def __init__(self, repository: IUserRepository):
        """
        Initialize user service with repository.

        Args:
            repository: User repository implementation
        """
        self.repository = repository

    async def check_installation_status(self) -> dict:
        """
        Check if the system needs initial setup.

        Returns:
            Dictionary with 'needs_setup' boolean
        """
        user_count = await self.repository.count_users()
        return {
            "needs_setup": user_count == 0,
            "user_count": user_count
        }

    async def register_user(self, user_data: UserCreate) -> UserResponse:
        """
        Register a new user.

        If this is the first user, they will be automatically assigned admin role.
        Automatically creates a FREE subscription for the new user.

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

        # Check if this is the first user
        user_count = await self.repository.count_users()
        if user_count == 0:
            # First user is automatically admin
            from app.api.v1.users.schemas import UserRole
            user_data.role = UserRole.ADMIN

        user = await self.repository.create(user_data)

        # Create FREE subscription for new user (skip for admin)
        if user.role != "admin":
            try:
                from app.api.v1.subscriptions.subscription_service import SubscriptionService
                from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository
                from app.api.v1.subscriptions.plan_repository import PlanRepository
                from app.api.v1.subscriptions.payment_providers.stripe_provider import StripePaymentProvider
                from app.api.v1.subscriptions.constants import (
                    FREE_PLAN_NAME, FREE_PLAN_CODE, FREE_PLAN_DESCRIPTION, FREE_PLAN_PRICE,
                    FREE_PLAN_MAX_PROJECTS, FREE_PLAN_MAX_DIAGRAMS
                )
                
                plan_repo = PlanRepository()
                
                # Ensure FREE plan exists (first regular user or first user after admin)
                existing_free = await plan_repo.get_by_name(FREE_PLAN_NAME)
                if not existing_free:
                    from app.api.v1.subscriptions.schemas import PlanCreate as PlanCreateSchema
                    await plan_repo.create(PlanCreateSchema(
                        name=FREE_PLAN_NAME,
                        code=FREE_PLAN_CODE,
                        description=FREE_PLAN_DESCRIPTION,
                        price_usd=FREE_PLAN_PRICE,
                        max_projects=FREE_PLAN_MAX_PROJECTS,
                        max_diagrams=FREE_PLAN_MAX_DIAGRAMS
                    ))
                
                try:
                    payment_provider = await StripePaymentProvider.from_db_or_env()
                except Exception:
                    payment_provider = None
                
                subscription_service = SubscriptionService(
                    repository=SubscriptionRepository(),
                    plan_repository=plan_repo,
                    payment_provider=payment_provider
                )
                
                await subscription_service.create_free_subscription(str(user.id))
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to create FREE subscription for user {user.email}: {str(e)}")
        else:
            # Admin: just ensure FREE plan exists for future users
            try:
                from app.api.v1.subscriptions.plan_repository import PlanRepository
                from app.api.v1.subscriptions.constants import (
                    FREE_PLAN_NAME, FREE_PLAN_CODE, FREE_PLAN_DESCRIPTION, FREE_PLAN_PRICE,
                    FREE_PLAN_MAX_PROJECTS, FREE_PLAN_MAX_DIAGRAMS
                )
                
                plan_repo = PlanRepository()
                existing_free = await plan_repo.get_by_name(FREE_PLAN_NAME)
                if not existing_free:
                    from app.api.v1.subscriptions.schemas import PlanCreate as PlanCreateSchema
                    await plan_repo.create(PlanCreateSchema(
                        name=FREE_PLAN_NAME,
                        code=FREE_PLAN_CODE,
                        description=FREE_PLAN_DESCRIPTION,
                        price_usd=FREE_PLAN_PRICE,
                        max_projects=FREE_PLAN_MAX_PROJECTS,
                        max_diagrams=FREE_PLAN_MAX_DIAGRAMS
                    ))
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to create FREE plan: {str(e)}")

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

    async def login(self, login_data: LoginRequest) -> Union[dict, Token]:
        """
        Authenticate user and generate access token, or initiate MFA flow.

        If the user has MFA enabled, returns a dict with ``mfa_required``,
        a temporary MFA token, the default method, and available methods.
        If the default method is email, a verification code is generated
        and its plain-text value is included so the route layer can send it.

        If MFA is not enabled, returns a dict containing the access token
        (with 2-day expiration) and an ``mfa_enabled: False`` indicator.

        Args:
            login_data: Login credentials

        Returns:
            Dict with MFA challenge info, or dict with access token

        Raises:
            HTTPException: If credentials are invalid or user is inactive
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

        if user.mfa_enabled:
            mfa_token = create_mfa_temp_token(
                user.email,
                user.mfa_default_method,
                user.mfa_methods,
            )

            response: dict = {
                "mfa_required": True,
                "mfa_token": mfa_token,
                "mfa_default_method": user.mfa_default_method,
                "available_methods": user.mfa_methods,
                "_user_id": str(user.id),
            }

            # If the default method is email, generate a code so the route
            # layer can send it.  We inline the generation here to avoid a
            # circular dependency on MfaService.
            if user.mfa_default_method == "email":
                plain_code = "".join(
                    secrets.choice("0123456789") for _ in range(6)
                )
                hashed_code = pwd_context.hash(plain_code)
                expires_at = time.time() + 600  # 10 minutes

                from app.api.v1.mfa.repository import MfaRepository

                mfa_repo = MfaRepository()
                await mfa_repo.save_email_code(
                    str(user.id), hashed_code, expires_at
                )
                response["email_code"] = plain_code

            return response

        # MFA not enabled — issue access token with 2-day expiration
        access_token = create_access_token(
            subject=user.email,
            expires_delta=timedelta(days=2),
            password_changed_at=user.password_changed_at,
        )
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "mfa_enabled": False,
            "_user_id": str(user.id),
        }

    async def change_password(
        self, user_email: str, password_data: SimplifiedChangePasswordRequest
    ) -> dict:
        """
        Change user password (authenticated endpoint).

        Args:
            user_email: Email of authenticated user
            password_data: New password

        Returns:
            Success message

        Raises:
            HTTPException: If user not found
        """
        user = await self.repository.get_by_email(user_email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        new_hashed_password = get_password_hash(password_data.new_password)
        # update_password also stamps password_changed_at, invalidating existing JWTs.
        await self.repository.update_password(str(user.id), new_hashed_password)

        # Audit log
        from app.api.v1.users.audit_log import log_event, EVENT_PASSWORD_CHANGED
        await log_event(EVENT_PASSWORD_CHANGED, user.email, user_id=str(user.id))

        return {"message": "Password changed successfully"}

    async def request_password_reset(self, reset_data: ResetPasswordRequest) -> dict:
        """
        Request password reset token and send recovery email.

        Args:
            reset_data: Email for password reset

        Returns:
            Generic success message (anti-enumeration)

        Raises:
            HTTPException 503: If no default email vendor is configured.
            HTTPException 500: If the email fails to send.
        """
        from app.api.v1.integrations.email_service import EmailService
        from app.api.v1.integrations.repository import IntegrationsRepository

        # Eagerly verify that an email vendor is available before doing
        # any user lookup.  This raises HTTP 503 when no default vendor
        # is configured, regardless of whether the email exists.
        email_service = EmailService(IntegrationsRepository())
        await email_service.get_default_email_vendor()

        generic_message = "If the email exists, a reset token has been sent"

        user = await self.repository.get_by_email(reset_data.email)
        if not user:
            logger.info("Password reset requested for non-existent email")
            return {"message": generic_message}

        # Invalidate any previous reset token for this user
        await self.repository.clear_reset_token(reset_data.email)

        # Generate secure reset token
        reset_token = secrets.token_urlsafe(32)
        expires_at = time.time() + 3600  # 1 hour expiration

        await self.repository.save_reset_token(
            reset_data.email, reset_token, expires_at
        )

        # Send recovery email (may raise HTTP 500 on failure)
        logger.info("Sending password recovery email")
        await email_service.send_password_recovery_email(
            to=reset_data.email, token=reset_token, email=reset_data.email
        )

        return {"message": generic_message}

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
        # update_password also stamps password_changed_at, invalidating existing JWTs.
        await self.repository.update_password(str(user.id), new_hashed_password)
        await self.repository.clear_reset_token(reset_data.email)

        # Audit log
        from app.api.v1.users.audit_log import log_event, EVENT_PASSWORD_RESET_CONFIRMED
        await log_event(EVENT_PASSWORD_RESET_CONFIRMED, user.email, user_id=str(user.id))

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
