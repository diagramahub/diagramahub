"""
Business logic for the activity heatmap.
"""

import logging
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Callable, Iterable, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.clock import utcnow

from ..diagrams.interfaces import IDiagramRepository
from ..projects.interfaces import IProjectRepository
from .interfaces import IActivityRepository
from .schemas import ActivityDay, ActivityHeatmap

logger = logging.getLogger(__name__)


def resolve_timezone(name: Optional[str]) -> tuple[ZoneInfo | timezone, str]:
    """The IANA zone ``name``, or UTC when it is missing or unknown."""
    if name:
        try:
            return ZoneInfo(name), name
        except (ZoneInfoNotFoundError, ValueError):
            pass
    return timezone.utc, "UTC"


def streaks(active: list[bool]) -> tuple[int, int]:
    """``(current, longest)`` runs of active days; ``active`` ends today.

    Today without activity yet doesn't break the current streak: it counts
    from yesterday until the day is over.
    """
    longest = run = 0
    for is_active in active:
        run = run + 1 if is_active else 0
        longest = max(longest, run)
    days = active[:-1] if active and not active[-1] else active
    current = 0
    for is_active in reversed(days):
        if not is_active:
            break
        current += 1
    return current, longest


class ActivityService:
    """Records the diagrams a user works on and summarizes them per day."""

    def __init__(
        self,
        activity_repository: IActivityRepository,
        project_repository: IProjectRepository,
        diagram_repository: IDiagramRepository,
        now: Callable[[], datetime] = utcnow,
    ) -> None:
        self.activity_repository = activity_repository
        self.project_repository = project_repository
        self.diagram_repository = diagram_repository
        self.now = now

    async def heatmap(self, user_id: str, days: int, tz_name: Optional[str]) -> ActivityHeatmap:
        """How many different diagrams the user worked on each of the last ``days`` days.

        Days follow the user's time zone. Besides the recorded hours, a diagram
        counts on the day it was created and the day it was last edited, so the
        history before activity was recorded isn't empty.
        """
        tz, tz_label = resolve_timezone(tz_name)
        today = self.now().replace(tzinfo=timezone.utc).astimezone(tz).date()
        first = today - timedelta(days=days - 1)
        start = (
            datetime.combine(first, time.min, tzinfo=tz)
            .astimezone(timezone.utc)
            .replace(tzinfo=None)
        )

        events: list[tuple[str, datetime]] = list(
            await self.activity_repository.since(user_id, start)
        )
        projects = await self.project_repository.get_by_user_id(user_id)
        touched = await self.diagram_repository.touched_since([str(p.id) for p in projects], start)
        for diagram_id, created_at, updated_at in touched:
            events.extend((diagram_id, at) for at in (created_at, updated_at) if at and at >= start)

        per_day: dict[date, set[str]] = defaultdict(set)
        for diagram_id, at in events:
            local_day = at.replace(tzinfo=timezone.utc).astimezone(tz).date()
            if first <= local_day <= today:
                per_day[local_day].add(diagram_id)

        calendar = [first + timedelta(days=i) for i in range(days)]
        counts = [len(per_day.get(day, ())) for day in calendar]
        current, longest = streaks([count > 0 for count in counts])
        return ActivityHeatmap(
            days=[ActivityDay(date=d.isoformat(), count=c) for d, c in zip(calendar, counts)],
            total=len(set().union(*per_day.values())) if per_day else 0,
            active_days=sum(1 for count in counts if count),
            current_streak=current,
            longest_streak=longest,
            timezone=tz_label,
        )


async def record_activity(
    repository: Optional[IActivityRepository], user_id: str, diagram_ids: Iterable[str]
) -> None:
    """Note that the user worked on these diagrams now. Never fails the caller's save."""
    if repository is None:
        return
    at = utcnow()
    for diagram_id in diagram_ids:
        try:
            await repository.record(user_id, diagram_id, at)
        except Exception:  # noqa: BLE001 - activity is a nice-to-have
            logger.warning("Could not record activity for diagram %s", diagram_id, exc_info=True)
