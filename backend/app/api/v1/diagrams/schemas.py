"""
Pydantic models for diagram module.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from beanie import Document


class DiagramBase(BaseModel):
    """Base diagram model."""
    title: str = Field(..., min_length=1, max_length=100)
    content: str = Field(default="", description="Mermaid diagram code")
    description: Optional[str] = Field(default="", description="Markdown description of the diagram")
    diagram_type: str = Field(default="flowchart", description="Type of diagram (flowchart, sequence, etc)")
    theme: str = Field(default="default", description="Mermaid theme (default, dark, forest, neutral, base)")


class DiagramCreate(DiagramBase):
    """Model for creating a new diagram."""
    folder_id: Optional[str] = None


class DiagramUpdate(BaseModel):
    """Model for updating a diagram."""
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    content: Optional[str] = None
    description: Optional[str] = None
    diagram_type: Optional[str] = None
    theme: Optional[str] = None
    folder_id: Optional[str] = None
    viewport_zoom: Optional[float] = Field(None, ge=0.1, le=10.0, description="Zoom level (0.1 to 10.0)")
    viewport_x: Optional[float] = Field(None, description="Viewport X position")
    viewport_y: Optional[float] = Field(None, description="Viewport Y position")


class DiagramInDB(Document):
    """Diagram document stored in MongoDB."""
    title: str
    content: str
    description: Optional[str] = ""
    diagram_type: str
    theme: str = "default"
    project_id: str
    folder_id: Optional[str] = None
    viewport_zoom: float = 1.0
    viewport_x: float = 0.0
    viewport_y: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "diagrams"
        indexes = ["project_id", "folder_id"]


class DiagramResponse(BaseModel):
    """Model for diagram API responses."""
    id: str
    title: str
    content: str
    description: Optional[str]
    diagram_type: str
    theme: str
    project_id: str
    folder_id: Optional[str] = None
    viewport_zoom: float
    viewport_x: float
    viewport_y: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
