"""
Pydantic models for prompt history module.
"""

from datetime import datetime, timezone
from typing import Optional

from pydantic import ConfigDict, BaseModel, Field
from beanie import Document


class PromptHistoryInDB(Document):
    """Prompt history document stored in MongoDB."""

    user_id: str
    diagram_id: Optional[str] = None
    prompt_text: str
    prompt_hash: str
    operation_type: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    used_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "prompt_history"
        indexes = [
            [("user_id", 1), ("used_at", -1)],
            [("user_id", 1), ("prompt_hash", 1)],
            [("user_id", 1), ("diagram_id", 1), ("used_at", -1)],
        ]


class PromptHistoryCreate(BaseModel):
    """Model for creating a new prompt history entry."""

    prompt_text: str = Field(..., min_length=1, max_length=5000)
    operation_type: str = Field(..., pattern=r"^(creation|improvement)$")
    diagram_id: Optional[str] = None


class PromptHistoryResponse(BaseModel):
    """Model for prompt history API responses."""

    id: str
    diagram_id: Optional[str] = None
    prompt_text: str
    operation_type: str
    created_at: datetime
    used_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedPromptHistoryResponse(BaseModel):
    """Model for paginated prompt history API responses."""

    items: list[PromptHistoryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
