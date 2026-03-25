"""
Resend email vendor adapter implementation.
"""
import logging

import resend

from .interfaces import IEmailVendor

logger = logging.getLogger(__name__)


class ResendAdapter(IEmailVendor):
    """Adaptador concreto para el vendor de email Resend."""

    def __init__(self, api_key: str, from_email: str):
        self.api_key = api_key
        self.from_email = from_email
        resend.api_key = self.api_key

    async def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        from_email: str | None = None,
    ) -> dict:
        """Envía un correo electrónico usando la API async de Resend."""
        params: resend.Emails.SendParams = {
            "from": from_email or self.from_email,
            "to": [to],
            "subject": subject,
            "html": html_content,
        }

        response = await resend.Emails.send_async(params)
        return {"id": response["id"], "status": "sent"}

    async def test_connection(self) -> bool:
        """Prueba la conexión enviando un email de prueba vía la API de Resend.

        Usa el from_email configurado para enviar a la dirección de test
        de Resend (delivered@resend.dev). Esto funciona incluso con API
        keys restringidas a solo envío.
        """
        try:
            resend.api_key = self.api_key
            logger.info(
                "Resend test_connection: sending test email from=%s",
                self.from_email,
            )

            params: resend.Emails.SendParams = {
                "from": self.from_email,
                "to": ["delivered@resend.dev"],
                "subject": "DiagramaHub — Test de conexión",
                "html": "<p>Test de conexión exitoso.</p>",
            }

            if hasattr(resend.Emails, "send_async"):
                response = await resend.Emails.send_async(params)
            else:
                response = resend.Emails.send(params)

            logger.info("Resend test_connection: SUCCESS (id=%s)", response.get("id"))
            return True
        except Exception as exc:
            logger.error(
                "Resend test_connection FAILED: type=%s, message=%s",
                type(exc).__name__,
                str(exc),
            )
            return False

    def get_vendor_name(self) -> str:
        return "resend"
