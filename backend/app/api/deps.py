"""
Shared FastAPI dependencies for current-user authentication.

Canonical home for the current-user dependencies so route modules no longer
import each other's routes (route-to-route coupling) or instantiate
repositories directly for identity lookups. Moved here from
``app.api.v1.users.routes`` during the 0.7.0 SOLID alignment.
"""

from typing import Annotated, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError

from app.api.v1.api_tokens.repository import ApiTokenRepository
from app.api.v1.api_tokens.services import ApiTokenService, is_api_token
from app.api.v1.users.repository import UserRepository
from app.api.v1.users.services import UserService
from app.core.config import settings
from app.core.security import decode_access_token

#: ``detail`` of the 401 sent to a blocked user's open session (the web app shows it at sign-in).
ACCOUNT_DISABLED_DETAIL = "Account disabled"

security = HTTPBearer()
# For routes that also serve anonymous visitors: no credentials -> None.
optional_security = HTTPBearer(auto_error=False)


def get_user_service() -> UserService:
    """Dependency injection for user service."""
    repository = UserRepository()
    return UserService(repository)


async def _email_for_api_token(token: str, request: Request) -> str:
    """Resolve a personal API token (``dh_pat_…``) to its owner's email.

    Raises:
        HTTPException 401: Unknown or expired token, or the owner no longer exists
        HTTPException 403: The token may not call this endpoint or method
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired API token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    path = request.url.path
    prefix = settings.API_V1_PREFIX
    api_path = path[len(prefix) :] if path.startswith(prefix) else path
    principal = await ApiTokenService(ApiTokenRepository()).authenticate(
        token, request.method, api_path
    )
    if principal is None:
        raise unauthorized
    user = await UserRepository().get_by_id(principal.user_id)
    if user is None or not user.is_active:
        # A blocked owner's tokens stop working too (and work again on unblock).
        raise unauthorized
    return user.email


async def get_current_user_email(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> str:
    """
    Dependency to extract and validate current user from JWT token.

    Also validates that the token was not issued before the last password
    change (session invalidation on password change). A personal API token
    (``dh_pat_…``) is accepted instead of a session on the endpoints it is
    allowed to call (see ``api_tokens.services``).

    Args:
        credentials: HTTP Bearer token from Authorization header

    Returns:
        User email from token

    Raises:
        HTTPException: If token is invalid, missing, or invalidated by password change
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if is_api_token(credentials.credentials):
        return await _email_for_api_token(credentials.credentials, request)

    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception
    except PyJWTError:
        raise credentials_exception

    # Session invalidation: check if password was changed after token was issued.
    # The data access lives in UserService (via the injected dependency) so the
    # route layer only deals with the HTTP concern.
    token_pca = payload.get("pca")
    user = await get_user_service().get_current_user(email)
    if user is not None and not user.is_active:
        # Blocked by an admin: end the open session on its next request.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ACCOUNT_DISABLED_DETAIL,
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user and user.password_changed_at is not None:
        if token_pca is None or token_pca < user.password_changed_at:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session invalidated. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return email


async def get_optional_user_email(
    request: Request,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(optional_security)],
) -> Optional[str]:
    """The signed-in user's email, or None for an anonymous visitor.

    Credentials that are sent must still be valid (401 otherwise): only their
    absence makes the visitor anonymous.
    """
    if credentials is None:
        return None
    return await get_current_user_email(request, credentials)


async def get_current_user(
    current_user_email: str = Depends(get_current_user_email),
):
    """Dependency returning the current user document (may be None)."""
    user_repo = UserRepository()
    return await user_repo.get_by_email(current_user_email)


async def get_current_user_id(
    current_user_email: str = Depends(get_current_user_email),
) -> str:
    """Dependency returning the current user's ID from their email."""
    user_repo = UserRepository()
    user = await user_repo.get_by_email(current_user_email)
    if user is None:
        # Valid token for an account that no longer exists (e.g. deleted).
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return str(user.id)
