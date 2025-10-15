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

    def test_mermaid_config(self):
        """Test DiagramConfig with mermaid configuration."""
        mermaid_config = MermaidConfig(theme="dark", layout="elk")
        config = DiagramConfig(mermaid=mermaid_config)
        assert config.mermaid == mermaid_config
        assert config.plantuml is None

    def test_plantuml_config(self):
        """Test DiagramConfig with plantuml configuration."""
        plantuml_config = PlantUMLConfig(skinparam={"backgroundColor": "#fff"})
        config = DiagramConfig(plantuml=plantuml_config)
        assert config.plantuml == plantuml_config
        assert config.mermaid is None

    def test_both_configs(self):
        """Test DiagramConfig with both configurations."""
        mermaid_config = MermaidConfig(theme="forest")
        plantuml_config = PlantUMLConfig(skinparam={"color": "blue"})
        config = DiagramConfig(mermaid=mermaid_config, plantuml=plantuml_config)
        assert config.mermaid == mermaid_config
        assert config.plantuml == plantuml_config

    def test_for_mermaid_classmethod(self):
        """Test DiagramConfig.for_mermaid() class method."""
        config = DiagramConfig.for_mermaid(theme="neutral", layout="elk", look="handDrawn")
        assert config.mermaid is not None
        assert config.mermaid.theme == "neutral"
        assert config.mermaid.layout == "elk"
        assert config.mermaid.look == "handDrawn"
        assert config.plantuml is None

    def test_for_plantuml_classmethod(self):
        """Test DiagramConfig.for_plantuml() class method."""
        skinparam = {"backgroundColor": "#f0f0f0"}
        config = DiagramConfig.for_plantuml(skinparam=skinparam)
        assert config.plantuml is not None
        assert config.plantuml.skinparam == skinparam
        assert config.mermaid is None


class TestDiagramModels:
    """Test diagram models with new config structure."""

    def test_diagram_base_with_config(self):
        """Test DiagramBase with config field."""
        config = DiagramConfig.for_mermaid(theme="dark")
        diagram = DiagramBase(
            title="Test Diagram",
            content="graph TD\nA-->B",
            config=config
        )
        assert diagram.title == "Test Diagram"
        assert diagram.content == "graph TD\nA-->B"
        assert diagram.config.mermaid.theme == "dark"

    def test_diagram_create_default_config(self):
        """Test DiagramCreate with default config."""
        diagram = DiagramCreate(
            title="New Diagram",
            project_id="project123"
        )
        assert diagram.title == "New Diagram"
        assert diagram.project_id == "project123"
        assert diagram.config.mermaid is not None
        assert diagram.config.mermaid.theme == "default"

    def test_diagram_update_with_config(self):
        """Test DiagramUpdate with config changes."""
        config = DiagramConfig.for_mermaid(theme="forest", look="handDrawn")
        update = DiagramUpdate(
            title="Updated Title",
            config=config
        )
        assert update.title == "Updated Title"
        assert update.config.mermaid.theme == "forest"
        assert update.config.mermaid.look == "handDrawn"
