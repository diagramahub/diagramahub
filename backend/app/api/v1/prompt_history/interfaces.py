"""
Abstract interfaces for prompt history repository.
Follows the Dependency Inversion Principle (SOLID).
"""
from abc import ABC, abstractmethod
from typing import Optional

from .schemas import PromptHistoryInDB


class IPromptHistoryRepository(ABC):
    """Abstract interface for prompt history data access."""

    @abstractmethod
    async def upsert(self, user_id: str, prompt_text: str, operation_type: str, diagram_id: str | None = None) -> PromptHistoryInDB:
        """Insert or update a prompt history entry (deduplication by hash)."""
        pass

    @abstractmethod
    async def get_by_user(self, user_id: str, skip: int, limit: int, search: str | None, diagram_id: str | None = None) -> list[PromptHistoryInDB]:
        """Get paginated prompt history entries for a user with optional search."""
        pass

    @abstractmethod
    async def count_by_user(self, user_id: str, search: str | None, diagram_id: str | None = None) -> int:
        """Count prompt history entries for a user with optional search filter."""
        pass

    @abstractmethod
    async def get_by_id(self, entry_id: str) -> Optional[PromptHistoryInDB]:
        """Get a prompt history entry by ID."""
        pass

    @abstractmethod
    async def delete(self, entry_id: str) -> bool:
        """Delete a prompt history entry by ID."""
        pass
