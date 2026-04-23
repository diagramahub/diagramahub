"""
Public OAuth routes for social login.

All endpoints are public (no authentication required) since they handle
the OAuth authorization flow before the user is authenticated.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.v1.integrations.repository import IntegrationsRepository
from app.api.v1.shared_links.rate_limiter import InMemoryRateLimiter

from .schemas import (
    ActiveProviderResponse,
    OAuthCallbackRequest,
    OAuthCallbackResponse,
)
from .services import OAuthService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/oauth", tags=["OAuth"])

# Singleton rate limiter: 10 callback attempts per minute per IP
_callback_rate_limiter = InMemoryRateLimiter(max_requests=10, window_seconds=60)


# ── Dependencies ─────────────────────────────────────────────────────


def get_oauth_service() -> OAuthService:
    """Dependency injection for OAuthService."""
    return OAuthService(integrations_repo=IntegrationsRepository())


def get_callback_rate_limiter() -> InMemoryRateLimiter:
    """Get the callback rate limiter instance."""
    return _callback_rate_limiter


async def _enforce_callback_rate_limit(
    request: Request,
    limiter: InMemoryRateLimiter = Depends(get_callback_rate_limiter),
) -> None:
    """Enforce rate limiting on the OAuth callback endpoint."""
    client_ip = request.client.host if request.client else "unknown"
    if not limiter.is_allowed(client_ip):
        logger.warning(
            "Rate limit exceeded for OAuth callback from IP"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts",
        )


# ── Endpoints ────────────────────────────────────────────────────────


@router.get("/providers", response_model=list[ActiveProviderResponse])
async def list_active_providers(
    service: OAuthService = Depends(get_oauth_service),
) -> list[ActiveProviderResponse]:
    """List active OAuth providers (public, no auth required).

    Returns provider name and authorization URL for each active provider.
    No sensitive configuration data is exposed.
    """
    providers = await service.get_active_providers()
    return [ActiveProviderResponse(**p) for p in providers]


@router.get("/authorize/{provider}")
async def authorize(
    provider: str,
    service: OAuthService = Depends(get_oauth_service),
) -> dict:
    """Initiate the OAuth authorization flow for a given provider.

    Generates a cryptographic state token, stores it server-side,
    and returns the authorization URL for the frontend to redirect to.
    """
    authorization_url, state = await service.initiate_oauth(provider)
    return {"authorization_url": authorization_url, "state": state}


@router.post("/callback", response_model=OAuthCallbackResponse)
async def oauth_callback(
    callback_data: OAuthCallbackRequest,
    _rate_limit: None = Depends(_enforce_callback_rate_limit),
    service: OAuthService = Depends(get_oauth_service),
) -> OAuthCallbackResponse:
    """Handle the OAuth callback after provider authorization.

    Validates the state token, exchanges the authorization code for
    tokens, retrieves user info, creates/links the account, and
    returns a JWT access token.
    """
    return await service.handle_callback(
        provider=callback_data.provider,
        code=callback_data.code,
        state=callback_data.state,
    )
