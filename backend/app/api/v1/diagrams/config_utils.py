"""
Utilities for embedding and parsing Mermaid configuration in diagram content.
"""
import json
import re
from typing import Optional, Dict, Any
from dataclasses import dataclass

from .schemas import MermaidConfig


@dataclass
class ParseResult:
    """Result of a config parsing operation."""
    success: bool
    config: Optional[MermaidConfig]
    error: Optional[str]
    content_without_init: str


class MermaidConfigEmbedder:
    """Embeds Mermaid configuration into diagram content as init block."""

    def embed_config(self, content: str, config: MermaidConfig) -> str:
        """
        Embed Mermaid configuration into content as init block.
        
        Args:
            content: Original diagram code (may or may not have existing init block)
            config: MermaidConfig object to embed
            
        Returns:
            Content with init block on the first line
            
        Behavior:
            - Removes any existing init block from content
            - Converts config to Mermaid init JSON format
            - Prepends init block to content with proper formatting
        """
        # Remove any existing init block
        content_without_init = self._remove_init_block(content)
        
        # Convert config to init JSON
        init_json = self.config_to_init_json(config)
        
        # Format as init block
        init_block = f"%%{{init: {json.dumps(init_json, separators=(',', ':'))}}}%%"
        
        # Combine init block with content
        if content_without_init.strip():
            return f"{init_block}\n{content_without_init}"
        else:
            return init_block

    def config_to_init_json(self, config: MermaidConfig) -> Dict[str, Any]:
        """
        Convert MermaidConfig to Mermaid init JSON structure.
        
        Args:
            config: MermaidConfig object
            
        Returns:
            Dictionary matching Mermaid init format
        """
        init_json: Dict[str, Any] = {}
        
        # Add theme
        if config.theme:
            init_json["theme"] = config.theme
        
        # Add themeVariables if any font settings are present
        theme_variables: Dict[str, Any] = {}
        
        # Font settings
        if config.fontFamily:
            theme_variables["fontFamily"] = config.fontFamily
        if config.fontSize:
            theme_variables["fontSize"] = f"{config.fontSize}px"

        if theme_variables:
            init_json["themeVariables"] = theme_variables
        
        # Add flowchart configuration
        flowchart_config: Dict[str, Any] = {}
        
        # Curve type - prioritize explicit curve setting, otherwise use layout
        if config.curve:
            flowchart_config["curve"] = config.curve
        elif config.layout == "dagre":
            flowchart_config["curve"] = "basis"
        elif config.layout == "elk":
            flowchart_config["curve"] = "linear"

        if flowchart_config:
            init_json["flowchart"] = flowchart_config
        
        # Add handDrawnSeed only if look is "handDrawn"
        if config.look == "handDrawn" and config.handDrawnSeed is not None:
            init_json["handDrawnSeed"] = config.handDrawnSeed
        
        return init_json

    def _remove_init_block(self, content: str) -> str:
        """Remove init block from content if present."""
        # Pattern to match %%{init: {...}}%%
        pattern = r'%%\{init:\s*\{.*?\}\}%%\n?'
        return re.sub(pattern, '', content, count=1)


class MermaidConfigParser:
    """Parses Mermaid configuration from init block in diagram content."""

    def parse_config(self, content: str) -> ParseResult:
        """
        Parse Mermaid init block from content and extract configuration.
        
        Args:
            content: Diagram content that may contain init block
            
        Returns:
            ParseResult with success status, config, error message, and content without init
        """
        # Extract init block
        init_block_json = self.extract_init_block(content)
        
        if init_block_json is None:
            # No init block found, return None config
            return ParseResult(
                success=True,
                config=None,
                error=None,
                content_without_init=content
            )
        
        # Parse JSON
        try:
            init_json = json.loads(init_block_json)
        except json.JSONDecodeError as e:
            return ParseResult(
                success=False,
                config=None,
                error=f"El bloque de configuración contiene JSON inválido. Error: {str(e)}",
                content_without_init=self._remove_init_block(content)
            )
        
        # Convert to MermaidConfig
        try:
            config = self.init_json_to_config(init_json)
            return ParseResult(
                success=True,
                config=config,
                error=None,
                content_without_init=self._remove_init_block(content)
            )
        except Exception as e:
            return ParseResult(
                success=False,
                config=None,
                error=f"Error al convertir configuración: {str(e)}",
                content_without_init=self._remove_init_block(content)
            )

    def extract_init_block(self, content: str) -> Optional[str]:
        """
        Extract the JSON string from init block in content.
        
        Args:
            content: Diagram content
            
        Returns:
            JSON string from init block, or None if not found
        """
        # Pattern to match %%{init: {...}}%%
        pattern = r'%%\{init:\s*(\{.*?\})\}%%'
        matches = re.findall(pattern, content)
        
        if not matches:
            return None
        
        if len(matches) > 1:
            # Log warning about multiple init blocks (would need logger)
            # For now, just use the first one
            pass
        
        return matches[0]

    def init_json_to_config(self, init_json: Dict[str, Any]) -> MermaidConfig:
        """
        Convert Mermaid init JSON to MermaidConfig object.
        
        Args:
            init_json: Dictionary from Mermaid init block
            
        Returns:
            MermaidConfig object with values from init JSON
        """
        # Extract theme
        theme = init_json.get("theme", "default")
        
        # Extract flowchart configuration
        flowchart_config = init_json.get("flowchart", {})
        
        # Extract curve type
        curve = None
        if isinstance(flowchart_config, dict):
            curve = flowchart_config.get("curve")
        
        # Extract layout from flowchart curve (for backward compatibility)
        layout = "dagre"  # default
        if curve:
            if curve == "linear":
                layout = "elk"
            elif curve == "basis":
                layout = "dagre"
        
        # Extract look based on presence of handDrawnSeed
        look = "classic"  # default
        hand_drawn_seed = init_json.get("handDrawnSeed")
        if hand_drawn_seed is not None:
            look = "handDrawn"
        
        # Extract theme variables
        theme_variables = init_json.get("themeVariables", {})
        
        # Font settings
        font_family = None
        font_size = None
        if isinstance(theme_variables, dict):
            font_family = theme_variables.get("fontFamily")
            font_size_str = theme_variables.get("fontSize")
            if font_size_str and isinstance(font_size_str, str):
                # Remove 'px' suffix if present
                font_size = int(font_size_str.replace("px", ""))
            elif isinstance(font_size_str, int):
                font_size = font_size_str
        
        return MermaidConfig(
            theme=theme,
            layout=layout,
            look=look,
            handDrawnSeed=hand_drawn_seed,
            fontFamily=font_family,
            fontSize=font_size,
            curve=curve
        )

    def _remove_init_block(self, content: str) -> str:
        """Remove init block from content if present."""
        pattern = r'%%\{init:\s*\{.*?\}\}%%\n?'
        return re.sub(pattern, '', content, count=1)
