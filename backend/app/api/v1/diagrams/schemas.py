"""
Pydantic models for diagram module.
"""

from datetime import datetime
from typing import Any, Dict, Optional

from beanie import Document
from pydantic import BaseModel, Field


class MermaidConfig(BaseModel):
    """Mermaid diagram configuration."""

    theme: str = Field(
        default="default", description="Mermaid theme (default, dark, forest, neutral, base)"
    )
    layout: str = Field(default="dagre", description="Layout engine (dagre, elk)")
    look: str = Field(default="classic", description="Visual style (classic, handDrawn)")
    handDrawnSeed: Optional[int] = Field(
        default=None, description="Seed for handDrawn look randomization"
    )
    fontFamily: Optional[str] = Field(default=None, description="Font family for diagram text")
    fontSize: Optional[int] = Field(default=None, description="Base font size")

    # Flowchart configuration
    curve: Optional[str] = Field(
        default=None,
        description="Curve type (basis, linear, natural, step, stepBefore, stepAfter, monotoneX, monotoneY)",
    )


class PlantUMLConfig(BaseModel):
    """PlantUML diagram configuration."""

    theme: Optional[str] = Field(
        default="", description="PlantUML theme name (sketchy, blueprint, amiga, etc.)"
    )
    # PlantUML uses skinparam for styling, which can include many options
    skinparam: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="PlantUML skinparam configuration object"
    )
    # Add other PlantUML-specific config options as needed


class DiagramConfig(BaseModel):
    """Generic diagram configuration that can handle different diagram types."""

    background_color: str = Field(
        default="#ffffff", description="Background color for diagram viewer"
    )
    background_pattern: str = Field(
        default="plain", description="Background pattern (plain, dots, grid)"
    )


class DiagramUserPreferences(BaseModel):
    """Per-diagram user preferences that persist across sessions."""

    description_pinned: bool = Field(
        default=False, description="Whether the description panel is pinned open"
    )
    description_font_size: Optional[int] = Field(
        default=None, description="Font size for description panel (10-32)"
    )
    description_panel_width: Optional[int] = Field(
        default=None, description="Width of the description panel in pixels (280-700)"
    )
    chat_panel_width: Optional[int] = Field(
        default=None, description="Width of the chat panel in pixels (320-700)"
    )
    preferred_provider: Optional[str] = Field(
        default=None, description="Preferred AI provider for this diagram"
    )
    preferred_model: Optional[str] = Field(
        default=None, description="Preferred AI model for this diagram"
    )


class DiagramBase(BaseModel):
    """Base diagram model."""

    title: str = Field(..., min_length=1, max_length=100)
    content: str = Field(default="", description="Diagram code (Mermaid, PlantUML, etc.)")
    description: Optional[str] = Field(
        default="", max_length=50000, description="Markdown description of the diagram"
    )
    diagram_type: str = Field(
        default="flowchart", description="Type of diagram (flowchart, sequence, etc)"
    )
    config: DiagramConfig = Field(
        default_factory=DiagramConfig, description="Diagram configuration object"
    )


class DiagramCreate(DiagramBase):
    """Model for creating a new diagram."""

    folder_id: Optional[str] = None


class DiagramUpdate(BaseModel):
    """Model for updating a diagram."""

    title: Optional[str] = Field(None, min_length=1, max_length=100)
    content: Optional[str] = None
    description: Optional[str] = Field(None, max_length=50000)
    diagram_type: Optional[str] = None
    config: Optional[DiagramConfig] = Field(
        default=None, description="Diagram configuration object"
    )
    user_preferences: Optional[DiagramUserPreferences] = Field(
        default=None, description="User preferences for this diagram"
    )
    folder_id: Optional[str] = None
    viewport_zoom: Optional[float] = Field(
        None, ge=0.1, le=10.0, description="Zoom level (0.1 to 10.0)"
    )
    viewport_x: Optional[float] = Field(None, description="Viewport X position")
    viewport_y: Optional[float] = Field(None, description="Viewport Y position")


class DiagramInDB(Document):
    """Diagram document stored in MongoDB."""

    title: str
    content: str
    description: Optional[str] = ""
    diagram_type: str
    config: Optional[DiagramConfig] = Field(
        default_factory=DiagramConfig, description="Diagram configuration object"
    )
    user_preferences: Optional[DiagramUserPreferences] = Field(
        default_factory=DiagramUserPreferences, description="User preferences"
    )
    project_id: str
    folder_id: Optional[str] = None
    viewport_zoom: Optional[float] = 1.0
    viewport_x: Optional[float] = 0.0
    viewport_y: Optional[float] = 0.0
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
    user_preferences: DiagramUserPreferences = Field(default_factory=DiagramUserPreferences)
    project_id: str
    folder_id: Optional[str] = None
    viewport_zoom: Optional[float] = None
    viewport_x: Optional[float] = None
    viewport_y: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Schema para renderizado de diagramas vía Kroki


class RenderDiagramRequest(BaseModel):
    """Solicitud para renderizar un diagrama vía Kroki."""

    source: str = Field(..., min_length=1, description="Código fuente del diagrama")
    diagram_type: str = Field(..., description="Tipo de diagrama (plantuml, d2, graphviz, etc.)")


# Schemas para auto-corrección de diagramas con IA


class FixDiagramRequest(BaseModel):
    """Solicitud para corregir un diagrama."""

    error_context: Optional[str] = Field(
        None, description="Contexto del error de renderizado (mensaje, línea)"
    )
    provider: Optional[str] = Field(
        None, description="Proveedor de IA específico a usar (opcional)"
    )
    language: str = Field(default="es", description="Idioma para la explicación (es, en)")


class FixDiagramResponse(BaseModel):
    """Respuesta de corrección de diagrama."""

    original_code: str = Field(..., description="Código original del diagrama")
    corrected_code: str = Field(..., description="Código corregido del diagrama")
    explanation: str = Field(..., description="Explicación detallada de los cambios")
    changes_summary: str = Field(..., description="Resumen breve de los cambios (1 línea)")
    diff: str = Field(..., description="Diff unificado entre original y corregido")
    provider_used: str = Field(..., description="Proveedor de IA utilizado")
    model_used: str = Field(..., description="Modelo específico utilizado")
    generation_time: float = Field(..., description="Tiempo de generación en segundos")
    validation_passed: bool = Field(
        ..., description="Si el código corregido pasó validación de sintaxis"
    )


# Schemas para conversión de diagramas entre tipos


class ConvertDiagramRequest(BaseModel):
    """Solicitud para convertir un diagrama de un tipo a otro."""

    diagram_code: str = Field(..., min_length=1, description="Código fuente del diagrama actual")
    source_type: str = Field(
        ..., description="Tipo de diagrama actual (mermaid, plantuml, d2, dbml)"
    )
    target_type: str = Field(
        ..., description="Tipo de diagrama destino (mermaid, plantuml, d2, dbml)"
    )
    provider: Optional[str] = Field(
        None, description="Proveedor de IA específico a usar (opcional, usa default si no se indica)"
    )
    language: str = Field(default="es", description="Idioma para mensajes (es, en)")


class ConvertDiagramResponse(BaseModel):
    """Respuesta de conversión de diagrama (preview)."""

    original_code: str = Field(..., description="Código original del diagrama")
    converted_code: str = Field(..., description="Código convertido al tipo destino")
    source_type: str = Field(..., description="Tipo de diagrama original")
    target_type: str = Field(..., description="Tipo de diagrama destino")
    provider_used: str = Field(..., description="Proveedor de IA utilizado")
    model_used: str = Field(..., description="Modelo específico utilizado")
    generation_time: float = Field(..., description="Tiempo de generación en segundos")
    warning: Optional[str] = Field(
        None,
        description="Advertencia sobre posibles incompatibilidades en la conversión",
    )
