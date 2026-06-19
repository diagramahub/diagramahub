"""Security-oriented helpers for test credentials."""

from __future__ import annotations

import secrets
import string

_SPECIAL_CHARACTERS = "!@#$%^&*"


def _random_fragment(length: int = 10) -> str:
    """Return a URL-safe alphanumeric fragment for test-only values."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_test_password(label: str = "Test") -> str:
    """Generate a strong password that satisfies the application policy."""
    return f"{label}-{_random_fragment(10)}Aa1{secrets.choice(_SPECIAL_CHARACTERS)}"


def generate_weak_password() -> str:
    """Generate a deliberately weak password for negative validation tests."""
    return f"weak-{_random_fragment(4).lower()}"


def generate_password_missing_uppercase() -> str:
    """Generate a password missing uppercase characters."""
    return f"lower-{_random_fragment(8).lower()}1{secrets.choice(_SPECIAL_CHARACTERS)}"


def generate_password_missing_digit() -> str:
    """Generate a password missing digits."""
    letters = "".join(secrets.choice(string.ascii_letters) for _ in range(10))
    return f"NoDigit-{letters}{secrets.choice(_SPECIAL_CHARACTERS)}"


def generate_password_missing_lowercase() -> str:
    """Generate a password missing lowercase characters."""
    letters = "".join(secrets.choice(string.ascii_uppercase) for _ in range(10))
    return f"UPPER-{letters}1{secrets.choice(_SPECIAL_CHARACTERS)}"


def generate_test_token(prefix: str = "tok") -> str:
    """Generate a random token-like value for tests (not a real credential)."""
    return f"{prefix}-{secrets.token_hex(8)}"


def generate_test_secret(prefix: str = "sk") -> str:
    """Generate a random secret-like value for tests (not a real credential)."""
    return f"{prefix}-{secrets.token_hex(12)}"


def generate_test_api_key(prefix: str = "key") -> str:
    """Generate a random API-key-like value for tests (not a real credential)."""
    return f"{prefix}-{secrets.token_hex(16)}"
