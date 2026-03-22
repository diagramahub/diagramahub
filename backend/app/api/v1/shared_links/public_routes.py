"""
FastAPI routes for shared links (public endpoints, no authentication required).
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.v1.diagrams.repository import DiagramRepository

from .rate_limiter import InMemoryRateLimiter
from .repository import SharedLinkRepository
from .schemas import (
    SharedDiagramResponse,
    SharedLinkInfoResponse,
    VerifyAccessCodeRequest,
)
from .services import SharedLinkService

logger = logging.getLogger(__name__)

router = APIRouter()

# Singleton rate limiter instance
_rate_limiter = InMemoryRateLimiter(max_requests=60, window_seconds=60)


# Dependency injection

def get_shared_link_service() -> SharedLinkService:
    """Get shared link service instance."""
    return SharedLinkService(
        shared_link_repository=SharedLinkRepository(),
        diagram_repository=DiagramRepository(),
    )


def get_rate_limiter() -> InMemoryRateLimiter:
    """Get rate limiter instance."""
    return _rate_limiter


def _get_client_ip(request: Request) -> str:
    """Extract client IP from request."""
    return request.client.host if request.client else "unknown"


async def _enforce_rate_limit(
    request: Request,
    limiter: InMemoryRateLimiter = Depends(get_rate_limiter),
) -> str:
    """Enforce rate limiting and return client IP."""
    client_ip = _get_client_ip(request)
    if not limiter.is_allowed(client_ip):
        logger.warning("Rate limit exceeded for IP hash (public shared link endpoint)")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiadas solicitudes. Intenta más tarde",
        )
    return client_ip


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
    logger.info("Shared link info requested for token=%s...", token[:8])
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
    logger.info("Shared diagram requested for token=%s...", token[:8])
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
    logger.info("Access code verification for token=%s...", token[:8])
    return await service.verify_access_code(token, request, client_ip)
