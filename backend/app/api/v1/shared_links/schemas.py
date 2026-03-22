"""
Pydantic models for shared links module.
"""
from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, IndexModel


class SharedLinkInDB(Document):
    """Shared link document stored in MongoDB."""
    diagram_id: str
    user_id: str
    token: str
    access_type: str  # "public" | "protected"
    access_code_hash: Optional[str] = None
    allow_copy_code: bool = False
    expires_at: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "shared_links"
        indexes = [
            IndexModel([("token", ASCENDING)], unique=True),
            "diagram_id",
            IndexModel([("user_id", ASCENDING), ("is_active", ASCENDING)]),
        ]


class AccessLogInDB(Document):
    """Access log document stored in MongoDB."""
    token: str
    ip_hash: str
    result: str  # "success" | "expired" | "invalid_code" | "blocked" | "not_found"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "shared_link_access_logs"
        indexes = [
            IndexModel([
                ("ip_hash", ASCENDING),
                ("token", ASCENDING),
                ("created_at", DESCENDING),
            ]),
            "created_at",
        ]


# --- Internal repository schemas ---


class SharedLinkCreate(BaseModel):
    """Internal model for creating a shared link in the repository."""
    diagram_id: str
    user_id: str
    token: str
    access_type: str
    access_code_hash: Optional[str] = None
    allow_copy_code: bool = False
    expires_at: Optional[datetime] = None


class SharedLinkUpdate(BaseModel):
    """Internal model for updating a shared link in the repository."""
    access_type: Optional[str] = None
    access_code_hash: Optional[str] = None
    allow_copy_code: Optional[bool] = None
    expires_at: Optional[datetime] = None


class AccessLogCreate(BaseModel):
    """Internal model for creating an access log entry."""
    token: str
    ip_hash: str
    result: str


# --- Request schemas ---


class CreateSharedLinkRequest(BaseModel):
    """Request model for creating a shared link."""
    diagram_id: str
    expiration_days: Optional[int] = Field(
        30, description="5, 10, 30 or None for unlimited"
    )
    access_type: str = Field("public", pattern="^(public|protected)$")
    access_code: Optional[str] = Field(None, min_length=4, max_length=20)
    allow_copy_code: bool = False


class UpdateSharedLinkRequest(BaseModel):
    """Request model for updating a shared link."""
    expiration_days: Optional[int] = None
    access_type: Optional[str] = Field(None, pattern="^(public|protected)$")
    access_code: Optional[str] = None
    allow_copy_code: Optional[bool] = None


class VerifyAccessCodeRequest(BaseModel):
    """Request model for verifying an access code."""
    access_code: str = Field(..., min_length=1, max_length=20)


# --- Response schemas ---


class SharedLinkResponse(BaseModel):
    """Response model for shared link (owner view)."""
    id: str
    diagram_id: str
    token: str
    share_url: str
    access_type: str
    access_code: Optional[str] = None  # Plain code shown to owner on creation only
    allow_copy_code: bool
    expires_at: Optional[datetime]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SharedLinkInfoResponse(BaseModel):
    """Public info response for a shared link."""
    requires_code: bool
    is_expired: bool
    diagram_title: str


class SharedDiagramResponse(BaseModel):
    """Response model for a shared diagram (visitor view)."""
    title: str
    description: Optional[str] = None
    content: Optional[str] = None  # None if allow_copy_code is False
    diagram_type: str
    rendered_content: str
    config: dict
    allow_copy_code: bool
