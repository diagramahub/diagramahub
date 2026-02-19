"""
Pydantic models for diagram module.
"""
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from beanie import Document


class MermaidConfig(BaseModel):
    """Mermaid diagram configuration."""
    theme: str = Field(default="default", description="Mermaid theme (default, dark, forest, neutral, base)")
    layout: str = Field(default="dagre", description="Layout engine (dagre, elk)")
    look: str = Field(default="classic", description="Visual style (classic, handDrawn)")
    handDrawnSeed: Optional[int] = Field(default=None, description="Seed for handDrawn look randomization")
    fontFamily: Optional[str] = Field(default=None, description="Font family for diagram text")
    fontSize: Optional[int] = Field(default=None, description="Base font size")
    
    # Flowchart configuration
    curve: Optional[str] = Field(default=None, description="Curve type (basis, linear, natural, step, stepBefore, stepAfter, monotoneX, monotoneY)")


class PlantUMLConfig(BaseModel):
    """PlantUML diagram configuration."""
    theme: Optional[str] = Field(default="", description="PlantUML theme name (sketchy, blueprint, amiga, etc.)")
    # PlantUML uses skinparam for styling, which can include many options
    skinparam: Optional[Dict[str, Any]] = Field(default_factory=dict, description="PlantUML skinparam configuration object")
    # Add other PlantUML-specific config options as needed


class DiagramConfig(BaseModel):
    """Generic diagram configuration that can handle different diagram types."""
    background_color: str = Field(default="#ffffff", description="Background color for diagram viewer")
    background_pattern: str = Field(default="plain", description="Background pattern (plain, dots, grid)")


class DiagramBase(BaseModel):
    """Base diagram model."""
    title: str = Field(..., min_length=1, max_length=100)
    content: str = Field(default="", description="Diagram code (Mermaid, PlantUML, etc.)")
    description: Optional[str] = Field(default="", description="Markdown description of the diagram")
    diagram_type: str = Field(default="flowchart", description="Type of diagram (flowchart, sequence, etc)")
    config: DiagramConfig = Field(default_factory=DiagramConfig, description="Diagram configuration object")


class DiagramCreate(DiagramBase):
    """Model for creating a new diagram."""
    folder_id: Optional[str] = None


class DiagramUpdate(BaseModel):
    """Model for updating a diagram."""
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    content: Optional[str] = None
    description: Optional[str] = None
    diagram_type: Optional[str] = None
    config: Optional[DiagramConfig] = Field(default=None, description="Diagram configuration object")
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
    config: DiagramConfig = Field(default_factory=DiagramConfig, description="Diagram configuration object")
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
    config: DiagramConfig
    project_id: str
    folder_id: Optional[str] = None
    viewport_zoom: float
    viewport_x: float
    viewport_y: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
