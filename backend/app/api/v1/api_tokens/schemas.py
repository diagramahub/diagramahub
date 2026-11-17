"""
Pydantic models for API keys (personal API tokens).

A key is shown once, when it is created; only its SHA-256 hash is stored. Each
key has an access level per area (see ``permissions.py``).
"""

from datetime import datetime
from typing import Literal, Optional

from beanie import Document
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo import ASCENDING, IndexModel

from app.core.clock import utcnow

from .permissions import AREA_LEVELS, AccessLevel, ApiKeyArea, Permissions

TOKEN_PREFIX = "dh_pat_"
# Characters after TOKEN_PREFIX kept in clear to tell tokens apart in lists.
TOKEN_HINT_LENGTH = 6
MAX_TOKENS_PER_USER = 20
EXPIRATION_CHOICES = (30, 90, 365)


class ApiTokenInDB(Document):
    """Personal API token stored in MongoDB (hash only)."""

    user_id: str
    name: str
    token_hash: str
    token_hint: str  # e.g. "dh_pat_Ab12Cd…" for display
    # area -> level; areas left out have no access.
    permissions: dict[str, str] = Field(default_factory=dict)
    # Keys created before per-area permissions had one global scope (read/write).
    scope: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None

    class Settings:
        name = "api_tokens"
        indexes = [
            IndexModel([("token_hash", ASCENDING)], unique=True),
            "user_id",
        ]


def _all_areas(permissions: dict[ApiKeyArea, AccessLevel]) -> Permissions:
    return {area: permissions.get(area, AccessLevel.NONE) for area in ApiKeyArea}


class ApiTokenCreateRequest(BaseModel):
    """Request to create a key: its name, expiration and access per area."""

    name: str = Field(..., min_length=1, max_length=60)
    permissions: dict[ApiKeyArea, AccessLevel] = Field(
        ...,
        description="Access per area (projects, diagrams, sharing, community, ai): "
        "none, read or write (ai: none or write). Areas left out get none.",
    )
    expires_in_days: Optional[Literal[30, 90, 365]] = Field(
        90, description="30, 90 or 365 days; null for a token that never expires"
    )

    @field_validator("permissions")
    @classmethod
    def _valid_levels(cls, value: dict[ApiKeyArea, AccessLevel]) -> Permissions:
        for area, level in value.items():
            if level not in AREA_LEVELS[area]:
                raise ValueError(f"{area.value} can't be {level.value}")
        complete = _all_areas(value)
        if all(level == AccessLevel.NONE for level in complete.values()):
            raise ValueError("Give the key access to at least one area")
        return complete


class ApiTokenResponse(BaseModel):
    """A token as listed (never the token itself)."""

    id: str
    name: str
    token_hint: str
    permissions: dict[ApiKeyArea, AccessLevel]
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ApiTokenCreatedResponse(ApiTokenResponse):
    """A token right after creation: the only time the token is returned."""

    token: str
