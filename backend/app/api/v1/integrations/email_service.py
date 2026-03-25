"""
Email service for sending transactional emails using the configured default email vendor.
"""
import logging
from urllib.parse import quote

from fastapi import HTTPException, status

from app.core.config import settings

from .email_vendors.interfaces import IEmailVendor
from .repository import IntegrationsRepository
from .schemas import VendorCategory, VendorConfigInDB
from .vendor_factory import VendorFactory

logger = logging.getLogger(__name__)


class EmailService:
    """Service that sends transactional emails through the default email vendor."""

    def __init__(self, integrations_repository: IntegrationsRepository):
        self.repo = integrations_repository

    async def get_default_email_vendor(self) -> IEmailVendor:
        """Obtain the default email vendor from the DB and instantiate it via VendorFactory.

        Returns:
            An initialised ``IEmailVendor`` instance ready to send emails.

        Raises:
            HTTPException 503: When no default email vendor is configured.
        """
        vendors = await VendorConfigInDB.find(
            VendorConfigInDB.category == VendorCategory.EMAIL,
            VendorConfigInDB.is_default == True,  # noqa: E712
        ).to_list()

        if not vendors:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de correo no disponible",
            )

        vendor = vendors[0]
        config = self.repo._decrypt_config(vendor.encrypted_config)
        return VendorFactory.create_email_vendor(vendor.vendor_type, config)

    async def send_password_recovery_email(
        self, to: str, token: str, email: str
    ) -> None:
        """Send a password-recovery email with a reset link.

        Args:
            to: Recipient email address.
            token: The password-reset token.
            email: The user email (included in the reset URL).

        Raises:
            HTTPException 503: If no default email vendor is configured.
            HTTPException 500: If the email vendor fails to send.
        """
        vendor = await self.get_default_email_vendor()

        recovery_url = (
            f"{settings.FRONTEND_URL}/reset-password"
            f"?token={quote(token, safe='')}&email={quote(email, safe='')}"
        )

        subject = "Recupera tu contraseña — DiagramaHub"
        html_content = _build_recovery_html(recovery_url)

        try:
            await vendor.send_email(to=to, subject=subject, html_content=html_content)
        except Exception:
            logger.exception("Error al enviar correo de recuperación")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al enviar correo de recuperación",
            )


def _build_recovery_html(recovery_url: str) -> str:
    """Return a clean HTML email template for password recovery."""
    return f"""\
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recupera tu contraseña</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#4f46e5;padding:28px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">DiagramaHub</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 20px;">
              <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600;">Recupera tu contraseña</h2>
              <p style="margin:0 0 24px;color:#51545e;font-size:15px;line-height:1.6;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón de abajo para crear una nueva contraseña. Este enlace expirará en <strong>1 hora</strong>.
              </p>
              <!-- Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="{recovery_url}" target="_blank" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:6px;">
                      Restablecer contraseña
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#51545e;font-size:13px;line-height:1.5;">
                Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:
              </p>
              <p style="margin:0 0 24px;word-break:break-all;color:#4f46e5;font-size:13px;line-height:1.5;">
                {recovery_url}
              </p>
              <p style="margin:0;color:#9b9ba5;font-size:13px;line-height:1.5;">
                Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña no será modificada.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #eaeaec;text-align:center;">
              <p style="margin:0;color:#9b9ba5;font-size:12px;">&copy; DiagramaHub. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
