"""
Email vendor interface definition.
"""
from abc import ABC, abstractmethod


class IEmailVendor(ABC):
    """Interfaz abstracta para vendors de email."""

    @abstractmethod
    async def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        from_email: str | None = None
    ) -> dict:
        """
        Envía un correo electrónico.

        Args:
            to: Dirección de email del destinatario
            subject: Asunto del correo
            html_content: Contenido HTML del correo
            from_email: Dirección de email del remitente (opcional, usa default del vendor)

        Returns:
            dict con información del envío (e.g., {"id": str, "status": str})
        """
        pass

    @abstractmethod
    async def test_connection(self) -> bool:
        """
        Prueba la conexión con el vendor.

        Returns:
            True si la conexión es exitosa
        """
        pass

    @abstractmethod
    def get_vendor_name(self) -> str:
        """Retorna el nombre del vendor (e.g., 'resend')."""
        pass
