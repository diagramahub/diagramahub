"""
Tests for Google id_token verification and for the app's own JWTs (PyJWT).

The Google discovery document and JWKS are stubbed: a throwaway RSA key signs the
id_token and its public half is served as the key set, the way Google publishes it.
"""

import json
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.api.v1.oauth.providers.google import GoogleOAuthProvider
from app.api.v1.oauth.schemas import OAuthUserInfoError
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_mfa_temp_token,
    decode_access_token,
    decode_mfa_temp_token,
)
from tests.utils import generate_test_api_key, generate_test_secret

pytestmark = pytest.mark.unit

CLIENT_ID = "test-client-id.apps.googleusercontent.com"
KID = "test-key-1"


@pytest.fixture(scope="module")
def rsa_key() -> rsa.RSAPrivateKey:
    """RSA key that plays the role of Google's signing key."""
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def provider(rsa_key: rsa.RSAPrivateKey, monkeypatch: pytest.MonkeyPatch) -> GoogleOAuthProvider:
    """Google provider whose discovery document and JWKS are served locally."""
    public_jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(rsa_key.public_key()))
    public_jwk.update({"kid": KID, "use": "sig", "alg": "RS256"})

    instance = GoogleOAuthProvider(
        client_id=CLIENT_ID,
        client_secret=generate_test_secret("gcs"),
        redirect_uri="http://localhost/cb",
    )

    async def fake_discovery() -> dict:
        return {"jwks_uri": "https://example.test/jwks"}

    async def fake_jwks(_uri: str) -> dict:
        return {"keys": [public_jwk]}

    monkeypatch.setattr(instance, "_fetch_discovery", fake_discovery)
    monkeypatch.setattr(instance, "_fetch_jwks", fake_jwks)
    return instance


def _id_token(rsa_key: rsa.RSAPrivateKey, kid: str = KID, **overrides: object) -> str:
    """Sign an id_token with Google-like claims; ``overrides`` replace or add claims."""
    now = datetime.now(timezone.utc)
    claims: dict = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": "1234567890",
        "email": "user@example.com",
        "email_verified": True,
        "name": "Test User",
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    claims.update(overrides)
    return jwt.encode(claims, rsa_key, algorithm="RS256", headers={"kid": kid})


async def test_valid_id_token_returns_user_info(
    provider: GoogleOAuthProvider, rsa_key: rsa.RSAPrivateKey
) -> None:
    info = await provider._decode_id_token(_id_token(rsa_key))

    assert info.email == "user@example.com"
    assert info.email_verified is True
    assert info.full_name == "Test User"
    assert info.provider_user_id == "1234567890"


async def test_issuer_without_scheme_is_accepted(
    provider: GoogleOAuthProvider, rsa_key: rsa.RSAPrivateKey
) -> None:
    info = await provider._decode_id_token(_id_token(rsa_key, iss="accounts.google.com"))

    assert info.email == "user@example.com"


async def test_small_clock_skew_on_iat_is_tolerated(
    provider: GoogleOAuthProvider, rsa_key: rsa.RSAPrivateKey
) -> None:
    future_iat = datetime.now(timezone.utc) + timedelta(seconds=20)

    info = await provider._decode_id_token(_id_token(rsa_key, iat=future_iat))

    assert info.email == "user@example.com"


@pytest.mark.parametrize(
    "overrides",
    [
        {"aud": "someone-else"},
        {"iss": "https://evil.example.com"},
        {"exp": datetime.now(timezone.utc) - timedelta(hours=1)},
    ],
    ids=["wrong-audience", "wrong-issuer", "expired"],
)
async def test_invalid_claims_are_rejected(
    provider: GoogleOAuthProvider, rsa_key: rsa.RSAPrivateKey, overrides: dict
) -> None:
    with pytest.raises(OAuthUserInfoError):
        await provider._decode_id_token(_id_token(rsa_key, **overrides))


async def test_unknown_kid_is_rejected(
    provider: GoogleOAuthProvider, rsa_key: rsa.RSAPrivateKey
) -> None:
    with pytest.raises(OAuthUserInfoError):
        await provider._decode_id_token(_id_token(rsa_key, kid="rotated-away"))


async def test_token_signed_by_another_key_is_rejected(provider: GoogleOAuthProvider) -> None:
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    with pytest.raises(OAuthUserInfoError):
        await provider._decode_id_token(_id_token(other_key))


async def test_hs256_token_is_rejected(provider: GoogleOAuthProvider) -> None:
    """Algorithm confusion: an HMAC token must never pass as RS256."""
    forged = jwt.encode(
        {"iss": "https://accounts.google.com", "aud": CLIENT_ID, "sub": "1", "email": "x@y.z"},
        generate_test_api_key("hmac"),
        algorithm="HS256",
        headers={"kid": KID},
    )

    with pytest.raises(OAuthUserInfoError):
        await provider._decode_id_token(forged)


def test_access_token_round_trip() -> None:
    token = create_access_token("user@example.com", password_changed_at=123.0)

    payload = decode_access_token(token)

    assert payload["sub"] == "user@example.com"
    assert payload["pca"] == 123.0


def test_expired_access_token_is_rejected() -> None:
    token = create_access_token("user@example.com", expires_delta=timedelta(seconds=-1))

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(token)


def test_access_token_with_another_secret_is_rejected() -> None:
    forged = jwt.encode(
        {"sub": "user@example.com", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        generate_test_api_key("jwt"),
        algorithm=settings.JWT_ALGORITHM,
    )

    with pytest.raises(jwt.InvalidSignatureError):
        decode_access_token(forged)


def test_access_token_is_not_an_mfa_temp_token() -> None:
    token = create_access_token("user@example.com")

    with pytest.raises(jwt.InvalidTokenError):
        decode_mfa_temp_token(token)


def test_mfa_temp_token_round_trip() -> None:
    token = create_mfa_temp_token("user@example.com", "totp", ["totp", "email"])

    payload = decode_mfa_temp_token(token)

    assert payload["type"] == "mfa_temp"
    assert payload["available_methods"] == ["totp", "email"]
    assert payload["jti"]
