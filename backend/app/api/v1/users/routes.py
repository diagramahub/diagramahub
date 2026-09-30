"""
User API routes for authentication and user management.
"""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.api.deps import get_current_user_email, get_user_service
from app.api.v1.users.repository import UserRepository
from app.api.v1.users.services import UserService
from app.api.v1.users.schemas import (
    SimplifiedChangePasswordRequest,
    DeleteAccountRequest,
    LoginRequest,
    ResetPasswordConfirm,
    ResetPasswordRequest,
    UserCreate,
    UserUpdate,
    UserResponse,
)
from app.api.v1.users.email_templates import build_mfa_email_html

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


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
    request: Request,
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
    from app.api.v1.users.rate_limiter import register_rate_limiter

    client_ip = request.client.host if request.client else "unknown"
    allowed, retry_after = register_rate_limiter.is_allowed(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Demasiados registros desde esta dirección. "
                f"Intente de nuevo en {retry_after} segundos."
            ),
            headers={"Retry-After": str(retry_after)},
        )

    return await service.register_user(user_data)


@router.post("/login", response_model=None)
async def login(
    request: Request,
    login_data: LoginRequest,
    service: Annotated[UserService, Depends(get_user_service)],
    accept_language: str = Header(default="es", alias="Accept-Language"),
) -> dict:
    """
    Authenticate user and return JWT token, or initiate MFA verification flow.

    If the user has MFA enabled, returns an MFA challenge response containing
    a temporary token, the default MFA method, and available methods.
    If MFA is not enabled, returns a standard access token.

    TODO(SOLID): The lockout/audit/email-challenge orchestration below still
    lives in the route. It is deliberately left here because moving it into
    UserService would risk changing the exact status codes, headers and audit
    side effects; a dedicated login-orchestration service can absorb it in a
    later pass once this flow is covered by behavior tests.

    Args:
        login_data: Login credentials
        service: User service instance

    Returns:
        Dict with access token, or dict with MFA challenge info
    """
    from app.api.v1.users.rate_limiter import login_rate_limiter, account_lockout

    # --- Rate limiting by IP ---
    client_ip = request.client.host if request.client else "unknown"
    allowed, retry_after = login_rate_limiter.is_allowed(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Demasiados intentos de inicio de sesión. Intente de nuevo en {retry_after} segundos.",
            headers={"Retry-After": str(retry_after)},
        )

    # --- Account lockout check ---
    locked, remaining = account_lockout.is_locked(login_data.email)
    if locked:
        minutes = (remaining + 59) // 60
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intente de nuevo en {minutes} minutos.",
        )

    try:
        result = await service.login(login_data)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            # Record failed attempt
            now_locked, lockout_secs = account_lockout.record_failed_attempt(login_data.email)

            # Audit log: failed login
            from app.api.v1.users.audit_log import log_event, EVENT_LOGIN_FAILED, EVENT_LOGIN_LOCKED

            await log_event(EVENT_LOGIN_FAILED, login_data.email, ip_address=client_ip)

            if now_locked:
                await log_event(EVENT_LOGIN_LOCKED, login_data.email, ip_address=client_ip)
                minutes = (lockout_secs + 59) // 60
                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail=f"Cuenta bloqueada temporalmente tras múltiples intentos fallidos. Intente de nuevo en {minutes} minutos.",
                )
            remaining_attempts = account_lockout.get_remaining_attempts(login_data.email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=exc.detail,
                headers={"X-Remaining-Attempts": str(remaining_attempts)},
            )
        raise

    # Successful login — reset lockout counter
    account_lockout.record_successful_login(login_data.email)

    # Audit log: successful login
    from app.api.v1.users.audit_log import log_event, EVENT_LOGIN_SUCCESS

    user_id = result.pop("_user_id", None)
    await log_event(EVENT_LOGIN_SUCCESS, login_data.email, user_id=user_id, ip_address=client_ip)

    if user_id and not result.get("mfa_required"):
        await UserRepository().update_last_login(user_id)

    # MFA flow: the service includes an internal `email_code` field when the
    # default method is email.  We need to send it via the email service and
    # then strip it from the response before returning to the client.
    if result.get("mfa_required"):
        email_code = result.pop("email_code", None)
        if email_code is not None:
            lang = "en" if "en" in accept_language.lower() else "es"
            try:
                from app.api.v1.integrations.email_service import EmailService
                from app.api.v1.integrations.repository import IntegrationsRepository

                email_service = EmailService(IntegrationsRepository())
                vendor = await email_service.get_default_email_vendor()
                subject = (
                    "Your MFA verification code — DiagramaHub"
                    if lang == "en"
                    else "Tu código de verificación MFA — DiagramaHub"
                )
                html_content = build_mfa_email_html(email_code, lang)
                await vendor.send_email(
                    to=login_data.email,
                    subject=subject,
                    html_content=html_content,
                )
            except Exception:
                # Log the failure but don't block the MFA flow — the user can
                # request a resend via the dedicated endpoint.
                logger.warning(
                    "Failed to send MFA email code to %s during login",
                    login_data.email,
                )

    return result


async def _get_subscription_data(user_id: str) -> Optional[dict]:
    """Fetch the active subscription plan summary for a user (best effort).

    Failures are logged and swallowed so subscription lookups never break the
    profile endpoints.

    Args:
        user_id: User ID whose active subscription should be looked up.

    Returns:
        Dict with a ``plan`` summary, or None when there is no active
        subscription (or the lookup fails).
    """
    from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository
    from app.api.v1.subscriptions.plan_repository import PlanRepository

    try:
        subscription_repo = SubscriptionRepository()
        plan_repo = PlanRepository()

        subscription = await subscription_repo.get_active_by_user(user_id)
        if subscription:
            plan = await plan_repo.get_by_id(subscription.plan_id)
            if plan:
                return {
                    "plan": {
                        "name": plan.name,
                        "price_usd": plan.price_usd,  # computed from prices dict
                        "max_projects": plan.max_projects,
                        "max_diagrams": plan.max_diagrams,
                    }
                }
    except Exception as e:
        # If subscription fetch fails, continue without it
        logger.warning("Error fetching subscription for user %s: %s", user_id, e)

    return None


@router.put("/change-password")
async def change_password(
    password_data: SimplifiedChangePasswordRequest,
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    service: Annotated[UserService, Depends(get_user_service)],
) -> dict:
    """
    Change password for authenticated user.

    Args:
        password_data: New password
        current_user_email: Email of authenticated user
        service: User service instance

    Returns:
        Success message
    """
    return await service.change_password(current_user_email, password_data)


@router.post("/reset-password-request")
async def reset_password_request(
    request: Request,
    reset_data: ResetPasswordRequest,
    service: Annotated[UserService, Depends(get_user_service)],
) -> dict:
    """
    Request password reset. Sends a recovery email if the address is registered.

    Args:
        reset_data: Email for password reset
        service: User service instance

    Returns:
        Generic success message (anti-enumeration)
    """
    from app.api.v1.users.rate_limiter import password_reset_rate_limiter

    client_ip = request.client.host if request.client else "unknown"
    allowed, retry_after = password_reset_rate_limiter.is_allowed(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Demasiadas solicitudes de recuperación desde esta dirección. "
                f"Intente de nuevo en {retry_after} segundos."
            ),
            headers={"Retry-After": str(retry_after)},
        )

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
        Current user information with subscription data
    """
    user = await service.get_current_user(current_user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Get user's subscription info
    subscription_data = await _get_subscription_data(str(user.id))

    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        profile_picture=user.profile_picture,
        timezone=user.timezone,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        subscription=subscription_data,
        oauth_providers=user.oauth_providers,
        can_change_password=user.can_change_password,
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
        Updated user information with subscription data
    """
    user = await service.update_user_profile(current_user_email, update_data)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Get user's subscription info
    subscription_data = await _get_subscription_data(str(user.id))

    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        profile_picture=user.profile_picture,
        timezone=user.timezone,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        subscription=subscription_data,
        oauth_providers=user.oauth_providers,
        can_change_password=user.can_change_password,
    )


@router.get("/admin-count")
async def get_admin_count(
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    service: Annotated[UserService, Depends(get_user_service)],
) -> dict:
    """Get the number of admin users in the system."""
    count = await service.count_admins()
    return {"count": count}


@router.delete("/me")
async def delete_account(
    request_body: DeleteAccountRequest,
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    service: Annotated[UserService, Depends(get_user_service)],
) -> dict:
    """
    Delete the current user's account and all associated data.

    Requires a valid confirmation phrase ("elimíname" or "delete me").
    Rejects deletion if the user has an active paid subscription.
    """
    # Confirmation phrase, admin-count and subscription checks live in the
    # service; the route keeps HTTP orchestration and the audit side effect.
    user = await service.validate_account_deletion(
        current_user_email, request_body.confirmation_phrase
    )

    user_id = str(user.id)

    # Perform account deletion
    try:
        from app.api.v1.users.deletion_service import AccountDeletionService
        from app.api.v1.projects.repository import ProjectRepository
        from app.api.v1.diagrams.repository import DiagramRepository
        from app.api.v1.folders.repository import FolderRepository
        from app.api.v1.ai_providers.repository import AIProviderRepository
        from app.api.v1.prompt_history.repository import PromptHistoryRepository
        from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository

        deletion_service = AccountDeletionService(
            user_repository=UserRepository(),
            project_repository=ProjectRepository(),
            diagram_repository=DiagramRepository(),
            folder_repository=FolderRepository(),
            subscription_repository=SubscriptionRepository(),
            ai_provider_repository=AIProviderRepository(),
            prompt_history_repository=PromptHistoryRepository(),
        )
        await deletion_service.delete_user_account(user_id)
    except Exception:
        logger.exception("Failed to delete account for user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not delete the account. Please try again.",
        )

    # Audit log: the user document is gone, so record the snapshot captured above.
    from app.api.v1.users.audit_log import log_event, EVENT_ACCOUNT_DELETED

    await log_event(EVENT_ACCOUNT_DELETED, user.email, user_id=user_id)

    return {"message": "Account deleted successfully"}
