"""
MongoDB implementation of the activity repository.
"""

from datetime import datetime

from .interfaces import IActivityRepository
from .schemas import DiagramActivityInDB


def _hour(at: datetime) -> datetime:
    """``at`` truncated to the hour."""
    return at.replace(minute=0, second=0, microsecond=0)


class ActivityRepository(IActivityRepository):
    """Activity stored in the ``diagram_activity`` collection."""

    async def record(self, user_id: str, diagram_id: str, at: datetime) -> None:
        hour = _hour(at)
        # Idempotent: saving the same diagram many times in an hour is one document.
        await DiagramActivityInDB.get_pymongo_collection().update_one(
            {"user_id": user_id, "diagram_id": diagram_id, "hour": hour},
            {"$setOnInsert": {"user_id": user_id, "diagram_id": diagram_id, "hour": hour}},
            upsert=True,
        )

    async def since(self, user_id: str, start: datetime) -> list[tuple[str, datetime]]:
        cursor = DiagramActivityInDB.get_pymongo_collection().find(
            {"user_id": user_id, "hour": {"$gte": _hour(start)}},
            {"_id": 0, "diagram_id": 1, "hour": 1},
        )
        return [(doc["diagram_id"], doc["hour"]) async for doc in cursor]

    async def delete_by_user_id(self, user_id: str) -> int:
        result = await DiagramActivityInDB.get_pymongo_collection().delete_many(
            {"user_id": user_id}
        )
        return result.deleted_count
