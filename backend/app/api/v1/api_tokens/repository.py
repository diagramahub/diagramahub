"""
MongoDB implementation of the API token repository (Beanie).
"""

from datetime import datetime
from typing import Optional

from beanie import PydanticObjectId
from beanie.odm.enums import SortDirection

from .interfaces import IApiTokenRepository
from .permissions import Permissions
from .schemas import ApiTokenInDB


class ApiTokenRepository(IApiTokenRepository):
    """Personal API tokens in the ``api_tokens`` collection."""

    async def create(
        self,
        user_id: str,
        name: str,
        token_hash: str,
        token_hint: str,
        permissions: Permissions,
        expires_at: Optional[datetime],
    ) -> ApiTokenInDB:
        """Store a new token (hash only)."""
        token = ApiTokenInDB(
            user_id=user_id,
            name=name,
            token_hash=token_hash,
            token_hint=token_hint,
            permissions={area.value: level.value for area, level in permissions.items()},
            expires_at=expires_at,
        )
        await token.insert()
        return token

    async def list_by_user(self, user_id: str) -> list[ApiTokenInDB]:
        """The user's tokens, newest first."""
        return (
            await ApiTokenInDB.find(ApiTokenInDB.user_id == user_id)
            .sort([("created_at", SortDirection.DESCENDING)])
            .to_list()
        )

    async def count_by_user(self, user_id: str) -> int:
        """How many tokens the user has."""
        return await ApiTokenInDB.find(ApiTokenInDB.user_id == user_id).count()

    async def get_by_hash(self, token_hash: str) -> Optional[ApiTokenInDB]:
        """Find a token by its hash."""
        return await ApiTokenInDB.find_one(ApiTokenInDB.token_hash == token_hash)

    async def delete_for_user(self, token_id: str, user_id: str) -> Optional[ApiTokenInDB]:
        """Delete one of the user's tokens; returns it, or None if it isn't theirs."""
        try:
            object_id = PydanticObjectId(token_id)
        except Exception:
            return None
        token = await ApiTokenInDB.find_one(
            ApiTokenInDB.id == object_id, ApiTokenInDB.user_id == user_id
        )
        if token is None:
            return None
        await token.delete()
        return token

    async def delete_by_user(self, user_id: str) -> int:
        """Delete every token of a user (account deletion)."""
        result = await ApiTokenInDB.find(ApiTokenInDB.user_id == user_id).delete()
        return result.deleted_count if result else 0

    async def touch(self, token_id: str, when: datetime) -> None:
        """Record when the token was last used."""
        await ApiTokenInDB.find_one(ApiTokenInDB.id == PydanticObjectId(token_id)).update(
            {"$set": {"last_used_at": when}}
        )
