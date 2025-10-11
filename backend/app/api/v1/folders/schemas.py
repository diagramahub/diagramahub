"""
Pydantic models for folder module.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from beanie import Document


class FolderBase(BaseModel):
    """Base folder model."""
    name: str = Field(..., min_length=1, max_length=100)
    color: Optional[str] = Field(default="#3B82F6", description="Hex color for folder")


class FolderCreate(FolderBase):
    """Model for creating a new folder."""
    pass


class FolderUpdate(BaseModel):
    """Model for updating a folder."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = None


class FolderInDB(Document):
    """Folder document stored in MongoDB."""
    name: str
    color: str = "#3B82F6"
    project_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "folders"
        indexes = ["project_id"]


class FolderResponse(BaseModel):
    """Model for folder API responses."""
    id: str
    name: str
    color: str
    project_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FolderWithDiagramsResponse(FolderResponse):
    """Folder response with diagrams included."""
    diagrams: List = []
