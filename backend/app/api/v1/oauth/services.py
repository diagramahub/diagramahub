"""
Business logic layer for the OAuth authentication flow.

Orchestrates state management, token exchange, account creation/linking,
and JWT issuance.
"""

import logging
import secrets
from datetime import timedelta
from typing import Optional

from fastapi import HTTPException, status

from app.api.v1.integrations.interfaces import IIntegrationsRepository
from app.api.v1.integrations.schemas import VendorCategory
from app.api.v1.oauth.interfaces import IOAuthStateRepository
from app.api.v1.oauth.providers.factory import OAuthProviderFactory
from app.api.v1.oauth.repository import OAuthStateRepository
from app.api.v1.oauth.schemas import (
    OAuthCallbackResponse,
    OAuthTokenExchangeError,
    OAuthUserInfoError,
    ProviderUserInfo,
)
from app.api.v1.subscriptions.interfaces import (
    IPlanRepository,
    ISubscriptionRepository,
)
from app.api.v1.subscriptions.payment_providers.interfaces import IPaymentProvider
from app.api.v1.subscriptions.plan_repository import PlanRepository
from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository
from app.api.v1.users.interfaces import IUserRepository
from app.api.v1.users.repository import UserRepository
from app.api.v1.users.schemas import OAuthProviderEntry, UserInDB
from app.core.security import create_access_token, get_password_hash
from app.core.clock import utcnow

logger = logging.getLogger(__name__)


class OAuthService:
    """Orchestrates the OAuth flow: state management, token exchange,
    account creation/linking, and JWT issuance."""

    def __init__(
        self,
        integrations_repo: IIntegrationsRepository,
        state_repository: Optional[IOAuthStateRepository] = None,
        user_repository: Optional[IUserRepository] = None,
        subscription_repository: Optional[ISubscriptionRepository] = None,
        plan_repository: Optional[IPlanRepository] = None,
        payment_provider: Optional[IPaymentProvider] = None,
    ):
        """
        Initialize the OAuth service with its dependencies.

        All collaborators are injected for testability. When a collaborator
        is not provided, the production default is constructed so existing
        call sites keep working unchanged.

        Args:
            integrations_repo: Integrations repository implementation
            state_repository: OAuth state token repository
                (defaults to OAuthStateRepository)
            user_repository: User repository implementation
                (defaults to UserRepository)
            subscription_repository: Subscription repository
                (defaults to SubscriptionRepository)
            plan_repository: Plan repository (defaults to PlanRepository)
            payment_provider: Payment provider used for FREE-plan
                provisioning; when None the Stripe provider is resolved
                lazily from DB/env at provisioning time
        """
        self.integrations_repo = integrations_repo
        self.state_repository = (
            state_repository if state_repository is not None else OAuthStateRepository()
        )
        self.user_repository = user_repository if user_repository is not None else UserRepository()
        self.subscription_repository = (
            subscription_repository
            if subscription_repository is not None
            else SubscriptionRepository()
        )
        self.plan_repository = plan_repository if plan_repository is not None else PlanRepository()
        # None keeps the historical behavior: StripePaymentProvider is
        # resolved lazily (from DB or environment) when provisioning.
        self.payment_provider = payment_provider

    # ── Public API ───────────────────────────────────────────────────

    async def get_active_providers(self) -> list[dict]:
        """Return list of active OAuth providers (name + authorization_url).

        Only returns public-safe information — no secrets are exposed.
        """
        vendors = await self.integrations_repo.list_by_category(VendorCategory.OAUTH)
        active = [v for v in vendors if v.is_active_oauth]

        results: list[dict] = []
        for vendor in active:
            decrypted = await self.integrations_repo.get_by_id_decrypted(str(vendor.id))
            if decrypted is None:
                continue
            _, config = decrypted
            try:
                adapter = OAuthProviderFactory.create(vendor.vendor_type, config)
            except ValueError:
                logger.warning(
                    "Skipping unsupported OAuth vendor_type: %s",
                    vendor.vendor_type,
                )
                continue

            # Build a placeholder authorization URL for display purposes.
            # The real state token is generated during initiate_oauth.
            redirect_uri = config.get("redirect_uri", "")
            auth_url = adapter.get_authorization_url(state="placeholder", redirect_uri=redirect_uri)
            results.append(
                {
                    "provider": vendor.vendor_type,
                    "authorization_url": auth_url,
                }
            )

        return results

    async def initiate_oauth(self, provider: str) -> tuple[str, str]:
        """Generate a cryptographic state token, store it, and build the
        authorization URL for the given provider.

        Returns:
            Tuple of (authorization_url, state_token).

        Raises:
            HTTPException 404: If no active OAuth vendor exists for the provider.
        """
        vendor, config = await self._get_active_vendor(provider)

        # Generate cryptographic state token
        state_token = secrets.token_urlsafe(32)

        # Store state token with 10-minute TTL
        now = utcnow()
        await self.state_repository.create(
            state=state_token,
            provider=provider,
            expires_at=now + timedelta(minutes=10),
        )

        # Build authorization URL
        adapter = OAuthProviderFactory.create(vendor.vendor_type, config)
        redirect_uri = config.get("redirect_uri", "")
        authorization_url = adapter.get_authorization_url(
            state=state_token, redirect_uri=redirect_uri
        )

        return authorization_url, state_token

    async def handle_callback(self, provider: str, code: str, state: str) -> OAuthCallbackResponse:
        """Validate state, exchange code, get user info, create/link
        account, and issue JWT.

        Args:
            provider: OAuth provider name (e.g., "google").
            code: Authorization code from the provider callback.
            state: State token for CSRF validation.

        Returns:
            OAuthCallbackResponse with access_token and token_type.

        Raises:
            HTTPException 400: Invalid/expired/consumed state token.
            HTTPException 401: Token exchange failure.
            HTTPException 403: Unverified email.
        """
        # 1. Validate state token
        state_doc = await self.state_repository.get_by_token(state)

        if state_doc is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OAuth state token",
            )

        if state_doc.consumed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OAuth state token",
            )

        if state_doc.expires_at < utcnow():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OAuth authentication session has expired",
            )

        # 2. Get active vendor config
        vendor, config = await self._get_active_vendor(provider)

        # 3. Create provider adapter and exchange code
        adapter = OAuthProviderFactory.create(vendor.vendor_type, config)
        redirect_uri = config.get("redirect_uri", "")

        try:
            token_response = await adapter.exchange_code(code, redirect_uri)
        except OAuthTokenExchangeError as exc:
            logger.error("OAuth token exchange failed for %s: %s", provider, exc)
            # Log failed attempt
            from app.api.v1.users.audit_log import (
                EVENT_OAUTH_LOGIN_FAILED,
                log_event,
            )

            await log_event(
                EVENT_OAUTH_LOGIN_FAILED,
                user_email="unknown",
                details=f"Token exchange failed for provider: {provider}",
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to exchange authorization code",
            )

        # 4. Get user info from provider
        try:
            user_info = await adapter.get_user_info(token_response)
        except OAuthUserInfoError as exc:
            logger.error(
                "OAuth user info retrieval failed for %s: %s",
                provider,
                exc,
            )
            from app.api.v1.users.audit_log import (
                EVENT_OAUTH_LOGIN_FAILED,
                log_event,
            )

            await log_event(
                EVENT_OAUTH_LOGIN_FAILED,
                user_email="unknown",
                details=(f"User info retrieval failed for provider: {provider}"),
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=("Failed to retrieve user information from provider"),
            )

        # 5. Reject unverified emails
        if not user_info.email_verified:
            from app.api.v1.users.audit_log import (
                EVENT_OAUTH_LOGIN_FAILED,
                log_event,
            )

            await log_event(
                EVENT_OAUTH_LOGIN_FAILED,
                user_email=user_info.email,
                details=f"Unverified email from provider: {provider}",
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified by OAuth provider",
            )

        # 6. Find or create user and link provider
        user = await self._find_or_create_user(user_info, provider)

        # 7. Issue JWT
        access_token = await self._issue_jwt(user, provider)

        # 8. Mark state token as consumed
        await self.state_repository.consume(state)

        return OAuthCallbackResponse(access_token=access_token)

    # ── Private helpers ──────────────────────────────────────────────

    async def _get_active_vendor(self, provider: str) -> tuple:
        """Find the active OAuth vendor for the given provider type.

        Returns:
            Tuple of (VendorConfigInDB, decrypted_config_dict).

        Raises:
            HTTPException 404: If no active vendor is found.
        """
        vendors = await self.integrations_repo.list_by_category(VendorCategory.OAUTH)
        for vendor in vendors:
            if vendor.vendor_type == provider and vendor.is_active_oauth:
                decrypted = await self.integrations_repo.get_by_id_decrypted(str(vendor.id))
                if decrypted is None:
                    continue
                return decrypted

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="OAuth provider not configured or inactive",
        )

    async def _find_or_create_user(self, user_info: ProviderUserInfo, provider: str) -> UserInDB:
        """Find an existing user by email or create a new one.

        - If no user exists: create with provider email, name, random
          password hash, and an oauth_providers entry. Also create a
          FREE subscription.
        - If user exists but provider not linked: add provider entry.
        - If user exists and provider already linked: proceed as-is.

        Returns:
            The found or newly created UserInDB document.
        """
        from app.api.v1.users.audit_log import (
            EVENT_OAUTH_ACCOUNT_LINKED,
            log_event,
        )

        existing_user = await self.user_repository.get_by_email(user_info.email)

        if existing_user is None:
            # Create new user with random secure password.
            # TODO(dip): IUserRepository.create() only supports UserCreate
            # (password-based signup), so OAuth signup still inserts the
            # document directly until the users interface grows an
            # OAuth-aware create method.
            random_password = secrets.token_urlsafe(32)
            hashed_password = get_password_hash(random_password)

            provider_entry = OAuthProviderEntry(
                provider=provider,
                provider_user_id=user_info.provider_user_id,
            )

            user = UserInDB(
                email=user_info.email,
                hashed_password=hashed_password,
                full_name=user_info.full_name,
                oauth_providers=[provider_entry],
                # The hash above is a random placeholder nobody knows, so the
                # account must never be asked to confirm a current password.
                has_usable_password=False,
            )
            await user.insert()

            # Create FREE subscription (same logic as UserService.register_user)
            await self._create_free_subscription(user)

            await log_event(
                EVENT_OAUTH_ACCOUNT_LINKED,
                user_email=user.email,
                user_id=str(user.id),
                details=f"New account created via OAuth provider: {provider}",
            )

            return user

        # User exists — check if provider is already linked
        already_linked = any(
            p.provider == provider and p.provider_user_id == user_info.provider_user_id
            for p in existing_user.oauth_providers
        )

        if not already_linked:
            provider_entry = OAuthProviderEntry(
                provider=provider,
                provider_user_id=user_info.provider_user_id,
            )
            existing_user.oauth_providers.append(provider_entry)
            existing_user.updated_at = utcnow()
            await existing_user.save()

            await log_event(
                EVENT_OAUTH_ACCOUNT_LINKED,
                user_email=existing_user.email,
                user_id=str(existing_user.id),
                details=f"OAuth provider linked: {provider}",
            )

        return existing_user

    async def _create_free_subscription(self, user: UserInDB) -> None:
        """Create a FREE subscription for a new OAuth-created user.

        Mirrors the logic in UserService.register_user using the
        constructor-injected subscription collaborators.

        Args:
            user: The newly created user document.
        """
        try:
            from app.api.v1.subscriptions.subscription_service import (
                SubscriptionService,
            )
            from app.api.v1.subscriptions.constants import (
                FREE_PLAN_NAME,
                FREE_PLAN_CODE,
                FREE_PLAN_DESCRIPTION,
                FREE_PLAN_PRICE,
                FREE_PLAN_MAX_PROJECTS,
                FREE_PLAN_MAX_DIAGRAMS,
            )

            plan_repo = self.plan_repository

            # Ensure FREE plan exists
            existing_free = await plan_repo.get_by_name(FREE_PLAN_NAME)
            if not existing_free:
                from app.api.v1.subscriptions.schemas import (
                    PlanCreate as PlanCreateSchema,
                )

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
        except Exception as exc:
            logger.error(
                "Failed to create FREE subscription for OAuth user %s: %s",
                user.email,
                exc,
            )

    async def _issue_jwt(self, user: UserInDB, provider: str) -> str:
        """Issue a 5-day JWT (MFA-bypass equivalent) and log audit event.

        Args:
            user: The authenticated user document.
            provider: OAuth provider name for audit logging.

        Returns:
            Encoded JWT access token string.
        """
        access_token = create_access_token(
            subject=user.email,
            expires_delta=timedelta(days=5),
            password_changed_at=user.password_changed_at,
        )

        from app.api.v1.users.audit_log import (
            EVENT_OAUTH_LOGIN_SUCCESS,
            log_event,
        )

        await log_event(
            EVENT_OAUTH_LOGIN_SUCCESS,
            user_email=user.email,
            user_id=str(user.id),
            details=f"OAuth login via provider: {provider}",
        )

        return access_token
