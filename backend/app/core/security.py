"""
Security utilities for authentication and password hashing.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from cryptography.fernet import Fernet
from jose import JWTError, jwt

from app.core.config import settings


class _BcryptContext:
    """Minimal bcrypt wrapper that mimics passlib's CryptContext interface.

    Exposes ``.hash()`` and ``.verify()`` so that code importing ``pwd_context``
    from this module does not need to change after removing the passlib dependency.
    """

    @staticmethod
    def hash(secret: str) -> str:
        """Hash a secret using bcrypt (salt auto-generated)."""
        return bcrypt.hashpw(secret.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    @staticmethod
    def verify(secret: str, hash: str) -> bool:
        """Verify a secret against a bcrypt hash."""
        return bcrypt.checkpw(secret.encode("utf-8"), hash.encode("utf-8"))


# Password hashing context — drop-in replacement for passlib's CryptContext
pwd_context = _BcryptContext()


def get_cipher() -> Fernet:
    """
    Get Fernet cipher instance for encryption/decryption.

    Returns:
        Fernet cipher instance

    Raises:
        ValueError: If AI_ENCRYPTION_KEY is not configured
    """
    if not settings.AI_ENCRYPTION_KEY:
        raise ValueError("AI_ENCRYPTION_KEY not configured in environment variables")
    return Fernet(settings.AI_ENCRYPTION_KEY.encode())


def encrypt_api_key(api_key: str) -> str:
    """
    Encrypt an API key before storing in database.

    Args:
        api_key: Plain text API key

    Returns:
        Encrypted API key as string
    """
    cipher = get_cipher()
    return cipher.encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """
    Decrypt an API key from database.

    Args:
        encrypted_key: Encrypted API key

    Returns:
        Plain text API key

    Raises:
        cryptography.fernet.InvalidToken: If key is invalid or corrupted
    """
    cipher = get_cipher()
    return cipher.decrypt(encrypted_key.encode()).decode()


def mask_api_key(api_key: str) -> str:
    """
    Mask an API key for display purposes.

    Args:
        api_key: Plain text API key

    Returns:
        Masked API key (e.g., 'AIza...xyz')
    """
    if len(api_key) <= 8:
        return "***"
    return f"{api_key[:4]}...{api_key[-3:]}"


def create_access_token(
    subject: str | Any,
    expires_delta: timedelta | None = None,
    mfa_enabled: bool = False,
    password_changed_at: float | None = None,
) -> str:
    """
    Create JWT access token.

    Token duration is determined by the following priority:
    1. ``expires_delta`` if explicitly provided.
    2. 5 days (120 h) when ``mfa_enabled`` is ``True``.
    3. 2 days (48 h) when ``mfa_enabled`` is ``False``.

    Args:
        subject: Token subject (typically user email).
        expires_delta: Optional custom expiration time.
        mfa_enabled: Whether the user has MFA enabled.
        password_changed_at: Timestamp of last password change (for session invalidation).

    Returns:
        Encoded JWT token.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    elif mfa_enabled:
        expire = datetime.now(timezone.utc) + timedelta(days=5)
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=2)

    to_encode: dict[str, Any] = {"exp": expire, "sub": str(subject)}
    if password_changed_at is not None:
        to_encode["pca"] = password_changed_at
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.

    Args:
        plain_password: Plain text password
        hashed_password: Hashed password to verify against

    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hash a password.

    Args:
        password: Plain text password

    Returns:
        Hashed password
    """
    return pwd_context.hash(password)


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and verify JWT token.

    Args:
        token: JWT token to decode

    Returns:
        Decoded token payload

    Raises:
        jose.JWTError: If token is invalid or expired
    """
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


# --- MFA Security Functions ---

MFA_TEMP_TOKEN_EXPIRE_MINUTES = 5


def create_mfa_temp_token(
    subject: str, mfa_default_method: str, available_methods: list[str]
) -> str:
    """
    Create a temporary MFA verification JWT token.

    Issued after successful credential validation when MFA is enabled.
    The token carries MFA context and expires in 5 minutes.

    Args:
        subject: User identifier (typically email)
        mfa_default_method: The user's default MFA method ("email" or "totp")
        available_methods: List of active MFA methods for the user

    Returns:
        Encoded JWT token with MFA claims
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=MFA_TEMP_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": str(subject),
        "type": "mfa_temp",
        "mfa_default_method": mfa_default_method,
        "available_methods": available_methods,
        "attempt_count": 0,
        "exp": expire,
    }
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_mfa_temp_token(token: str) -> dict:
    """
    Decode and validate a temporary MFA verification token.

    Verifies the token signature, expiration, and that it contains
    the expected ``type: "mfa_temp"`` claim.

    Args:
        token: JWT token to decode

    Returns:
        Full claims dictionary from the token

    Raises:
        jose.JWTError: If the token is invalid, expired, or not an MFA temp token
    """
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != "mfa_temp":
        raise JWTError("Invalid MFA token type")
    return payload


def encrypt_totp_secret(secret: str) -> str:
    """
    Encrypt a TOTP secret string using Fernet symmetric encryption.

    Uses the same AI_ENCRYPTION_KEY used for encrypting AI provider API keys.

    Args:
        secret: Plain text TOTP secret (base32 string)

    Returns:
        Encrypted secret as a base64-encoded string

    Raises:
        ValueError: If AI_ENCRYPTION_KEY is not configured
    """
    cipher = get_cipher()
    return cipher.encrypt(secret.encode()).decode()


def decrypt_totp_secret(encrypted: str) -> str:
    """
    Decrypt a Fernet-encrypted TOTP secret.

    Args:
        encrypted: Encrypted TOTP secret (base64-encoded string)

    Returns:
        Original plain text TOTP secret

    Raises:
        ValueError: If AI_ENCRYPTION_KEY is not configured
        cryptography.fernet.InvalidToken: If the encrypted data is invalid or corrupted
    """
    cipher = get_cipher()
    return cipher.decrypt(encrypted.encode()).decode()
