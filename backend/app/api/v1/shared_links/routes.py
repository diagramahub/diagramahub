"""
FastAPI routes for shared links (authenticated endpoints).
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, status

from app.api.v1.diagrams.repository import DiagramRepository
from app.api.v1.users.repository import UserRepository
from app.api.v1.users.routes import get_current_user_email

from .repository import SharedLinkRepository
from .schemas import (
    CreateSharedLinkRequest,
    SharedLinkResponse,
    UpdateSharedLinkRequest,
)
from .services import SharedLinkService

logger = logging.getLogger(__name__)

router = APIRouter()


# Dependency injection

def get_shared_link_service() -> SharedLinkService:
    """Get shared link service instance."""
    return SharedLinkService(
        shared_link_repository=SharedLinkRepository(),
        diagram_repository=DiagramRepository(),
    )


async def get_current_user_id(
    current_user_email: str = Depends(get_current_user_email),
) -> str:
    """Get current user ID from email."""
    user_repo = UserRepository()
    user = await user_repo.get_by_email(current_user_email)
    return str(user.id)


# ============ Shared Link Endpoints ============


@router.post(
    "/shared-links",
    response_model=SharedLinkResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_shared_link(
    request: CreateSharedLinkRequest,
    user_id: str = Depends(get_current_user_id),
    service: SharedLinkService = Depends(get_shared_link_service),
):
    """Create a new shared link for a diagram."""
    return await service.create_shared_link(request, user_id)


@router.get(
    "/shared-links/diagram/{diagram_id}",
    response_model=Optional[SharedLinkResponse],
)
async def get_shared_link_by_diagram(
    diagram_id: str,
    user_id: str = Depends(get_current_user_id),
    service: SharedLinkService = Depends(get_shared_link_service),
):
    """Get the active shared link for a diagram."""
    return await service.get_active_link(diagram_id, user_id)


@router.put(
    "/shared-links/{link_id}",
    response_model=SharedLinkResponse,
)
async def update_shared_link(
    link_id: str,
    request: UpdateSharedLinkRequest,
    user_id: str = Depends(get_current_user_id),
    service: SharedLinkService = Depends(get_shared_link_service),
):
    """Update shared link configuration."""
    return await service.update_shared_link(link_id, request, user_id)


@router.delete(
    "/shared-links/{link_id}",
)
async def revoke_shared_link(
    link_id: str,
    user_id: str = Depends(get_current_user_id),
    service: SharedLinkService = Depends(get_shared_link_service),
):
    """Revoke (deactivate) a shared link."""
    return await service.revoke_shared_link(link_id, user_id)
