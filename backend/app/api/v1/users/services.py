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
from app.api.v1.mfa.interfaces import IMfaRepository
from app.api.v1.mfa.repository import MfaRepository
from app.api.v1.subscriptions.interfaces import (
    IPlanRepository,
    ISubscriptionRepository,
)
from app.api.v1.subscriptions.payment_providers.interfaces import IPaymentProvider
from app.api.v1.subscriptions.plan_repository import PlanRepository
from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository
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

    def __init__(
        self,
        repository: IUserRepository,
        mfa_repository: Optional[IMfaRepository] = None,
        subscription_repository: Optional[ISubscriptionRepository] = None,
        plan_repository: Optional[IPlanRepository] = None,
        payment_provider: Optional[IPaymentProvider] = None,
    ):
        """
        Initialize user service with its dependencies.

        All collaborators are injected for testability. When a collaborator
        is not provided, the production default is constructed so existing
        call sites keep working unchanged.

        Args:
            repository: User repository implementation
            mfa_repository: MFA repository (defaults to MfaRepository)
            subscription_repository: Subscription repository
                (defaults to SubscriptionRepository)
            plan_repository: Plan repository (defaults to PlanRepository)
            payment_provider: Payment provider used for FREE-plan
                provisioning; when None the Stripe provider is resolved
                lazily from DB/env at provisioning time
        """
        self.repository = repository
        self.mfa_repository = mfa_repository if mfa_repository is not None else MfaRepository()
        self.subscription_repository = (
            subscription_repository
            if subscription_repository is not None
            else SubscriptionRepository()
        )
        self.plan_repository = plan_repository if plan_repository is not None else PlanRepository()
        # None keeps the historical behavior: StripePaymentProvider is
        # resolved lazily (from DB or environment) inside register_user.
        self.payment_provider = payment_provider

    async def check_installation_status(self) -> dict:
        """
        Check if the system needs initial setup.

        Returns:
            Dictionary with 'needs_setup' boolean
        """
        user_count = await self.repository.count_users()
        return {"needs_setup": user_count == 0, "user_count": user_count}

    async def count_admins(self) -> int:
        """
        Count the number of admin users in the system.

        Returns:
            Number of users with the admin role
        """
        return await self.repository.count_admins()

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
                from app.api.v1.subscriptions.constants import (
                    FREE_PLAN_NAME,
                    FREE_PLAN_CODE,
                    FREE_PLAN_DESCRIPTION,
                    FREE_PLAN_PRICE,
                    FREE_PLAN_MAX_PROJECTS,
                    FREE_PLAN_MAX_DIAGRAMS,
                )

                plan_repo = self.plan_repository

                # Ensure FREE plan exists (first regular user or first user after admin)
                existing_free = await plan_repo.get_by_name(FREE_PLAN_NAME)
                if not existing_free:
                    from app.api.v1.subscriptions.schemas import PlanCreate as PlanCreateSchema

                    await plan_repo.create(
                        PlanCreateSchema(
                            name=FREE_PLAN_NAME,
                            code=FREE_PLAN_CODE,
                            description=FREE_PLAN_DESCRIPTION,
                            price_usd=FREE_PLAN_PRICE,
                            max_projects=FREE_PLAN_MAX_PROJECTS,
                            max_diagrams=FREE_PLAN_MAX_DIAGRAMS,
                        )
                    )

                payment_provider = self.payment_provider
                if payment_provider is None:
                    from app.api.v1.subscriptions.payment_providers.stripe_provider import (
                        StripePaymentProvider,
                    )

                    try:
                        payment_provider = await StripePaymentProvider.from_db_or_env()
                    except Exception:
                        payment_provider = None

                subscription_service = SubscriptionService(
                    repository=self.subscription_repository,
                    plan_repository=plan_repo,
                    payment_provider=payment_provider,
                )

                await subscription_service.create_free_subscription(str(user.id))
            except Exception as e:
                logger.error(f"Failed to create FREE subscription for user {user.email}: {str(e)}")
        else:
            # Admin: just ensure FREE plan exists for future users
            try:
                from app.api.v1.subscriptions.constants import (
                    FREE_PLAN_NAME,
                    FREE_PLAN_CODE,
                    FREE_PLAN_DESCRIPTION,
                    FREE_PLAN_PRICE,
                    FREE_PLAN_MAX_PROJECTS,
                    FREE_PLAN_MAX_DIAGRAMS,
                )

                plan_repo = self.plan_repository
                existing_free = await plan_repo.get_by_name(FREE_PLAN_NAME)
                if not existing_free:
                    from app.api.v1.subscriptions.schemas import PlanCreate as PlanCreateSchema

                    await plan_repo.create(
                        PlanCreateSchema(
                            name=FREE_PLAN_NAME,
                            code=FREE_PLAN_CODE,
                            description=FREE_PLAN_DESCRIPTION,
                            price_usd=FREE_PLAN_PRICE,
                            max_projects=FREE_PLAN_MAX_PROJECTS,
                            max_diagrams=FREE_PLAN_MAX_DIAGRAMS,
                        )
                    )
            except Exception as e:
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
                plain_code = "".join(secrets.choice("0123456789") for _ in range(6))
                hashed_code = pwd_context.hash(plain_code)
                expires_at = time.time() + 600  # 10 minutes

                await self.mfa_repository.save_email_code(str(user.id), hashed_code, expires_at)
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

        Accounts with a user-set password must confirm the current one. OAuth-only
        accounts are rejected: their stored hash is a random placeholder nobody
        knows, so a bearer token alone must never be enough to set a password --
        that would turn a stolen token into a permanent account takeover. Those
        accounts can create a password through the reset flow, which proves control
        of the email address.

        Args:
            user_email: Email of authenticated user
            password_data: Current password (when applicable) and new password

        Returns:
            Success message

        Raises:
            HTTPException: If the user is not found, the account is OAuth-only, or
                the current password is missing or incorrect.
        """
        user = await self.repository.get_by_email(user_email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # A valid current password authorises the change on its own. Accounts
        # registered with a password and later linked to a provider (auto-link by
        # email) keep that password, so the classification below must never be
        # what stops them: it only decides which message someone gets when they
        # cannot prove a password.
        current_password_ok = False
        if password_data.current_password:
            try:
                current_password_ok = verify_password(
                    password_data.current_password, user.hashed_password
                )
            except Exception:
                # A malformed hash in a legacy document means "no password".
                current_password_ok = False

        if not current_password_ok:
            if user.is_oauth_only:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        "This account signs in with a linked provider and has no password to "
                        "confirm. Use 'forgot password' to create one for email sign-in."
                    ),
                )
            if not password_data.current_password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is required",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
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

        await self.repository.save_reset_token(reset_data.email, reset_token, expires_at)

        # Send recovery email (may raise HTTP 500 on failure)
        logger.info("Sending password recovery email")
        await email_service.send_password_recovery_email(
            to=reset_data.email, token=reset_token, email=reset_data.email
        )

        # Audit log: only reached for an existing address and after the email
        # was handed to the vendor, so the entry reflects a delivered request.
        from app.api.v1.users.audit_log import log_event, EVENT_PASSWORD_RESET_REQUESTED

        await log_event(EVENT_PASSWORD_RESET_REQUESTED, user.email, user_id=str(user.id))

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
        is_valid = await self.repository.verify_reset_token(reset_data.email, reset_data.token)
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

    async def validate_account_deletion(
        self, user_email: str, confirmation_phrase: str
    ) -> UserInDB:
        """
        Validate that the current user is allowed to delete their account.

        Performs, in order: the confirmation-phrase check, the user lookup,
        the last-admin protection, and the active paid subscription check.

        Args:
            user_email: Email of the authenticated user
            confirmation_phrase: Phrase typed by the user to confirm deletion

        Returns:
            The user document (used by the route for the audit log)

        Raises:
            HTTPException: 400 for an invalid phrase, 404 when the user does
                not exist, and 403 when the user is the only administrator or
                has an active paid subscription
        """
        valid_phrases = {"elimíname", "delete me"}
        if confirmation_phrase not in valid_phrases:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid confirmation phrase",
            )

        user = await self.repository.get_by_email(user_email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        user_id = str(user.id)

        if user.role == "admin":
            admin_count = await self.repository.count_admins()
            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot delete the only administrator account. To remove this account, uninstall DiagramHub from your infrastructure.",
                )

        subscription = await self.subscription_repository.get_active_by_user(user_id)
        if subscription:
            plan = await self.plan_repository.get_by_id(subscription.plan_id)
            if plan and plan.price_usd > 0:  # computed from prices dict
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot delete account with active paid subscription. Please switch to the free plan first.",
                )

        return user

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
