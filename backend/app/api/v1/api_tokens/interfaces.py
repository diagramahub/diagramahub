"""
Abstract interface for the API token repository (Dependency Inversion).
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from .permissions import Permissions
from .schemas import ApiTokenInDB


class IApiTokenRepository(ABC):
    """Data access for personal API tokens."""

    @abstractmethod
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
        pass

    @abstractmethod
    async def list_by_user(self, user_id: str) -> list[ApiTokenInDB]:
        """The user's tokens, newest first."""
        pass

    @abstractmethod
    async def count_by_user(self, user_id: str) -> int:
        """How many tokens the user has."""
        pass

    @abstractmethod
    async def get_by_hash(self, token_hash: str) -> Optional[ApiTokenInDB]:
        """Find a token by its hash."""
        pass

    @abstractmethod
    async def delete_for_user(self, token_id: str, user_id: str) -> Optional[ApiTokenInDB]:
        """Delete one of the user's tokens; returns it, or None if it isn't theirs."""
        pass

    @abstractmethod
    async def delete_by_user(self, user_id: str) -> int:
        """Delete every token of a user (account deletion)."""
        pass

    @abstractmethod
    async def touch(self, token_id: str, when: datetime) -> None:
        """Record when the token was last used."""
        pass
