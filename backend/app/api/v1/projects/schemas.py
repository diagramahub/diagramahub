"""
Pydantic models for project module.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from beanie import Document


class DiagramBase(BaseModel):
    """Base diagram model."""
    title: str = Field(..., min_length=1, max_length=100)
    content: str = Field(default="", description="Mermaid diagram code")
    description: Optional[str] = Field(default="", description="Markdown description of the diagram")
    diagram_type: str = Field(default="flowchart", description="Type of diagram (flowchart, sequence, etc)")


class DiagramCreate(DiagramBase):
    """Model for creating a new diagram."""
    folder_id: Optional[str] = None


class DiagramUpdate(BaseModel):
    """Model for updating a diagram."""
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    content: Optional[str] = None
    description: Optional[str] = None
    diagram_type: Optional[str] = None
    folder_id: Optional[str] = None


class DiagramInDB(Document):
    """Diagram document stored in MongoDB."""
    title: str
    content: str
    description: Optional[str] = ""
    diagram_type: str
    project_id: str
    folder_id: Optional[str] = None
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
    project_id: str
    folder_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Folder Models ============

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
    diagrams: List[DiagramResponse] = []


class ProjectBase(BaseModel):
    """Base project model."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class ProjectCreate(ProjectBase):
    """Model for creating a new project."""
    pass


class ProjectUpdate(BaseModel):
    """Model for updating a project."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None


class ProjectInDB(Document):
    """Project document stored in MongoDB."""
    name: str
    description: Optional[str] = None
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
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectWithDiagramsResponse(ProjectResponse):
    """Project response with diagrams and folders included."""
    diagrams: List[DiagramResponse] = []
    folders: List[FolderWithDiagramsResponse] = []
