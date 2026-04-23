"""
Google OAuth 2.0 / OpenID Connect provider adapter.

Uses Google's discovery document to resolve endpoints dynamically.
Validates id_token signature and claims (iss, aud, exp) using
Google's public keys.
"""
import logging
from urllib.parse import urlencode

import httpx
from jose import jwt as jose_jwt
from jose.exceptions import JWTError

from ..interfaces import IOAuthProvider
from ..schemas import (
    OAuthTokenExchangeError,
    OAuthUserInfoError,
    ProviderUserInfo,
)

logger = logging.getLogger(__name__)

DISCOVERY_URL = (
    "https://accounts.google.com/.well-known/openid-configuration"
)
GOOGLE_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}


class GoogleOAuthProvider(IOAuthProvider):
    """Google OAuth 2.0 / OpenID Connect provider adapter.

    Uses Google's discovery document to resolve endpoints dynamically.
    Validates id_token signature and claims (iss, aud, exp) using
    Google's public keys.
    """

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        allowed_scopes: str = "openid email profile",
        **kwargs,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = allowed_scopes

    # ── Discovery helpers ────────────────────────────────────────────

    async def _fetch_discovery(self) -> dict:
        """Fetch Google's OpenID Connect discovery document."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(DISCOVERY_URL, timeout=10)
            resp.raise_for_status()
            return resp.json()

    async def _fetch_jwks(self, jwks_uri: str) -> dict:
        """Fetch Google's public JSON Web Key Set."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(jwks_uri, timeout=10)
            resp.raise_for_status()
            return resp.json()

    # ── IOAuthProvider implementation ────────────────────────────────

    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        """Build the Google OAuth authorization URL."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": self.scopes,
            "state": state,
            "access_type": "offline",
            "prompt": "select_account",
        }
        return (
            f"https://accounts.google.com/o/oauth2/v2/auth"
            f"?{urlencode(params)}"
        )

    async def exchange_code(self, code: str, redirect_uri: str) -> dict:
        """Exchange an authorization code for Google tokens."""
        discovery = await self._fetch_discovery()
        token_endpoint = discovery["token_endpoint"]

        payload = {
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                token_endpoint,
                data=payload,
                timeout=10,
            )

        if resp.status_code != 200:
            logger.error(
                "Google token exchange failed: %s %s",
                resp.status_code,
                resp.text,
            )
            raise OAuthTokenExchangeError(
                f"Token exchange failed with status {resp.status_code}"
            )

        return resp.json()

    async def get_user_info(
        self, token_response: dict
    ) -> ProviderUserInfo:
        """Get user info, preferring id_token decoding over userinfo endpoint."""
        id_token = token_response.get("id_token")
        if id_token:
            try:
                return await self._decode_id_token(id_token)
            except (JWTError, OAuthUserInfoError) as exc:
                logger.warning(
                    "id_token decode failed, falling back to userinfo: %s",
                    exc,
                )

        # Fallback: call the userinfo endpoint
        access_token = token_response.get("access_token")
        if not access_token:
            raise OAuthUserInfoError(
                "No access_token or id_token in token response"
            )

        return await self._fetch_userinfo(access_token)

    async def test_connection(self) -> bool:
        """Validate credentials by fetching the discovery document."""
        try:
            discovery = await self._fetch_discovery()
            return "authorization_endpoint" in discovery
        except Exception as exc:
            logger.error("Google test_connection failed: %s", exc)
            return False

    def get_provider_name(self) -> str:
        """Return the provider identifier."""
        return "google"

    # ── Private helpers ──────────────────────────────────────────────

    async def _decode_id_token(
        self, id_token: str
    ) -> ProviderUserInfo:
        """Decode and validate a Google id_token JWT."""
        discovery = await self._fetch_discovery()
        jwks_uri = discovery["jwks_uri"]
        jwks = await self._fetch_jwks(jwks_uri)

        try:
            claims = jose_jwt.decode(
                id_token,
                jwks,
                algorithms=["RS256"],
                audience=self.client_id,
                issuer=list(GOOGLE_ISSUERS),
            )
        except JWTError as exc:
            raise OAuthUserInfoError(
                f"Invalid id_token: {exc}"
            ) from exc

        email = claims.get("email")
        if not email:
            raise OAuthUserInfoError("No email claim in id_token")

        email_verified = claims.get("email_verified", False)

        return ProviderUserInfo(
            email=email,
            email_verified=email_verified,
            full_name=claims.get("name"),
            profile_picture_url=claims.get("picture"),
            provider_user_id=claims["sub"],
        )

    async def _fetch_userinfo(
        self, access_token: str
    ) -> ProviderUserInfo:
        """Fetch user info from Google's userinfo endpoint."""
        discovery = await self._fetch_discovery()
        userinfo_endpoint = discovery["userinfo_endpoint"]

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                userinfo_endpoint,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10,
            )

        if resp.status_code != 200:
            raise OAuthUserInfoError(
                f"Userinfo request failed with status {resp.status_code}"
            )

        data = resp.json()
        email = data.get("email")
        if not email:
            raise OAuthUserInfoError(
                "No email in userinfo response"
            )

        return ProviderUserInfo(
            email=email,
            email_verified=data.get("email_verified", False),
            full_name=data.get("name"),
            profile_picture_url=data.get("picture"),
            provider_user_id=data["sub"],
        )
