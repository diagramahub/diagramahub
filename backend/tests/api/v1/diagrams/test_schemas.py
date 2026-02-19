"""
Tests for diagram configuration models.
"""
import pytest
from app.api.v1.diagrams.schemas import (
    MermaidConfig,
    PlantUMLConfig,
    DiagramConfig,
    DiagramBase,
    DiagramCreate,
    DiagramUpdate,
    DiagramInDB,
    DiagramResponse
)


class TestMermaidConfig:
    """Test MermaidConfig model."""

    def test_default_values(self):
        """Test default values for MermaidConfig."""
        config = MermaidConfig()
        assert config.theme == "default"
        assert config.layout == "dagre"
        assert config.look == "classic"
        assert config.handDrawnSeed is None
        assert config.fontFamily is None
        assert config.fontSize is None

    def test_custom_values(self):
        """Test custom values for MermaidConfig."""
        config = MermaidConfig(
            theme="dark",
            layout="elk",
            look="handDrawn",
            handDrawnSeed=42,
            fontFamily="Arial",
            fontSize=14
        )
        assert config.theme == "dark"
        assert config.layout == "elk"
        assert config.look == "handDrawn"
        assert config.handDrawnSeed == 42
        assert config.fontFamily == "Arial"
        assert config.fontSize == 14


class TestPlantUMLConfig:
    """Test PlantUMLConfig model."""

    def test_default_values(self):
        """Test default values for PlantUMLConfig."""
        config = PlantUMLConfig()
        assert config.skinparam == {}

    def test_custom_values(self):
        """Test custom values for PlantUMLConfig."""
        skinparam = {
            "backgroundColor": "#ffffff",
            "sequenceParticipant": "underline"
        }
        config = PlantUMLConfig(skinparam=skinparam)
        assert config.skinparam == skinparam


class TestDiagramConfig:
    """Test DiagramConfig model."""

    def test_default_values(self):
        """Test default values for DiagramConfig."""
        config = DiagramConfig()
        assert config.background_color == "#ffffff"
        assert config.background_pattern == "plain"

    def test_custom_values(self):
        """Test custom values for DiagramConfig."""
        config = DiagramConfig(
            background_color="#f0f0f0",
            background_pattern="grid"
        )
        assert config.background_color == "#f0f0f0"
        assert config.background_pattern == "grid"


class TestDiagramModels:
    """Test diagram models with new config structure."""

    def test_diagram_base_with_config(self):
        """Test DiagramBase with config field."""
        config = DiagramConfig(background_color="#f5f5f5", background_pattern="dots")
        diagram = DiagramBase(
            title="Test Diagram",
            content="graph TD\nA-->B",
            config=config
        )
        assert diagram.title == "Test Diagram"
        assert diagram.content == "graph TD\nA-->B"
        assert diagram.config.background_color == "#f5f5f5"
        assert diagram.config.background_pattern == "dots"

    def test_diagram_create_default_config(self):
        """Test DiagramCreate with default config."""
        diagram = DiagramCreate(
            title="New Diagram"
        )
        assert diagram.title == "New Diagram"
        assert diagram.config.background_color == "#ffffff"
        assert diagram.config.background_pattern == "plain"

    def test_diagram_update_with_config(self):
        """Test DiagramUpdate with config changes."""
        config = DiagramConfig(background_color="#e0e0e0", background_pattern="grid")
        update = DiagramUpdate(
            title="Updated Title",
            config=config
        )
        assert update.title == "Updated Title"
        assert update.config.background_color == "#e0e0e0"
        assert update.config.background_pattern == "grid"
