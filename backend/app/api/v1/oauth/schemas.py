"""
Pydantic schemas and Beanie documents for the OAuth module.
"""
from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import BaseModel, EmailStr, Field
from pymongo import IndexModel


class ProviderUserInfo(BaseModel):
    """Normalized user info from any OAuth provider."""

    email: EmailStr
    email_verified: bool
    full_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    provider_user_id: str


class OAuthCallbackRequest(BaseModel):
    """Request body for the OAuth callback endpoint."""

    code: str
    state: str
    provider: str


class OAuthCallbackResponse(BaseModel):
    """Response from successful OAuth callback."""

    access_token: str
    token_type: str = "bearer"


class ActiveProviderResponse(BaseModel):
    """Public-facing active provider info (no secrets)."""

    provider: str
    authorization_url: str


class OAuthStateToken(Document):
    """Short-lived state token for CSRF protection during OAuth flow."""

    state: str
    provider: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    consumed: bool = False

    class Settings:
        name = "oauth_state_tokens"
        indexes = [
            "state",
            IndexModel(
                [("expires_at", 1)],
                expireAfterSeconds=0,
                name="state_token_ttl",
            ),
        ]


class OAuthTokenExchangeError(Exception):
    """Raised when token exchange with the provider fails."""

    pass


class OAuthUserInfoError(Exception):
    """Raised when user info retrieval fails or email is unverified."""

    pass
