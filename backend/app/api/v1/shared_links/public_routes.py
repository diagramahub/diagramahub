"""
FastAPI routes for shared links (public endpoints, no authentication required).
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.api.v1.diagram_files.routes import file_response, get_diagram_file_service
from app.api.v1.diagram_files.schemas import FileScope
from app.api.v1.diagram_files.services import DiagramFileService
from app.api.v1.diagrams.repository import DiagramRepository
from app.core.client_ip import get_client_ip
from app.core.rate_limit import SlidingWindowRateLimiter
from app.core.log_safety import log_safe

from .repository import SharedLinkRepository
from .schemas import (
    SharedDiagramResponse,
    SharedLinkInfoResponse,
    VerifyAccessCodeRequest,
)
from .services import SharedLinkService

logger = logging.getLogger(__name__)

router = APIRouter()

# Singleton rate limiter instance (shared sliding-window implementation, which
# also sweeps idle IPs so memory stays bounded).
_rate_limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60)
# Images of a shared freehand diagram: same per-IP window, its own budget, since
# one page view loads every image (a diagram may hold up to 100).
_file_rate_limiter = SlidingWindowRateLimiter(max_requests=300, window_seconds=60)


# Dependency injection


def get_shared_link_service() -> SharedLinkService:
    """Get shared link service instance."""
    return SharedLinkService(
        shared_link_repository=SharedLinkRepository(),
        diagram_repository=DiagramRepository(),
    )


def get_rate_limiter() -> SlidingWindowRateLimiter:
    """Get rate limiter instance."""
    return _rate_limiter


def get_file_rate_limiter() -> SlidingWindowRateLimiter:
    """Rate limiter of the shared images endpoint."""
    return _file_rate_limiter


def _check_rate_limit(request: Request, limiter: SlidingWindowRateLimiter) -> str:
    """Count the request against ``limiter`` (429 when over) and return the client IP."""
    client_ip = get_client_ip(request)
    allowed, retry_after = limiter.is_allowed(client_ip)
    if not allowed:
        logger.warning("Rate limit exceeded for IP hash (public shared link endpoint)")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiadas solicitudes. Intenta más tarde",
            headers={"Retry-After": str(retry_after)},
        )
    return client_ip


async def _enforce_rate_limit(
    request: Request,
    limiter: SlidingWindowRateLimiter = Depends(get_rate_limiter),
) -> str:
    """Enforce rate limiting and return client IP."""
    return _check_rate_limit(request, limiter)


async def _enforce_file_rate_limit(
    request: Request,
    limiter: SlidingWindowRateLimiter = Depends(get_file_rate_limiter),
) -> str:
    """Enforce the images endpoint's rate limit and return client IP."""
    return _check_rate_limit(request, limiter)


# ============ Public Shared Link Endpoints ============


@router.get(
    "/shared/{token}/info",
    response_model=SharedLinkInfoResponse,
)
async def get_shared_link_info(
    token: str,
    client_ip: str = Depends(_enforce_rate_limit),
    service: SharedLinkService = Depends(get_shared_link_service),
):
    """Get public info for a shared link (access type, expiration, title)."""
    logger.info("Shared link info requested for token=%s...", log_safe(token[:8]))
    return await service.get_link_info(token)


@router.get(
    "/shared/{token}/diagram",
    response_model=SharedDiagramResponse,
)
async def get_shared_diagram(
    token: str,
    client_ip: str = Depends(_enforce_rate_limit),
    service: SharedLinkService = Depends(get_shared_link_service),
):
    """Get diagram data for a public (non-protected) shared link."""
    logger.info("Shared diagram requested for token=%s...", log_safe(token[:8]))
    return await service.get_shared_diagram(token, client_ip)


@router.post(
    "/shared/{token}/verify",
    response_model=SharedDiagramResponse,
)
async def verify_access_code(
    token: str,
    request: VerifyAccessCodeRequest,
    client_ip: str = Depends(_enforce_rate_limit),
    service: SharedLinkService = Depends(get_shared_link_service),
):
    """Verify access code for a protected shared link and return diagram data."""
    logger.info("Access code verification for token=%s...", log_safe(token[:8]))
    return await service.verify_access_code(token, request, client_ip)


@router.get(
    "/shared/{token}/files/{file_id}",
    response_class=Response,
    responses={200: {"content": {"image/*": {}}, "description": "The image bytes"}},
)
async def get_shared_file(
    token: str,
    file_id: str,
    file_token: Optional[str] = Query(
        None, max_length=200, description="Protected links: the file_token of /verify"
    ),
    client_ip: str = Depends(_enforce_file_rate_limit),
    service: SharedLinkService = Depends(get_shared_link_service),
    file_service: DiagramFileService = Depends(get_diagram_file_service),
) -> Response:
    """An image of the shared diagram, under the same rules as the diagram itself.

    Public links need nothing else; protected links need ``file_token`` (returned
    by ``POST /shared/{token}/verify``). Only the link's own diagram's files.
    """
    diagram_id, is_public = await service.resolve_file_access(token, client_ip, file_token)
    file = await file_service.get_in_scope(FileScope.DIAGRAM, diagram_id, file_id)
    return file_response(file, "public, max-age=86400" if is_public else "private, max-age=3600")
