"""
Base abstract client for AI providers.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseAIClient(ABC):
    """Abstract base class for AI provider clients."""

    def __init__(self, api_key: str, model: str, parameters: Dict[str, Any]):
        """
        Initialize AI client.

        Args:
            api_key: API key for the provider
            model: Model name to use
            parameters: Provider-specific parameters
        """
        self.api_key = api_key
        self.model = model
        self.parameters = parameters

    @abstractmethod
    async def generate_description(
        self,
        diagram_code: str,
        diagram_type: str,
        language: str = "es"
    ) -> str:
        """
        Generate diagram description using AI.

        Args:
            diagram_code: Diagram code (Mermaid, PlantUML, etc.)
            diagram_type: Type of diagram (flowchart, sequence, etc.)
            language: Language for description (es, en)

        Returns:
            Generated description

        Raises:
            ValueError: If generation fails
        """
        pass

    @abstractmethod
    async def generate_diagram(
        self,
        description: str,
        diagram_type: str,
        language: str = "es"
    ) -> str:
        """
        Generate diagram code from a description.

        Args:
            description: User's description of what they want to diagram
            diagram_type: Type of diagram (mermaid, plantuml)
            language: User's language (es, en)

        Returns:
            Generated diagram code

        Raises:
            ValueError: If generation fails
        """
        pass

    @abstractmethod
    async def improve_diagram(
        self,
        diagram_code: str,
        improvement_request: str,
        diagram_type: str,
        language: str = "es"
    ) -> str:
        """
        Improve an existing diagram based on user's request.

        Args:
            diagram_code: Current diagram code
            improvement_request: User's improvement request
            diagram_type: Type of diagram (mermaid, plantuml)
            language: User's language (es, en)

        Returns:
            Improved diagram code

        Raises:
            ValueError: If improvement fails
        """
        pass

    @abstractmethod
    async def validate_api_key(self) -> bool:
        """
        Validate that the API key is valid and has permissions.

        Returns:
            True if valid, False otherwise
        """
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """
        Name of the provider (for logging/debugging).

        Returns:
            Provider name
        """
        pass

    def _build_prompt(self, diagram_code: str, diagram_type: str, language: str) -> str:
        """
        Build optimized prompt for AI generation.

        Args:
            diagram_code: Diagram code
            diagram_type: Type of diagram
            language: Target language

        Returns:
            Formatted prompt
        """
        lang_map = {
            "es": "español",
            "en": "English"
        }
        lang_text = lang_map.get(language, "español")

        return f"""Eres un experto en análisis de diagramas técnicos. Analiza el siguiente código de diagrama tipo {diagram_type} y genera una descripción técnica clara y concisa en {lang_text}.

Código del diagrama:
```
{diagram_code}
```

Genera una descripción profesional en formato Markdown que incluya:
1. **Propósito**: Objetivo principal del diagrama
2. **Componentes clave**: Elementos principales y su función
3. **Flujo/Relaciones**: Cómo interactúan los componentes
4. **Casos de uso**: Cuándo usar este diagrama

La descripción debe ser técnica pero comprensible, entre 100-300 palabras.

IMPORTANTE: Devuelve ÚNICAMENTE el contenido Markdown puro, SIN bloques de código (```markdown), SIN encabezados adicionales, SIN prefijos. Comienza directamente con el contenido de la descripción."""
