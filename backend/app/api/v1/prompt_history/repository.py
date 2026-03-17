"""
Concrete implementation of prompt history repository.
"""
from datetime import datetime, timezone
from typing import Optional

from beanie import PydanticObjectId

from .interfaces import IPromptHistoryRepository
from .schemas import PromptHistoryInDB, compute_prompt_hash


class PromptHistoryRepository(IPromptHistoryRepository):
    """MongoDB implementation of prompt history repository using Beanie."""

    async def upsert(self, user_id: str, prompt_text: str, operation_type: str) -> PromptHistoryInDB:
        """Insert or update a prompt history entry (deduplication by hash)."""
        prompt_hash = compute_prompt_hash(prompt_text)
        existing = await PromptHistoryInDB.find_one(
            PromptHistoryInDB.user_id == user_id,
            PromptHistoryInDB.prompt_hash == prompt_hash,
        )

        if existing:
            existing.used_at = datetime.now(timezone.utc)
            await existing.save()
            return existing

        entry = PromptHistoryInDB(
            user_id=user_id,
            prompt_text=prompt_text,
            prompt_hash=prompt_hash,
            operation_type=operation_type,
            created_at=datetime.now(timezone.utc),
            used_at=datetime.now(timezone.utc),
        )
        await entry.insert()
        return entry

    async def get_by_user(
        self, user_id: str, skip: int, limit: int, search: str | None
    ) -> list[PromptHistoryInDB]:
        """Get paginated prompt history entries for a user with optional search."""
        query = {"user_id": user_id}
        if search:
            query["prompt_text"] = {"$regex": search, "$options": "i"}

        entries = (
            await PromptHistoryInDB.find(query)
            .sort("-used_at")
            .skip(skip)
            .limit(limit)
            .to_list()
        )
        return entries

    async def count_by_user(self, user_id: str, search: str | None) -> int:
        """Count prompt history entries for a user with optional search filter."""
        query = {"user_id": user_id}
        if search:
            query["prompt_text"] = {"$regex": search, "$options": "i"}

        return await PromptHistoryInDB.find(query).count()

    async def get_by_id(self, entry_id: str) -> Optional[PromptHistoryInDB]:
        """Get a prompt history entry by ID."""
        try:
            return await PromptHistoryInDB.get(PydanticObjectId(entry_id))
        except Exception:
            return None

    async def delete(self, entry_id: str) -> bool:
        """Delete a prompt history entry by ID."""
        entry = await self.get_by_id(entry_id)
        if not entry:
            return False

        await entry.delete()
        return True
