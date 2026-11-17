"""
Routes for personal API tokens.

Managing tokens needs a signed-in session: an API token can't call these
endpoints (they are outside the token allowlist), so a leaked token can't mint
or list others.
"""

from fastapi import APIRouter, Depends, Request, status

from app.api.deps import get_current_user_id
from app.api.v1.users import audit_log

from .repository import ApiTokenRepository
from .schemas import ApiTokenCreatedResponse, ApiTokenCreateRequest, ApiTokenResponse
from .services import ApiTokenService, describe_permissions

router = APIRouter(tags=["API tokens"])


def get_api_token_service() -> ApiTokenService:
    """Dependency injection for the API token service."""
    return ApiTokenService(repository=ApiTokenRepository())


@router.get("/api-tokens", response_model=list[ApiTokenResponse])
async def list_api_tokens(
    user_id: str = Depends(get_current_user_id),
    service: ApiTokenService = Depends(get_api_token_service),
) -> list[ApiTokenResponse]:
    """List the user's API tokens (without the tokens themselves)."""
    return await service.list_tokens(user_id)


@router.post(
    "/api-tokens",
    response_model=ApiTokenCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_token(
    request: ApiTokenCreateRequest,
    http_request: Request,
    user_id: str = Depends(get_current_user_id),
    service: ApiTokenService = Depends(get_api_token_service),
) -> ApiTokenCreatedResponse:
    """Create an API token. The token is in this response only: store it now."""
    created = await service.create_token(user_id, request)
    await audit_log.log_event_for_user_id(
        audit_log.EVENT_API_TOKEN_CREATED,
        user_id,
        http_request,
        details=(
            f"id={created.id} permissions={describe_permissions(created.permissions)} "
            f"expires={created.expires_at or 'never'}"
        ),
    )
    return created


@router.delete("/api-tokens/{token_id}", response_model=ApiTokenResponse)
async def revoke_api_token(
    token_id: str,
    http_request: Request,
    user_id: str = Depends(get_current_user_id),
    service: ApiTokenService = Depends(get_api_token_service),
) -> ApiTokenResponse:
    """Revoke (delete) one of the user's API tokens; it stops working at once."""
    revoked = await service.revoke_token(token_id, user_id)
    await audit_log.log_event_for_user_id(
        audit_log.EVENT_API_TOKEN_REVOKED, user_id, http_request, details=f"id={token_id}"
    )
    return revoked
