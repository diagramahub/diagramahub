"""
Routes for the activity module (dashboard heatmap).
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user_id
from app.api.v1.diagrams.repository import DiagramRepository
from app.api.v1.projects.repository import ProjectRepository

from .repository import ActivityRepository
from .schemas import MAX_HEATMAP_DAYS, ActivityHeatmap
from .services import ActivityService

router = APIRouter(prefix="/activity", tags=["Activity"])


def get_activity_service() -> ActivityService:
    """Dependency injection for the activity service."""
    return ActivityService(
        activity_repository=ActivityRepository(),
        project_repository=ProjectRepository(),
        diagram_repository=DiagramRepository(),
    )


@router.get("/heatmap", response_model=ActivityHeatmap)
async def get_heatmap(
    days: int = Query(84, ge=7, le=MAX_HEATMAP_DAYS, description="Days to cover, ending today"),
    tz: Optional[str] = Query(None, max_length=64, description="IANA time zone of the user"),
    user_id: str = Depends(get_current_user_id),
    service: ActivityService = Depends(get_activity_service),
) -> ActivityHeatmap:
    """Different diagrams the user worked on per day, with streaks."""
    return await service.heatmap(user_id, days, tz)
