"""
User API routes for authentication and user management.
"""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.api.v1.users.repository import UserRepository
from app.api.v1.users.schemas import (
    SimplifiedChangePasswordRequest,
    DeleteAccountRequest,
    LoginRequest,
    ResetPasswordConfirm,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserInDB,
    UserUpdate,
    UserResponse,
    UserRole,
)
from app.api.v1.users.services import UserService
from app.core.security import decode_access_token

logger = logging.getLogger(__name__)

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

    Also validates that the token was not issued before the last password
    change (session invalidation on password change).

    Args:
        credentials: HTTP Bearer token from Authorization header

    Returns:
        User email from token

    Raises:
        HTTPException: If token is invalid, missing, or invalidated by password change
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

    # Session invalidation: check if password was changed after token was issued
    token_pca = payload.get("pca")
    user = await UserInDB.find_one(UserInDB.email == email)
    if user and user.password_changed_at is not None:
        if token_pca is None or token_pca < user.password_changed_at:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session invalidated. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

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
                html_content = _build_mfa_email_html(email_code, lang)
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


def _build_mfa_email_html(code: str, lang: str = "es") -> str:
    """Return an HTML email template for the MFA verification code."""
    if lang == "en":
        title = "Verification code"
        body = (
            "Use the following code to complete your sign in. "
            "This code expires in <strong>10 minutes</strong>."
        )
        footer_note = "If you did not try to sign in, you can ignore this email."
        copyright_text = "&copy; DiagramaHub. All rights reserved."
    else:
        title = "Código de verificación"
        body = (
            "Usa el siguiente código para completar tu inicio de sesión. "
            "Este código expira en <strong>10 minutos</strong>."
        )
        footer_note = "Si no intentaste iniciar sesión, puedes ignorar este correo."
        copyright_text = "&copy; DiagramaHub. Todos los derechos reservados."

    return f"""\
<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#9333ea 100%);padding:28px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">DiagramaHub</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 20px;">
              <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600;">{title}</h2>
              <p style="margin:0 0 24px;color:#51545e;font-size:15px;line-height:1.6;">
                {body}
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <span style="display:inline-block;background-color:#faf5ff;color:#7c3aed;font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 32px;border-radius:8px;border:1px solid #e9d5ff;">
                      {code}
                    </span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#9b9ba5;font-size:13px;line-height:1.5;">
                {footer_note}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #eaeaec;text-align:center;">
              <p style="margin:0;color:#9b9ba5;font-size:12px;">{copyright_text}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


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
    from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository
    from app.api.v1.subscriptions.plan_repository import PlanRepository
    
    user = await service.get_current_user(current_user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Get user's subscription info
    subscription_data = None
    try:
        subscription_repo = SubscriptionRepository()
        plan_repo = PlanRepository()
        
        subscription = await subscription_repo.get_active_by_user(str(user.id))
        if subscription:
            plan = await plan_repo.get_by_id(subscription.plan_id)
            if plan:
                subscription_data = {
                    "plan": {
                        "name": plan.name,
                        "price_usd": plan.price_usd,  # computed from prices dict
                        "max_projects": plan.max_projects,
                        "max_diagrams": plan.max_diagrams
                    }
                }
    except Exception as e:
        # If subscription fetch fails, continue without it
        print(f"Error fetching subscription: {e}")

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
    from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository
    from app.api.v1.subscriptions.plan_repository import PlanRepository
    
    user = await service.update_user_profile(current_user_email, update_data)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Get user's subscription info
    subscription_data = None
    try:
        subscription_repo = SubscriptionRepository()
        plan_repo = PlanRepository()
        
        subscription = await subscription_repo.get_active_by_user(str(user.id))
        if subscription:
            plan = await plan_repo.get_by_id(subscription.plan_id)
            if plan:
                subscription_data = {
                    "plan": {
                        "name": plan.name,
                        "price_usd": plan.price_usd,  # computed from prices dict
                        "max_projects": plan.max_projects,
                        "max_diagrams": plan.max_diagrams
                    }
                }
    except Exception as e:
        # If subscription fetch fails, continue without it
        print(f"Error fetching subscription: {e}")

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
    )


@router.get("/admin-count")
async def get_admin_count(
    current_user_email: Annotated[str, Depends(get_current_user_email)],
) -> dict:
    """Get the number of admin users in the system."""
    count = await UserInDB.find(UserInDB.role == "admin").count()
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
    # Validate confirmation phrase
    valid_phrases = {"elimíname", "delete me"}
    if request_body.confirmation_phrase not in valid_phrases:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid confirmation phrase",
        )

    # Get user
    user = await service.get_current_user(current_user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user_id = str(user.id)

    # Check if user is the only admin
    if user.role == "admin":
        admin_count = await UserInDB.find(UserInDB.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete the only administrator account. To remove this account, uninstall DiagramHub from your infrastructure.",
            )

    # Check for active paid subscription
    from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository
    from app.api.v1.subscriptions.plan_repository import PlanRepository

    subscription_repo = SubscriptionRepository()
    plan_repo = PlanRepository()

    subscription = await subscription_repo.get_active_by_user(user_id)
    if subscription:
        plan = await plan_repo.get_by_id(subscription.plan_id)
        if plan and plan.price_usd > 0:  # computed from prices dict
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete account with active paid subscription. Please switch to the free plan first.",
            )

    # Perform account deletion
    try:
        from app.api.v1.users.deletion_service import AccountDeletionService
        from app.api.v1.projects.repository import ProjectRepository
        from app.api.v1.diagrams.repository import DiagramRepository
        from app.api.v1.folders.repository import FolderRepository
        from app.api.v1.ai_providers.repository import AIProviderRepository
        from app.api.v1.prompt_history.repository import PromptHistoryRepository

        deletion_service = AccountDeletionService(
            user_repository=UserRepository(),
            project_repository=ProjectRepository(),
            diagram_repository=DiagramRepository(),
            folder_repository=FolderRepository(),
            subscription_repository=subscription_repo,
            ai_provider_repository=AIProviderRepository(),
            prompt_history_repository=PromptHistoryRepository(),
        )
        await deletion_service.delete_user_account(user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting account: {str(e)}",
        )

    return {"message": "Account deleted successfully"}
