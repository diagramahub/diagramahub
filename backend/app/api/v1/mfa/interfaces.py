"""
MFA repository interface following Dependency Inversion Principle.
"""
from abc import ABC, abstractmethod
from typing import Optional


class IMfaRepository(ABC):
    """Interfaz para operaciones de repositorio MFA."""

    @abstractmethod
    async def enable_totp(self, user_id: str, encrypted_secret: str) -> bool:
        """Habilitar TOTP para un usuario guardando el secreto cifrado."""
        pass

    @abstractmethod
    async def enable_email_mfa(self, user_id: str) -> bool:
        """Habilitar MFA por email para un usuario."""
        pass

    @abstractmethod
    async def disable_mfa(self, user_id: str, method: str) -> bool:
        """Desactivar un método MFA específico y limpiar datos asociados."""
        pass

    @abstractmethod
    async def set_default_method(self, user_id: str, method: str) -> bool:
        """Establecer el método MFA predeterminado."""
        pass

    @abstractmethod
    async def save_recovery_codes(self, user_id: str, hashed_codes: list[dict]) -> bool:
        """Guardar códigos de recuperación hasheados (lista de RecoveryCodeEntry dicts)."""
        pass

    @abstractmethod
    async def get_mfa_data(self, user_id: str) -> Optional[dict]:
        """Obtener datos MFA del usuario."""
        pass

    @abstractmethod
    async def save_email_code(
        self, user_id: str, hashed_code: str, expires_at: float
    ) -> bool:
        """Guardar código email MFA hasheado con expiración."""
        pass

    @abstractmethod
    async def mark_recovery_code_used(self, user_id: str, code_index: int) -> bool:
        """Marcar un código de recuperación como usado."""
        pass

    @abstractmethod
    async def increment_mfa_attempts(self, user_id: str) -> int:
        """Incrementar contador de intentos MFA, retorna el nuevo conteo."""
        pass

    @abstractmethod
    async def save_mfa_temp_data(
        self, user_id: str, resend_count: int, last_resend_at: float
    ) -> bool:
        """Guardar datos temporales de sesión MFA (seguimiento de reenvíos)."""
        pass
