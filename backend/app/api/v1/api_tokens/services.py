"""
Business logic for personal API tokens.

Keys look like ``dh_pat_<random>``; only their SHA-256 hash is stored, so a
key can't be recovered after it is shown. A key acts as its owner, only on the
endpoints its per-area permissions cover (``permissions.RULES``). Account,
security, key management and admin endpoints always need a signed-in session.
"""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from fastapi import HTTPException, status

from app.core.clock import utcnow

from .interfaces import IApiTokenRepository
from .permissions import (
    AccessLevel,
    ApiKeyArea,
    Permissions,
    grants,
    legacy_permissions,
    required_access,
)
from .schemas import (
    MAX_TOKENS_PER_USER,
    TOKEN_HINT_LENGTH,
    TOKEN_PREFIX,
    ApiTokenCreatedResponse,
    ApiTokenCreateRequest,
    ApiTokenInDB,
    ApiTokenResponse,
)

# Don't write last_used_at on every request.
LAST_USED_RESOLUTION = timedelta(minutes=5)


def hash_token(token: str) -> str:
    """SHA-256 hex digest of a token (tokens are random, so no salt is needed)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def is_api_token(credential: str) -> bool:
    """Whether a bearer credential is a personal API token (not a session JWT)."""
    return credential.startswith(TOKEN_PREFIX)


def permissions_of(token: ApiTokenInDB) -> Permissions:
    """A key's access per area (old global-scope keys are translated)."""
    if not token.permissions:
        return legacy_permissions(token.scope)
    stored = token.permissions
    return {
        area: AccessLevel(stored.get(area.value, AccessLevel.NONE.value)) for area in ApiKeyArea
    }


def describe_permissions(permissions: Permissions) -> str:
    """``projects:read,diagrams:write`` (areas with access only), for the audit log."""
    return ",".join(
        f"{area.value}:{level.value}"
        for area, level in permissions.items()
        if level != AccessLevel.NONE
    )


def _to_response(token: ApiTokenInDB) -> ApiTokenResponse:
    return ApiTokenResponse(
        id=str(token.id),
        name=token.name,
        token_hint=token.token_hint,
        permissions=permissions_of(token),
        created_at=token.created_at,
        expires_at=token.expires_at,
        last_used_at=token.last_used_at,
    )


@dataclass(frozen=True)
class ApiTokenPrincipal:
    """Who a valid token acts for."""

    user_id: str
    token_id: str
    permissions: Permissions


class ApiTokenService:
    """Create, list, revoke and authenticate personal API tokens."""

    def __init__(self, repository: IApiTokenRepository):
        self.repository = repository

    async def create_token(
        self, user_id: str, request: ApiTokenCreateRequest
    ) -> ApiTokenCreatedResponse:
        """Create a token; the response is the only place the token appears.

        Raises:
            HTTPException 400: If the user already has ``MAX_TOKENS_PER_USER`` tokens
        """
        if await self.repository.count_by_user(user_id) >= MAX_TOKENS_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You can have at most {MAX_TOKENS_PER_USER} API tokens",
            )
        token = TOKEN_PREFIX + secrets.token_urlsafe(32)
        expires_at = (
            utcnow() + timedelta(days=request.expires_in_days)
            if request.expires_in_days is not None
            else None
        )
        stored = await self.repository.create(
            user_id=user_id,
            name=request.name.strip(),
            token_hash=hash_token(token),
            token_hint=token[: len(TOKEN_PREFIX) + TOKEN_HINT_LENGTH] + "…",
            permissions=request.permissions,
            expires_at=expires_at,
        )
        return ApiTokenCreatedResponse(**_to_response(stored).model_dump(), token=token)

    async def list_tokens(self, user_id: str) -> list[ApiTokenResponse]:
        """The user's tokens (never the tokens themselves)."""
        return [_to_response(t) for t in await self.repository.list_by_user(user_id)]

    async def revoke_token(self, token_id: str, user_id: str) -> ApiTokenResponse:
        """Delete one of the user's tokens; it stops working at once.

        Raises:
            HTTPException 404: If the token doesn't exist or isn't the user's
        """
        deleted = await self.repository.delete_for_user(token_id, user_id)
        if deleted is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token not found")
        return _to_response(deleted)

    async def authenticate(
        self, credential: str, method: str, api_path: str
    ) -> Optional[ApiTokenPrincipal]:
        """Resolve a token for a request.

        Args:
            credential: The bearer credential (``dh_pat_…``)
            method: HTTP method of the request
            api_path: Request path without the API prefix (e.g. ``/diagrams/x``)

        Returns:
            The principal, or None if the token is unknown or expired

        Raises:
            HTTPException 403: If the token may not call this endpoint or method
        """
        token = await self.repository.get_by_hash(hash_token(credential))
        now = utcnow()
        if token is None or (token.expires_at is not None and token.expires_at <= now):
            return None
        needed = required_access(method, api_path)
        if needed is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This endpoint doesn't accept API keys; sign in instead",
            )
        permissions = permissions_of(token)
        areas, level = needed
        missing = [area for area in areas if not grants(permissions[area], level)]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "api_key_permission",
                    "message": f"This API key needs {level.value} access to "
                    + " and ".join(area.value for area in missing),
                    "needs": {area.value: level.value for area in missing},
                },
            )
        if token.last_used_at is None or now - token.last_used_at >= LAST_USED_RESOLUTION:
            await self.repository.touch(str(token.id), now)
        return ApiTokenPrincipal(
            user_id=token.user_id, token_id=str(token.id), permissions=permissions
        )
