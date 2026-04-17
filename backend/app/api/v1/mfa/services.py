"""
MFA service layer implementing business logic for Multi-Factor Authentication.

Handles TOTP and email MFA setup, verification, recovery codes, and method management.
Depends on IMfaRepository (Dependency Inversion) and uses TotpService for TOTP operations.
"""
import logging
import secrets
import string
import time

from fastapi import HTTPException, status

from app.api.v1.mfa.interfaces import IMfaRepository
from app.api.v1.mfa.totp_service import TotpService
from app.api.v1.users.schemas import UserInDB
from app.core.security import (
    decrypt_totp_secret,
    encrypt_totp_secret,
    pwd_context,
    verify_password,
)

logger = logging.getLogger(__name__)

# Constants
RECOVERY_CODE_COUNT = 8
RECOVERY_CODE_LENGTH = 10
EMAIL_CODE_EXPIRATION_SECONDS = 600  # 10 minutes
MAX_RESENDS = 3
RESEND_COOLDOWN_SECONDS = 60


class MfaService:
    """Service class handling MFA business logic."""

    def __init__(self, repository: IMfaRepository):
        """
        Initialize MFA service with repository.

        Args:
            repository: MFA repository implementation
        """
        self.repository = repository

    # ------------------------------------------------------------------
    # TOTP setup & activation
    # ------------------------------------------------------------------

    async def setup_totp(self, user_id: str, email: str) -> dict:
        """Generate a TOTP secret and return QR code + secret key for setup.

        The encrypted secret is persisted in the user document so that the
        subsequent ``enable_totp`` call can retrieve it for verification.
        TOTP is **not** marked as enabled until the user verifies a code.

        Args:
            user_id: The user's ID.
            email: The user's email address (used in the QR URI).

        Returns:
            Dict with ``qr_code_base64`` and ``secret_key``.
        """
        secret = TotpService.generate_secret()
        uri = TotpService.generate_qr_uri(secret, email)
        qr_base64 = TotpService.generate_qr_base64(uri)

        # Persist the encrypted secret so enable_totp can retrieve it later.
        # TOTP is NOT added to mfa_methods yet — that happens in enable_totp.
        encrypted_secret = encrypt_totp_secret(secret)
        from bson import ObjectId

        user = await UserInDB.get(ObjectId(user_id))
        if user:
            user.totp_secret_encrypted = encrypted_secret
            await user.save()

        return {
            "qr_code_base64": qr_base64,
            "secret_key": secret,
        }

    async def enable_totp(
        self,
        user_id: str,
        code: str,
        secret: str,
        set_as_default: bool = True,
    ) -> dict:
        """Verify a TOTP code and activate TOTP MFA for the user.

        Args:
            user_id: The user's ID.
            code: 6-digit TOTP code from the authenticator app.
            secret: Plain-text TOTP secret (from the setup step).
            set_as_default: Whether to set TOTP as the default MFA method.

        Returns:
            Dict with ``recovery_codes`` list.

        Raises:
            HTTPException 400: If the TOTP code is invalid.
        """
        if not TotpService.verify_code(secret, code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código TOTP inválido",
            )

        encrypted_secret = encrypt_totp_secret(secret)
        await self.repository.enable_totp(user_id, encrypted_secret)

        # Determine whether to set as default method
        mfa_data = await self.repository.get_mfa_data(user_id)
        is_first_method = not mfa_data or len(
            [m for m in mfa_data.get("mfa_methods", []) if m != "totp"]
        ) == 0
        if is_first_method or set_as_default:
            await self.repository.set_default_method(user_id, "totp")

        # Only generate recovery codes if user doesn't already have unused ones
        existing_codes = mfa_data.get("recovery_codes", []) if mfa_data else []
        has_unused_codes = any(
            not (entry.used if hasattr(entry, "used") else entry.get("used", False))
            for entry in existing_codes
        )

        if has_unused_codes:
            return {"recovery_codes": None}

        plain_codes, hashed_entries = self._generate_recovery_codes()
        await self.repository.save_recovery_codes(user_id, hashed_entries)

        return {"recovery_codes": plain_codes}

    # ------------------------------------------------------------------
    # Email MFA setup & activation
    # ------------------------------------------------------------------

    async def enable_email_mfa(self, user_id: str, email: str) -> dict:
        """Generate and store an email verification code for MFA activation.

        The caller (route layer) is responsible for sending the email with
        the returned plain-text code.

        Args:
            user_id: The user's ID.
            email: The user's email address.

        Returns:
            Dict with ``code`` (plain-text 6-digit code) for the route to send.
        """
        plain_code, hashed_code = self._generate_email_code()
        expires_at = time.time() + EMAIL_CODE_EXPIRATION_SECONDS

        await self.repository.save_email_code(user_id, hashed_code, expires_at)

        return {"code": plain_code}

    async def verify_email_activation(
        self,
        user_id: str,
        code: str,
        set_as_default: bool = True,
    ) -> dict:
        """Verify the email code and activate email MFA for the user.

        Args:
            user_id: The user's ID.
            code: 6-digit code the user received via email.
            set_as_default: Whether to set email as the default MFA method.

        Returns:
            Dict with ``recovery_codes`` list.

        Raises:
            HTTPException 400: If the code is invalid or expired.
        """
        mfa_data = await self.repository.get_mfa_data(user_id)
        if not mfa_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Datos MFA no encontrados",
            )

        stored_hash = mfa_data.get("email_mfa_code_hash")
        expires_at = mfa_data.get("email_mfa_code_expires")

        if not stored_hash or not expires_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No hay código de verificación pendiente",
            )

        if time.time() > expires_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El código de verificación ha expirado",
            )

        if not pwd_context.verify(code, stored_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código de verificación inválido",
            )

        await self.repository.enable_email_mfa(user_id)

        # Refresh MFA data after enabling
        mfa_data = await self.repository.get_mfa_data(user_id)
        is_first_method = not mfa_data or len(
            [m for m in mfa_data.get("mfa_methods", []) if m != "email"]
        ) == 0
        if is_first_method or set_as_default:
            await self.repository.set_default_method(user_id, "email")

        # Only generate recovery codes if user doesn't already have unused ones
        existing_codes = mfa_data.get("recovery_codes", []) if mfa_data else []
        has_unused_codes = any(
            not (entry.used if hasattr(entry, "used") else entry.get("used", False))
            for entry in existing_codes
        )

        if has_unused_codes:
            return {"recovery_codes": None}

        plain_codes, hashed_entries = self._generate_recovery_codes()
        await self.repository.save_recovery_codes(user_id, hashed_entries)

        return {"recovery_codes": plain_codes}

    # ------------------------------------------------------------------
    # Disable MFA
    # ------------------------------------------------------------------

    async def disable_mfa(self, user_id: str, password: str, method: str) -> None:
        """Disable a specific MFA method after verifying the user's password.

        Args:
            user_id: The user's ID.
            password: The user's current password for confirmation.
            method: MFA method to disable (``"email"`` or ``"totp"``).

        Raises:
            HTTPException 403: If the password is incorrect.
            HTTPException 404: If the user is not found.
        """
        from bson import ObjectId

        user = await UserInDB.get(ObjectId(user_id))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado",
            )

        if not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Contraseña incorrecta",
            )

        await self.repository.disable_mfa(user_id, method)

    # ------------------------------------------------------------------
    # MFA code verification (login flow)
    # ------------------------------------------------------------------

    async def verify_mfa_code(
        self, user_id: str, code: str, mfa_method: str
    ) -> bool:
        """Verify an MFA code for the given method.

        Args:
            user_id: The user's ID.
            code: The 6-digit code to verify.
            mfa_method: ``"totp"`` or ``"email"``.

        Returns:
            ``True`` if the code is valid, ``False`` otherwise.
        """
        mfa_data = await self.repository.get_mfa_data(user_id)
        if not mfa_data:
            return False

        if mfa_method == "totp":
            encrypted_secret = mfa_data.get("totp_secret_encrypted")
            if not encrypted_secret:
                return False
            try:
                secret = decrypt_totp_secret(encrypted_secret)
            except Exception:
                logger.exception("Failed to decrypt TOTP secret for user %s", user_id)
                return False
            return TotpService.verify_code(secret, code)

        if mfa_method == "email":
            stored_hash = mfa_data.get("email_mfa_code_hash")
            expires_at = mfa_data.get("email_mfa_code_expires")
            if not stored_hash or not expires_at:
                return False
            if time.time() > expires_at:
                return False
            return pwd_context.verify(code, stored_hash)

        return False

    # ------------------------------------------------------------------
    # Recovery codes
    # ------------------------------------------------------------------

    async def verify_recovery_code(self, user_id: str, code: str) -> bool:
        """Verify a recovery code and mark it as used if valid.

        Iterates through unused recovery codes and checks each hash.

        Args:
            user_id: The user's ID.
            code: The plain-text recovery code (format ``XXXXX-XXXXX``).

        Returns:
            ``True`` if a matching unused code was found and marked used,
            ``False`` otherwise.
        """
        mfa_data = await self.repository.get_mfa_data(user_id)
        if not mfa_data:
            return False

        recovery_codes = mfa_data.get("recovery_codes", [])
        # Normalize: remove dashes for comparison
        normalized_code = code.replace("-", "")

        for index, entry in enumerate(recovery_codes):
            # entry can be a dict or a RecoveryCodeEntry model
            entry_hash = entry.hash if hasattr(entry, "hash") else entry.get("hash", "")
            entry_used = entry.used if hasattr(entry, "used") else entry.get("used", False)

            if entry_used:
                continue

            if pwd_context.verify(normalized_code, entry_hash):
                await self.repository.mark_recovery_code_used(user_id, index)
                return True

        return False

    async def regenerate_recovery_codes(self, user_id: str) -> list[str]:
        """Generate a new set of recovery codes, replacing all previous ones.

        Args:
            user_id: The user's ID.

        Returns:
            List of 8 plain-text recovery codes in ``XXXXX-XXXXX`` format.
        """
        plain_codes, hashed_entries = self._generate_recovery_codes()
        await self.repository.save_recovery_codes(user_id, hashed_entries)
        return plain_codes

    # ------------------------------------------------------------------
    # Email code resend (login flow)
    # ------------------------------------------------------------------

    async def resend_email_code(self, user_id: str, email: str) -> dict:
        """Generate a new email MFA code with resend limit enforcement.

        The caller (route layer) is responsible for sending the email.

        Args:
            user_id: The user's ID.
            email: The user's email address.

        Returns:
            Dict with ``code`` (plain-text) and ``resends_remaining``.

        Raises:
            HTTPException 429: If resend limit or cooldown is exceeded.
        """
        mfa_data = await self.repository.get_mfa_data(user_id)
        resend_count = 0
        last_resend = None

        if mfa_data:
            resend_count = mfa_data.get("mfa_temp_resend_count", 0)
            last_resend = mfa_data.get("mfa_temp_last_resend")

        # Check resend limit
        if resend_count >= MAX_RESENDS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Límite de reenvíos alcanzado",
            )

        # Check cooldown
        if last_resend and (time.time() - last_resend) < RESEND_COOLDOWN_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Espere 60 segundos antes de reenviar",
            )

        # Generate new code
        plain_code, hashed_code = self._generate_email_code()
        expires_at = time.time() + EMAIL_CODE_EXPIRATION_SECONDS

        await self.repository.save_email_code(user_id, hashed_code, expires_at)

        # Update resend tracking
        new_resend_count = resend_count + 1
        await self.repository.save_mfa_temp_data(
            user_id, new_resend_count, time.time()
        )

        return {
            "code": plain_code,
            "resends_remaining": MAX_RESENDS - new_resend_count,
        }

    # ------------------------------------------------------------------
    # Method switching & default management
    # ------------------------------------------------------------------

    async def switch_method(
        self, user_id: str, method: str, email: str
    ) -> dict:
        """Switch to an alternative MFA method during login verification.

        If switching to email, generates and stores a new email code.
        The caller (route layer) is responsible for sending the email.

        Args:
            user_id: The user's ID.
            method: The MFA method to switch to (``"email"`` or ``"totp"``).
            email: The user's email address (used if switching to email).

        Returns:
            Dict with ``code`` key if switching to email (for the route to send),
            or empty dict if switching to TOTP.
        """
        if method == "email":
            plain_code, hashed_code = self._generate_email_code()
            expires_at = time.time() + EMAIL_CODE_EXPIRATION_SECONDS
            await self.repository.save_email_code(user_id, hashed_code, expires_at)
            return {"code": plain_code}

        # Switching to TOTP — no server-side action needed
        return {}

    async def set_default_method(self, user_id: str, method: str) -> None:
        """Change the user's default MFA method.

        Args:
            user_id: The user's ID.
            method: The MFA method to set as default (``"email"`` or ``"totp"``).

        Raises:
            HTTPException 400: If the method is not in the user's active methods.
        """
        mfa_data = await self.repository.get_mfa_data(user_id)
        if not mfa_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Datos MFA no encontrados",
            )

        active_methods = mfa_data.get("mfa_methods", [])
        if method not in active_methods:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El método MFA solicitado no está activo",
            )

        await self.repository.set_default_method(user_id, method)

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    async def get_mfa_status(self, user_id: str) -> dict:
        """Get the current MFA status for a user.

        Args:
            user_id: The user's ID.

        Returns:
            Dict with ``enabled``, ``methods``, ``default_method``,
            and ``recovery_codes_remaining``.
        """
        mfa_data = await self.repository.get_mfa_data(user_id)
        if not mfa_data:
            return {
                "enabled": False,
                "methods": [],
                "default_method": None,
                "recovery_codes_remaining": 0,
            }

        recovery_codes = mfa_data.get("recovery_codes", [])
        unused_count = sum(
            1
            for entry in recovery_codes
            if not (entry.used if hasattr(entry, "used") else entry.get("used", False))
        )

        return {
            "enabled": mfa_data.get("mfa_enabled", False),
            "methods": mfa_data.get("mfa_methods", []),
            "default_method": mfa_data.get("mfa_default_method"),
            "recovery_codes_remaining": unused_count,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _generate_recovery_codes() -> tuple[list[str], list[dict]]:
        """Generate a set of recovery codes with their BCrypt hashes.

        Each code is 10 alphanumeric characters (uppercase + digits),
        formatted as ``XXXXX-XXXXX`` for readability.

        Returns:
            Tuple of (plain_codes_formatted, hashed_entries).
            ``plain_codes_formatted`` contains codes in ``XXXXX-XXXXX`` format.
            ``hashed_entries`` contains dicts with ``hash`` and ``used`` keys.
        """
        alphabet = string.ascii_uppercase + string.digits
        plain_codes: list[str] = []
        hashed_entries: list[dict] = []

        for _ in range(RECOVERY_CODE_COUNT):
            raw = "".join(secrets.choice(alphabet) for _ in range(RECOVERY_CODE_LENGTH))
            formatted = f"{raw[:5]}-{raw[5:]}"
            plain_codes.append(formatted)
            hashed_entries.append({
                "hash": pwd_context.hash(raw),
                "used": False,
            })

        return plain_codes, hashed_entries

    @staticmethod
    def _generate_email_code() -> tuple[str, str]:
        """Generate a 6-digit email verification code with its BCrypt hash.

        Returns:
            Tuple of (plain_code, hashed_code).
        """
        plain_code = "".join(secrets.choice(string.digits) for _ in range(6))
        hashed_code = pwd_context.hash(plain_code)
        return plain_code, hashed_code
