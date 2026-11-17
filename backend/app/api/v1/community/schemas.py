"""
Pydantic models for the community portal.

A publication is a snapshot of one of the owner's diagrams (code, type,
description) plus public metadata. Stars, comments and reports reference it.
"""

from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from beanie import Document
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.core.clock import utcnow

MAX_TAGS = 5
MAX_TAG_LENGTH = 30
# A publication with this many open reports is hidden until an admin reviews it.
AUTO_HIDE_REPORTS = 3


class CommunityCategory(str, Enum):
    """Fixed categories of the portal."""

    ARCHITECTURE = "architecture"
    DATABASES = "databases"
    BUSINESS_PROCESSES = "business-processes"
    DEVOPS = "devops"
    UML = "uml"
    SECURITY = "security"
    AI_DATA = "ai-data"
    EDUCATION = "education"


# Everything published is public under one license, so authors don't have to
# pick one and anyone may fork with attribution (which each fork records).
COMMUNITY_LICENSE = "cc-by-4.0"
COMMUNITY_LICENSE_LABEL = "CC BY 4.0"


# --------------------------------------------------------------------------- #
#  Documents
# --------------------------------------------------------------------------- #


class PublishedDiagramInDB(Document):
    """A diagram published to the community (snapshot + metadata + counters)."""

    source_diagram_id: str
    owner_id: str
    owner_name: str
    title: str
    description: str = ""
    diagram_type: str
    content: str
    category: CommunityCategory
    tags: list[str] = []
    allow_comments: bool = True
    auto_update: bool = False
    featured: bool = False
    hidden: bool = False
    stars_count: int = 0
    forks_count: int = 0
    views_count: int = 0
    comments_count: int = 0
    reports_count: int = 0
    published_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "community_diagrams"
        indexes = [
            IndexModel([("source_diagram_id", ASCENDING)], unique=True),
            IndexModel([("hidden", ASCENDING), ("published_at", DESCENDING)]),
            IndexModel([("hidden", ASCENDING), ("stars_count", DESCENDING)]),
            "owner_id",
            "category",
            "tags",
        ]


class CommunityStarInDB(Document):
    """One user's star on one publication."""

    publication_id: str
    user_id: str
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "community_stars"
        indexes = [
            IndexModel([("publication_id", ASCENDING), ("user_id", ASCENDING)], unique=True),
            "user_id",
        ]


class CommunityForkInDB(Document):
    """A fork: who copied which publication into which diagram.

    Kept when the original is unpublished, so the copy still points to where it
    came from and the author keeps the credit for it.
    """

    publication_id: str
    publication_title: str
    publication_owner_id: str
    publication_owner_name: str
    user_id: str
    diagram_id: str
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "community_forks"
        indexes = [
            IndexModel([("diagram_id", ASCENDING)], unique=True),
            "publication_id",
            "publication_owner_id",
            "user_id",
        ]


class CommunityCommentInDB(Document):
    """A public comment; ``parent_id`` makes it a reply (one level)."""

    publication_id: str
    user_id: str
    author_name: str
    text: str
    parent_id: Optional[str] = None
    hidden: bool = False
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "community_comments"
        indexes = [
            IndexModel([("publication_id", ASCENDING), ("created_at", DESCENDING)]),
            "user_id",
        ]


class CommunityReportInDB(Document):
    """A report on a publication or a comment (one per reporter and target)."""

    target_type: Literal["diagram", "comment"]
    target_id: str
    publication_id: str
    reporter_id: str
    reason: str
    resolved: bool = False
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "community_reports"
        indexes = [
            IndexModel(
                [("target_type", ASCENDING), ("target_id", ASCENDING), ("reporter_id", ASCENDING)],
                unique=True,
            ),
            IndexModel([("resolved", ASCENDING), ("created_at", DESCENDING)]),
        ]


# --------------------------------------------------------------------------- #
#  Requests
# --------------------------------------------------------------------------- #


def _clean_tags(tags: list[str]) -> list[str]:
    cleaned: list[str] = []
    for tag in tags:
        value = "-".join(tag.strip().lower().lstrip("#").split())[:MAX_TAG_LENGTH]
        if value and value not in cleaned:
            cleaned.append(value)
    if len(cleaned) > MAX_TAGS:
        raise ValueError(f"At most {MAX_TAGS} tags")
    return cleaned


class PublishRequest(BaseModel):
    """Publish one of the user's diagrams."""

    diagram_id: str
    category: CommunityCategory
    tags: list[str] = Field(default_factory=list)
    description: Optional[str] = Field(None, max_length=5000)
    allow_comments: bool = True
    auto_update: bool = False

    _tags = field_validator("tags")(classmethod(lambda cls, v: _clean_tags(v)))


class UpdatePublicationRequest(BaseModel):
    """Change a publication's metadata (owner); ``refresh_content`` re-snapshots the code."""

    category: Optional[CommunityCategory] = None
    tags: Optional[list[str]] = None
    description: Optional[str] = Field(None, max_length=5000)
    allow_comments: Optional[bool] = None
    auto_update: Optional[bool] = None
    refresh_content: bool = False

    @field_validator("tags")
    @classmethod
    def _tags(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        return None if v is None else _clean_tags(v)


class ForkRequest(BaseModel):
    """Copy a publication into one of the user's projects."""

    project_id: str
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    folder_id: Optional[str] = None


class CommentRequest(BaseModel):
    """A new comment or reply."""

    text: str = Field(..., min_length=1, max_length=2000)
    parent_id: Optional[str] = None


class ReportRequest(BaseModel):
    """Report a publication or a comment."""

    target_type: Literal["diagram", "comment"]
    target_id: str
    reason: str = Field(..., min_length=3, max_length=500)


class ModerationRequest(BaseModel):
    """Admin changes on a publication."""

    featured: Optional[bool] = None
    hidden: Optional[bool] = None


# --------------------------------------------------------------------------- #
#  Responses
# --------------------------------------------------------------------------- #


class PublicationCard(BaseModel):
    """A publication as listed in the portal."""

    id: str
    title: str
    description: str
    diagram_type: str
    content: str
    category: CommunityCategory
    tags: list[str]
    owner_id: str
    owner_name: str
    license: str = COMMUNITY_LICENSE
    featured: bool
    hidden: bool
    stars_count: int
    forks_count: int
    comments_count: int
    starred_by_me: bool = False
    published_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ForkOrigin(BaseModel):
    """The publication a diagram was forked from (``publication_id`` is None once removed)."""

    publication_id: Optional[str] = None
    title: str
    owner_name: str


class PublicationDetail(PublicationCard):
    """A publication with everything its page needs."""

    source_diagram_id: Optional[str] = None  # only for the owner
    views_count: int
    allow_comments: bool
    auto_update: bool
    is_owner: bool = False
    more_from_owner: list[dict] = []
    forked_from: Optional[ForkOrigin] = None


class PublicationPage(BaseModel):
    """A page of publications."""

    items: list[PublicationCard]
    total: int
    page: int
    page_size: int


class CommentResponse(BaseModel):
    """A comment as shown on a publication's page."""

    id: str
    user_id: str
    author_name: str
    text: str
    parent_id: Optional[str]
    is_publication_owner: bool
    can_delete: bool
    created_at: datetime


class ForkResponse(BaseModel):
    """The diagram created by a fork."""

    diagram_id: str
    project_id: str
    title: str


class ReportResponse(BaseModel):
    """An open report (admin view)."""

    id: str
    target_type: str
    target_id: str
    publication_id: str
    publication_title: str
    reason: str
    created_at: datetime
