"""
Pydantic models for personal API tokens.

A token is shown once, when it is created; only its SHA-256 hash is stored.
"""

from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from beanie import Document
from pydantic import BaseModel, ConfigDict, Field
from pymongo import ASCENDING, IndexModel

from app.core.clock import utcnow

TOKEN_PREFIX = "dh_pat_"
# Characters after TOKEN_PREFIX kept in clear to tell tokens apart in lists.
TOKEN_HINT_LENGTH = 6
MAX_TOKENS_PER_USER = 20
EXPIRATION_CHOICES = (30, 90, 365)


class ApiTokenScope(str, Enum):
    """What a token may do: read only (GET) or also create, change and delete."""

    READ = "read"
    WRITE = "write"


class ApiTokenInDB(Document):
    """Personal API token stored in MongoDB (hash only)."""

    user_id: str
    name: str
    token_hash: str
    token_hint: str  # e.g. "dh_pat_Ab12Cd…" for display
    scope: ApiTokenScope
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None

    class Settings:
        name = "api_tokens"
        indexes = [
            IndexModel([("token_hash", ASCENDING)], unique=True),
            "user_id",
        ]


class ApiTokenCreateRequest(BaseModel):
    """Request to create a token."""

    name: str = Field(..., min_length=1, max_length=60)
    scope: ApiTokenScope = ApiTokenScope.READ
    expires_in_days: Optional[Literal[30, 90, 365]] = Field(
        90, description="30, 90 or 365 days; null for a token that never expires"
    )


class ApiTokenResponse(BaseModel):
    """A token as listed (never the token itself)."""

    id: str
    name: str
    token_hint: str
    scope: ApiTokenScope
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ApiTokenCreatedResponse(ApiTokenResponse):
    """A token right after creation: the only time the token is returned."""

    token: str
