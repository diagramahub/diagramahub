"""
Shared FastAPI dependencies for current-user authentication.

Canonical home for the current-user dependencies so route modules no longer
import each other's routes (route-to-route coupling) or instantiate
repositories directly for identity lookups. Moved here from
``app.api.v1.users.routes`` during the 0.7.0 SOLID alignment.
"""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.api.v1.users.repository import UserRepository
from app.api.v1.users.services import UserService
from app.core.security import decode_access_token

security = HTTPBearer()


def get_user_service() -> UserService:
    """Dependency injection for user service."""
    repository = UserRepository()
    return UserService(repository)


async def get_current_user_email(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> str:
    """
    Dependency to extract and validate current user from JWT token.

    Also validates that the token was not issued before the last password
    change (session invalidation on password change).

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

    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Session invalidation: check if password was changed after token was issued.
    # The data access lives in UserService (via the injected dependency) so the
    # route layer only deals with the HTTP concern.
    token_pca = payload.get("pca")
    user = await get_user_service().get_current_user(email)
    if user and user.password_changed_at is not None:
        if token_pca is None or token_pca < user.password_changed_at:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session invalidated. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return email


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
    return str(user.id)
