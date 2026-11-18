"""
Models for the activity module.

One small document per (user, diagram, hour) in which the diagram was created
or edited. The dashboard counts, per day, how many different diagrams the user
worked on; documents expire after ``ACTIVITY_RETENTION_DAYS``.
"""

from datetime import datetime

from beanie import Document
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel

ACTIVITY_RETENTION_DAYS = 120
MAX_HEATMAP_DAYS = 112  # 16 weeks


class DiagramActivityInDB(Document):
    """The user worked on this diagram during this hour (UTC, truncated)."""

    user_id: str
    diagram_id: str
    hour: datetime

    class Settings:
        name = "diagram_activity"
        indexes = [
            IndexModel(
                [("user_id", ASCENDING), ("diagram_id", ASCENDING), ("hour", ASCENDING)],
                unique=True,
            ),
            IndexModel([("user_id", ASCENDING), ("hour", ASCENDING)]),
            IndexModel(
                [("hour", ASCENDING)], expireAfterSeconds=ACTIVITY_RETENTION_DAYS * 24 * 3600
            ),
        ]


class ActivityDay(BaseModel):
    """One day of the heatmap."""

    date: str = Field(..., description="Local date, YYYY-MM-DD")
    count: int = Field(..., description="Different diagrams worked on that day")


class ActivityHeatmap(BaseModel):
    """The last ``len(days)`` days, oldest first, ending today (in the user's time zone)."""

    days: list[ActivityDay]
    total: int = Field(..., description="Different diagrams worked on in the whole range")
    active_days: int
    current_streak: int = Field(..., description="Consecutive active days up to today")
    longest_streak: int
    timezone: str
