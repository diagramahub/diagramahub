"""
MFA repository implementation using Beanie ODM.
"""
from typing import Optional

from bson import ObjectId

from app.api.v1.mfa.interfaces import IMfaRepository
from app.api.v1.users.schemas import RecoveryCodeEntry, UserInDB


class MfaRepository(IMfaRepository):
    """Concrete implementation of MFA repository using MongoDB via Beanie."""

    async def enable_totp(self, user_id: str, encrypted_secret: str) -> bool:
        """Habilitar TOTP para un usuario guardando el secreto cifrado."""
        user = await UserInDB.get(ObjectId(user_id))
        if not user:
            return False

        user.totp_secret_encrypted = encrypted_secret
        if "totp" not in user.mfa_methods:
            user.mfa_methods.append("totp")
        user.mfa_enabled = True
        await user.save()
        return True

    async def enable_email_mfa(self, user_id: str) -> bool:
        """Habilitar MFA por email para un usuario."""
        user = await UserInDB.get(ObjectId(user_id))
        if not user:
            return False

        if "email" not in user.mfa_methods:
            user.mfa_methods.append("email")
        user.mfa_enabled = True
        await user.save()
        return True

    async def disable_mfa(self, user_id: str, method: str) -> bool:
        """Desactivar un método MFA específico y limpiar datos asociados."""
        user = await UserInDB.get(ObjectId(user_id))
        if not user:
            return False

        # Remove the method from active methods
        if method in user.mfa_methods:
            user.mfa_methods.remove(method)

        # Clear data associated with the disabled method
        if method == "totp":
            user.totp_secret_encrypted = None
        elif method == "email":
            user.email_mfa_code_hash = None
            user.email_mfa_code_expires = None

        # If no methods remain, fully disable MFA
        if not user.mfa_methods:
            user.mfa_enabled = False
            user.mfa_default_method = None
            user.recovery_codes = []
        else:
            # Set the remaining method as default
            user.mfa_default_method = user.mfa_methods[0]

        await user.save()
        return True

    async def set_default_method(self, user_id: str, method: str) -> bool:
        """Establecer el método MFA predeterminado."""
        user = await UserInDB.get(ObjectId(user_id))
        if not user:
            return False

        user.mfa_default_method = method
        await user.save()
        return True

    async def save_recovery_codes(self, user_id: str, hashed_codes: list[dict]) -> bool:
        """Guardar códigos de recuperación hasheados (lista de RecoveryCodeEntry dicts)."""
        user = await UserInDB.get(ObjectId(user_id))
        if not user:
            return False

        user.recovery_codes = [
            RecoveryCodeEntry(hash=code["hash"], used=code.get("used", False))
            for code in hashed_codes
        ]
        await user.save()
        return True

    async def get_mfa_data(self, user_id: str) -> Optional[dict]:
        """Obtener datos MFA del usuario."""
        user = await UserInDB.get(ObjectId(user_id))
        if not user:
            return None

        return {
            "mfa_enabled": user.mfa_enabled,
            "mfa_methods": user.mfa_methods,
            "mfa_default_method": user.mfa_default_method,
            "totp_secret_encrypted": user.totp_secret_encrypted,
            "recovery_codes": user.recovery_codes,
            "email_mfa_code_hash": user.email_mfa_code_hash,
            "email_mfa_code_expires": user.email_mfa_code_expires,
            "mfa_temp_resend_count": user.mfa_temp_resend_count,
            "mfa_temp_last_resend": user.mfa_temp_last_resend,
        }

    async def save_email_code(
        self, user_id: str, hashed_code: str, expires_at: float
    ) -> bool:
        """Guardar código email MFA hasheado con expiración."""
        user = await UserInDB.get(ObjectId(user_id))
        if not user:
            return False

        user.email_mfa_code_hash = hashed_code
        user.email_mfa_code_expires = expires_at
        await user.save()
        return True

    async def mark_recovery_code_used(self, user_id: str, code_index: int) -> bool:
        """Marcar un código de recuperación como usado."""
        user = await UserInDB.get(ObjectId(user_id))
        if not user:
            return False

        if code_index < 0 or code_index >= len(user.recovery_codes):
            return False

        user.recovery_codes[code_index].used = True
        await user.save()
        return True

    async def increment_mfa_attempts(self, user_id: str) -> int:
        """Incrementar contador de intentos MFA (tracked in JWT token, not DB)."""
        return 0

    async def save_mfa_temp_data(
        self, user_id: str, resend_count: int, last_resend_at: float
    ) -> bool:
        """Guardar datos temporales de sesión MFA (seguimiento de reenvíos)."""
        user = await UserInDB.get(ObjectId(user_id))
        if not user:
            return False

        user.mfa_temp_resend_count = resend_count
        user.mfa_temp_last_resend = last_resend_at
        await user.save()
        return True
