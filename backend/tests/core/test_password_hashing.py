"""
bcrypt's 72-byte limit: new passwords are rejected past it, older hashes keep working.

bcrypt only uses the first 72 bytes of its input. bcrypt < 5 cut longer input
silently; bcrypt 5 raises. The policy now rejects such passwords up front, and
verification still accepts the full password a user typed when the limit wasn't
enforced.
"""

import bcrypt
import pytest

from app.api.v1.users.schemas import _validate_password_strength
from app.core.security import BCRYPT_MAX_BYTES, get_password_hash, verify_password

pytestmark = pytest.mark.unit

# Meets every rule of the policy; padded to the wanted size with "a".
_PREFIX = "Aa1!"


def _password(size_in_bytes: int, filler: str = "a") -> str:
    filler_bytes = len(filler.encode("utf-8"))
    count = (size_in_bytes - len(_PREFIX)) // filler_bytes
    return _PREFIX + filler * count


def test_policy_accepts_exactly_72_bytes() -> None:
    password = _password(BCRYPT_MAX_BYTES)

    assert len(password.encode("utf-8")) == BCRYPT_MAX_BYTES
    assert _validate_password_strength(password) == password


def test_policy_rejects_73_bytes() -> None:
    with pytest.raises(ValueError, match="72 bytes"):
        _validate_password_strength(_password(BCRYPT_MAX_BYTES) + "a")


def test_policy_counts_bytes_not_characters() -> None:
    # 42 characters but 80 bytes: "ñ" takes two.
    password = _password(80, filler="ñ")

    assert len(password) < 72
    with pytest.raises(ValueError, match="72 bytes"):
        _validate_password_strength(password)


def test_hash_round_trip() -> None:
    password = _password(40)

    hashed = get_password_hash(password)

    assert verify_password(password, hashed)
    assert not verify_password(password + "x", hashed)


def test_hashing_more_than_72_bytes_raises() -> None:
    with pytest.raises(ValueError):
        get_password_hash("a" * (BCRYPT_MAX_BYTES + 1))


def test_legacy_hash_of_a_long_password_still_verifies() -> None:
    """A hash made by bcrypt < 5 from a 100-byte password (cut to 72 bytes)."""
    long_password = _password(100)
    legacy_hash = bcrypt.hashpw(
        long_password.encode("utf-8")[:BCRYPT_MAX_BYTES], bcrypt.gensalt()
    ).decode("utf-8")

    assert verify_password(long_password, legacy_hash)
    assert not verify_password("x" + long_password[1:], legacy_hash)


@pytest.mark.integration
async def test_registration_rejects_a_password_over_72_bytes(client) -> None:
    response = await client.post(
        "/api/v1/users/register",
        json={
            "email": "long-password@example.com",
            "password": _password(80, filler="ñ"),
            "full_name": "Long Password",
        },
    )

    assert response.status_code == 422
