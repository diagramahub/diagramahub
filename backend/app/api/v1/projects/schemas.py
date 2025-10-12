"""
Pydantic models for project module.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from beanie import Document


class ProjectBase(BaseModel):
    """Base project model."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    emoji: Optional[str] = Field(default="📊", max_length=10, description="Emoji icon for the project")


class ProjectCreate(ProjectBase):
    """Model for creating a new project."""
    pass


class ProjectUpdate(BaseModel):
    """Model for updating a project."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    emoji: Optional[str] = Field(None, max_length=10)


class ProjectInDB(Document):
    """Project document stored in MongoDB."""
    name: str
    description: Optional[str] = None
    emoji: str = "📊"
    user_id: str  # Owner of the project
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "projects"
        indexes = ["user_id"]


class ProjectResponse(BaseModel):
    """Model for project API responses."""
    id: str
    name: str
    description: Optional[str]
    emoji: str
    user_id: str
    diagram_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectWithDiagramsResponse(ProjectResponse):
    """Project response with diagrams and folders included."""
    diagrams: List = []
    folders: List = []
