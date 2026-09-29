"""
MFA API routes for multi-factor authentication management.

Endpoints cover TOTP and email MFA setup, verification during login,
recovery codes, method switching, and status queries.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from jose import JWTError

from app.api.v1.mfa.admin_service import MfaAdminService
from app.api.v1.mfa.repository import MfaRepository
from app.api.v1.mfa.schemas import (
    MfaDisableRequest,
    MfaEnableTotpRequest,
    MfaResendRequest,
    MfaResendResponse,
    MfaSetDefaultMethodRequest,
    MfaSetupTotpResponse,
    MfaStatusResponse,
    MfaSwitchMethodRequest,
    MfaVerifyEmailActivationRequest,
    MfaVerifyRequest,
    RecoveryCodesResponse,
)
from app.api.v1.mfa.services import MfaService
from app.api.v1.users.email_templates import build_mfa_email_html
from app.api.deps import get_current_user_email
from app.api.v1.users.schemas import UserInDB
from app.core.security import decode_mfa_temp_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mfa", tags=["MFA"])


def _get_mfa_service() -> MfaService:
    """Dependency injection for MFA service."""
    return MfaService(MfaRepository())


def _get_mfa_admin_service() -> MfaAdminService:
    """Dependency injection for the MFA admin service."""
    return MfaAdminService(MfaRepository())


def _extract_lang(accept_language: str = Header(default="es", alias="Accept-Language")) -> str:
    """Extract the preferred language from the Accept-Language header."""
    if "en" in accept_language.lower():
        return "en"
    return "es"


async def _send_mfa_email(email: str, code: str, lang: str = "es") -> None:
    """Send an MFA verification code via the configured email vendor.

    Failures are logged but do not raise — the caller decides how to handle.
    """
    subject = (
        "Your MFA verification code — DiagramaHub"
        if lang == "en"
        else "Tu código de verificación MFA — DiagramaHub"
    )
    try:
        # TODO(integration-pass): EmailService is constructed with a concrete
        # IntegrationsRepository here. Move this into a dedicated email
        # notification service that depends on interfaces only.
        from app.api.v1.integrations.email_service import EmailService
        from app.api.v1.integrations.repository import IntegrationsRepository

        email_service = EmailService(IntegrationsRepository())
        vendor = await email_service.get_default_email_vendor()
        html_content = build_mfa_email_html(code, lang)
        await vendor.send_email(to=email, subject=subject, html_content=html_content)
    except Exception:
        logger.warning("Failed to send MFA email code to %s", email)
        raise


async def _get_user_by_email(email: str) -> UserInDB:
    """Fetch a user by email or raise 404."""
    user = await UserInDB.find_one(UserInDB.email == email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return user


# ---------------------------------------------------------------------------
# Authenticated endpoints (Bearer JWT)
# ---------------------------------------------------------------------------


@router.post("/setup-totp", response_model=MfaSetupTotpResponse)
async def setup_totp(
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    mfa_service: Annotated[MfaService, Depends(_get_mfa_service)],
) -> MfaSetupTotpResponse:
    """Generate a TOTP secret and QR code for the authenticated user.

    The user must verify a code via ``/mfa/enable-totp`` to complete activation.
    """
    user = await _get_user_by_email(current_user_email)
    result = await mfa_service.setup_totp(str(user.id), user.email)
    return MfaSetupTotpResponse(**result)


@router.post("/enable-totp", response_model=None)
async def enable_totp(
    request: MfaEnableTotpRequest,
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    mfa_service: Annotated[MfaService, Depends(_get_mfa_service)],
) -> dict:
    """Activate TOTP MFA by verifying a code from the authenticator app.

    Returns recovery codes on success, or a success message if codes already exist.
    """
    user = await _get_user_by_email(current_user_email)

    # The secret must be passed from the setup step. Since the setup step
    # returns the secret to the client and it is not yet persisted, the
    # client must send it back.  However, the current schema only carries
    # the verification code.  To keep the flow working without schema
    # changes, we re-generate the secret from the stored encrypted value
    # if TOTP was already set up, or we require the client to call
    # setup-totp first and use the secret from that response.
    #
    # For the enable flow, the service's enable_totp expects the plain
    # secret.  Since setup_totp doesn't persist the secret yet, the
    # frontend must hold it in memory and we need it here.  The design
    # has the frontend call setup-totp, get the secret, then call
    # enable-totp with the code.  We need the secret from the setup step.
    #
    # The pragmatic approach: re-generate a fresh setup and verify in one
    # shot is not ideal.  Instead, we store the secret temporarily in the
    # user's totp_secret_encrypted field during setup (but don't mark TOTP
    # as enabled).  Let's check if there's already an encrypted secret.
    from app.core.security import decrypt_totp_secret

    if not user.totp_secret_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primero debe ejecutar /mfa/setup-totp para generar el secreto TOTP",
        )

    try:
        secret = decrypt_totp_secret(user.totp_secret_encrypted)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Secreto TOTP inválido. Ejecute /mfa/setup-totp nuevamente",
        )

    result = await mfa_service.enable_totp(
        str(user.id), request.code, secret, set_as_default=request.set_as_default
    )

    # The service already activated the method; recovery codes are only a side
    # effect of the first one. Log here, before the early return, so adding a
    # second method (when unused codes already exist) is audited too.
    from app.api.v1.users.audit_log import log_event, EVENT_MFA_ENABLED

    await log_event(EVENT_MFA_ENABLED, user.email, user_id=str(user.id), details="method: totp")

    if result["recovery_codes"] is None:
        return {"message": "TOTP MFA activado exitosamente", "codes": None}

    return {"codes": result["recovery_codes"]}


@router.post("/enable-email")
async def enable_email_mfa(
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    mfa_service: Annotated[MfaService, Depends(_get_mfa_service)],
    lang: Annotated[str, Depends(_extract_lang)],
) -> dict:
    """Initiate email MFA activation by sending a verification code."""
    user = await _get_user_by_email(current_user_email)
    result = await mfa_service.enable_email_mfa(str(user.id), user.email)

    # Send the code via email
    plain_code = result["code"]
    await _send_mfa_email(user.email, plain_code, lang)

    return {"message": "Código de verificación enviado al correo electrónico"}


@router.post("/verify-email-activation", response_model=None)
async def verify_email_activation(
    request: MfaVerifyEmailActivationRequest,
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    mfa_service: Annotated[MfaService, Depends(_get_mfa_service)],
) -> dict:
    """Confirm email MFA activation with the verification code.

    Returns recovery codes on success, or a success message if codes already exist.
    """
    user = await _get_user_by_email(current_user_email)
    result = await mfa_service.verify_email_activation(str(user.id), request.code)

    # Same ordering rule as TOTP: the method is active by now, whether or not new
    # recovery codes were issued for it.
    from app.api.v1.users.audit_log import log_event, EVENT_MFA_ENABLED

    await log_event(EVENT_MFA_ENABLED, user.email, user_id=str(user.id), details="method: email")

    if result["recovery_codes"] is None:
        return {"message": "Email MFA activado exitosamente", "codes": None}

    return {"codes": result["recovery_codes"]}


@router.post("/disable")
async def disable_mfa(
    request: MfaDisableRequest,
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    mfa_service: Annotated[MfaService, Depends(_get_mfa_service)],
) -> dict:
    """Disable a specific MFA method. Requires password confirmation."""
    user = await _get_user_by_email(current_user_email)
    await mfa_service.disable_mfa(str(user.id), request.password, request.method)

    from app.api.v1.users.audit_log import log_event, EVENT_MFA_DISABLED

    await log_event(
        EVENT_MFA_DISABLED,
        user.email,
        user_id=str(user.id),
        details=f"method: {request.method}",
    )

    return {"message": f"Método MFA '{request.method}' desactivado exitosamente"}


@router.get("/status", response_model=MfaStatusResponse)
async def get_mfa_status(
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    mfa_service: Annotated[MfaService, Depends(_get_mfa_service)],
) -> MfaStatusResponse:
    """Return the current MFA status for the authenticated user."""
    user = await _get_user_by_email(current_user_email)
    result = await mfa_service.get_mfa_status(str(user.id))
    return MfaStatusResponse(**result)


@router.post("/regenerate-recovery-codes", response_model=RecoveryCodesResponse)
async def regenerate_recovery_codes(
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    mfa_service: Annotated[MfaService, Depends(_get_mfa_service)],
) -> RecoveryCodesResponse:
    """Regenerate recovery codes, invalidating all previous ones."""
    user = await _get_user_by_email(current_user_email)

    if not user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA no está habilitado",
        )

    codes = await mfa_service.regenerate_recovery_codes(str(user.id))
    return RecoveryCodesResponse(codes=codes)


@router.put("/default-method")
async def set_default_method(
    request: MfaSetDefaultMethodRequest,
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    mfa_service: Annotated[MfaService, Depends(_get_mfa_service)],
) -> dict:
    """Change the default MFA method for the authenticated user."""
    user = await _get_user_by_email(current_user_email)

    if not user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA no está habilitado",
        )

    await mfa_service.set_default_method(str(user.id), request.method)
    return {"message": f"Método MFA predeterminado cambiado a '{request.method}'"}


# ---------------------------------------------------------------------------
# Unauthenticated endpoints (use mfa_token)
# ---------------------------------------------------------------------------


@router.post("/verify")
async def verify_mfa(
    request: MfaVerifyRequest,
    http_request: Request,
    mfa_service: Annotated[MfaService, Depends(_get_mfa_service)],
) -> dict:
    """Verify an MFA code during the login flow.

    Accepts TOTP codes, email codes, or recovery codes.
    Returns a full access token on success.
    """
    from app.api.v1.mfa.rate_limiter import mfa_verify_rate_limiter

    client_ip = http_request.client.host if http_request.client else "unknown"
    allowed, retry_after = mfa_verify_rate_limiter.is_allowed(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Demasiados intentos de verificación desde esta dirección. "
                f"Intente de nuevo en {retry_after} segundos."
            ),
            headers={"Retry-After": str(retry_after)},
        )

    return await mfa_service.verify_login_mfa(
        mfa_token=request.mfa_token,
        code=request.code,
        method=request.method,
        is_recovery_code=request.is_recovery_code,
    )


@router.post("/switch-method")
async def switch_method(
    request: MfaSwitchMethodRequest,
    mfa_service: Annotated[MfaService, Depends(_get_mfa_service)],
    lang: Annotated[str, Depends(_extract_lang)],
) -> dict:
    """Switch to an alternative MFA method during login verification.

    If switching to email, sends a new verification code.
    """
    # Decode the temporary MFA token
    try:
        payload = decode_mfa_temp_token(request.mfa_token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de verificación MFA inválido o expirado. Inicie sesión nuevamente",
        )

    email: str = payload.get("sub", "")
    available_methods: list[str] = payload.get("available_methods", [])

    # Verify the requested method is available
    if request.method not in available_methods:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El método MFA solicitado no está disponible",
        )

    # Get user from DB
    user = await _get_user_by_email(email)
    user_id = str(user.id)

    result = await mfa_service.switch_method(user_id, request.method, user.email)

    # If switching to email, send the code
    if request.method == "email" and "code" in result:
        await _send_mfa_email(user.email, result["code"], lang)

    return {"message": f"Método MFA cambiado a '{request.method}'"}


@router.post("/resend-email-code", response_model=MfaResendResponse)
async def resend_email_code(
    request: MfaResendRequest,
    mfa_service: Annotated[MfaService, Depends(_get_mfa_service)],
    lang: Annotated[str, Depends(_extract_lang)],
) -> MfaResendResponse:
    """Resend the email MFA verification code during login.

    Enforces resend limits (max 3) and cooldown (60s).
    """
    # Decode the temporary MFA token
    try:
        payload = decode_mfa_temp_token(request.mfa_token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de verificación MFA inválido o expirado. Inicie sesión nuevamente",
        )

    email: str = payload.get("sub", "")

    # Get user from DB
    user = await _get_user_by_email(email)
    user_id = str(user.id)

    result = await mfa_service.resend_email_code(user_id, user.email)

    # Send the new code via email
    plain_code = result["code"]
    await _send_mfa_email(user.email, plain_code, lang)

    return MfaResendResponse(
        message="Código de verificación reenviado",
        resends_remaining=result["resends_remaining"],
    )


# ---------------------------------------------------------------------------
# Admin endpoints (requires admin role)
# ---------------------------------------------------------------------------


async def _require_admin(email: str) -> UserInDB:
    """Verify the current user is an admin. Raises 403 if not."""
    user = await UserInDB.find_one(UserInDB.email == email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Acceso restringido a administradores"
        )
    return user


@router.get("/admin/users")
async def admin_list_users(
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    admin_service: Annotated[MfaAdminService, Depends(_get_mfa_admin_service)],
    page: int = 1,
    page_size: int = 20,
    search: str = "",
) -> dict:
    """List users with MFA status. Admin only. Supports pagination and search."""
    await _require_admin(current_user_email)

    return await admin_service.list_users(page=page, page_size=page_size, search=search)


@router.post("/admin/users/{user_id}/reset-mfa")
async def admin_reset_user_mfa(
    user_id: str,
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    admin_service: Annotated[MfaAdminService, Depends(_get_mfa_admin_service)],
) -> dict:
    """Reset (disable) all MFA methods for a user. Admin only."""
    admin = await _require_admin(current_user_email)

    return await admin_service.reset_user_mfa(user_id=user_id, admin_email=admin.email)


@router.get("/admin/users/export")
async def admin_export_users_excel(
    current_user_email: Annotated[str, Depends(get_current_user_email)],
    lang: Annotated[str, Depends(_extract_lang)],
    admin_service: Annotated[MfaAdminService, Depends(_get_mfa_admin_service)],
):
    """Export all users to an Excel file. Admin only."""
    await _require_admin(current_user_email)

    from datetime import datetime

    from fastapi.responses import StreamingResponse

    buffer = await admin_service.export_users_excel(lang)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M")
    filename = f"diagramahub_users_{timestamp}.xlsx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
