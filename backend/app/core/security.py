"""
Security utilities for authentication and password hashing.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet

from app.core.config import settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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


def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    """
    Create JWT access token.

    Args:
        subject: Token subject (typically user ID)
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
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
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM]
    )
