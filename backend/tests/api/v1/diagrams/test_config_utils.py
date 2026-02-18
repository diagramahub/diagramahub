"""
Unit tests for Mermaid config embedding and parsing utilities.
"""
import pytest
from app.api.v1.diagrams.config_utils import (
    MermaidConfigEmbedder,
    MermaidConfigParser,
    ParseResult
)
from app.api.v1.diagrams.schemas import MermaidConfig


class TestMermaidConfigEmbedder:
    """Tests for MermaidConfigEmbedder class."""

    def test_embed_config_simple(self):
        """Test embedding config into simple diagram content."""
        embedder = MermaidConfigEmbedder()
        config = MermaidConfig(
            theme="base",
            layout="dagre",
            look="classic"
        )
        content = "flowchart LR\nA --> B"
        
        result = embedder.embed_config(content, config)
        
        assert result.startswith("%%{init:")
        assert "flowchart LR" in result
        assert result.count("%%{init:") == 1

    def test_embed_config_with_fonts(self):
        """Test embedding config with font settings."""
        embedder = MermaidConfigEmbedder()
        config = MermaidConfig(
            theme="base",
            layout="dagre",
            look="classic",
            fontFamily="Arial",
            fontSize=16
        )
        content = "flowchart LR\nA --> B"
        
        result = embedder.embed_config(content, config)
        
        assert "fontFamily" in result
        assert "Arial" in result
        assert "16px" in result

    def test_embed_config_handdrawn(self):
        """Test embedding config with handDrawn look."""
        embedder = MermaidConfigEmbedder()
        config = MermaidConfig(
            theme="base",
            layout="dagre",
            look="handDrawn",
            handDrawnSeed=42
        )
        content = "flowchart LR\nA --> B"
        
        result = embedder.embed_config(content, config)
        
        assert "handDrawnSeed" in result
        assert "42" in result

    def test_embed_config_replaces_existing(self):
        """Test that embedding replaces existing init block."""
        embedder = MermaidConfigEmbedder()
        config = MermaidConfig(
            theme="dark",
            layout="elk",
            look="classic"
        )
        content = '%%{init: {"theme":"base"}}%%\nflowchart LR\nA --> B'
        
        result = embedder.embed_config(content, config)
        
        assert result.count("%%{init:") == 1
        assert '"theme":"dark"' in result

    def test_embed_config_empty_content(self):
        """Test embedding config with empty content."""
        embedder = MermaidConfigEmbedder()
        config = MermaidConfig(
            theme="base",
            layout="dagre",
            look="classic"
        )
        content = ""
        
        result = embedder.embed_config(content, config)
        
        assert result.startswith("%%{init:")
        assert result.endswith("%%")

    def test_config_to_init_json_dagre_layout(self):
        """Test conversion of config with dagre layout."""
        embedder = MermaidConfigEmbedder()
        config = MermaidConfig(
            theme="base",
            layout="dagre",
            look="classic"
        )
        
        init_json = embedder.config_to_init_json(config)
        
        assert init_json["theme"] == "base"
        assert init_json["flowchart"]["curve"] == "basis"

    def test_config_to_init_json_elk_layout(self):
        """Test conversion of config with elk layout."""
        embedder = MermaidConfigEmbedder()
        config = MermaidConfig(
            theme="base",
            layout="elk",
            look="classic"
        )
        
        init_json = embedder.config_to_init_json(config)
        
        assert init_json["flowchart"]["curve"] == "linear"

    def test_config_to_init_json_no_handdrawn_seed_for_classic(self):
        """Test that handDrawnSeed is not included for classic look."""
        embedder = MermaidConfigEmbedder()
        config = MermaidConfig(
            theme="base",
            layout="dagre",
            look="classic",
            handDrawnSeed=42  # Should be ignored
        )
        
        init_json = embedder.config_to_init_json(config)
        
        assert "handDrawnSeed" not in init_json


class TestMermaidConfigParser:
    """Tests for MermaidConfigParser class."""

    def test_parse_config_simple(self):
        """Test parsing simple init block."""
        parser = MermaidConfigParser()
        content = '%%{init: {"theme":"base","flowchart":{"curve":"basis"}}}%%\nflowchart LR\nA --> B'
        
        result = parser.parse_config(content)
        
        assert result.success is True
        assert result.config is not None
        assert result.config.theme == "base"
        assert result.config.layout == "dagre"
        assert result.error is None

    def test_parse_config_no_init_block(self):
        """Test parsing content without init block."""
        parser = MermaidConfigParser()
        content = "flowchart LR\nA --> B"
        
        result = parser.parse_config(content)
        
        assert result.success is True
        assert result.config is None
        assert result.error is None

    def test_parse_config_invalid_json(self):
        """Test parsing init block with invalid JSON."""
        parser = MermaidConfigParser()
        content = '%%{init: {invalid json}}%%\nflowchart LR\nA --> B'
        
        result = parser.parse_config(content)
        
        assert result.success is False
        assert result.config is None
        assert result.error is not None
        assert "JSON inválido" in result.error

    def test_parse_config_with_fonts(self):
        """Test parsing init block with font settings."""
        parser = MermaidConfigParser()
        content = '%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial","fontSize":"16px"}}}%%\nflowchart LR'
        
        result = parser.parse_config(content)
        
        assert result.success is True
        assert result.config.fontFamily == "Arial"
        assert result.config.fontSize == 16

    def test_parse_config_handdrawn(self):
        """Test parsing init block with handDrawn look."""
        parser = MermaidConfigParser()
        content = '%%{init: {"theme":"base","handDrawnSeed":42}}%%\nflowchart LR'
        
        result = parser.parse_config(content)
        
        assert result.success is True
        assert result.config.look == "handDrawn"
        assert result.config.handDrawnSeed == 42

    def test_parse_config_elk_layout(self):
        """Test parsing init block with elk layout."""
        parser = MermaidConfigParser()
        content = '%%{init: {"theme":"base","flowchart":{"curve":"linear"}}}%%\nflowchart LR'
        
        result = parser.parse_config(content)
        
        assert result.success is True
        assert result.config.layout == "elk"

    def test_parse_config_multiple_init_blocks(self):
        """Test parsing content with multiple init blocks (uses first)."""
        parser = MermaidConfigParser()
        content = '%%{init: {"theme":"base"}}%%\n%%{init: {"theme":"dark"}}%%\nflowchart LR'
        
        result = parser.parse_config(content)
        
        assert result.success is True
        assert result.config.theme == "base"

    def test_extract_init_block_found(self):
        """Test extracting init block when present."""
        parser = MermaidConfigParser()
        content = '%%{init: {"theme":"base"}}%%\nflowchart LR'
        
        init_json = parser.extract_init_block(content)
        
        assert init_json is not None
        assert "theme" in init_json

    def test_extract_init_block_not_found(self):
        """Test extracting init block when not present."""
        parser = MermaidConfigParser()
        content = "flowchart LR\nA --> B"
        
        init_json = parser.extract_init_block(content)
        
        assert init_json is None

    def test_content_without_init_removed(self):
        """Test that content_without_init has init block removed."""
        parser = MermaidConfigParser()
        content = '%%{init: {"theme":"base"}}%%\nflowchart LR\nA --> B'
        
        result = parser.parse_config(content)
        
        assert "%%{init:" not in result.content_without_init
        assert "flowchart LR" in result.content_without_init

    def test_parse_config_empty_content(self):
        """Test parsing empty content."""
        parser = MermaidConfigParser()
        content = ""
        
        result = parser.parse_config(content)
        
        assert result.success is True
        assert result.config is None

    def test_parse_config_special_characters(self):
        """Test parsing init block with special characters in strings."""
        parser = MermaidConfigParser()
        content = '%%{init: {"theme":"base","themeVariables":{"fontFamily":"Times New Roman"}}}%%\nflowchart LR'
        
        result = parser.parse_config(content)
        
        assert result.success is True
        assert result.config.fontFamily == "Times New Roman"
