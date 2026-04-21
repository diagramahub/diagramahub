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
    async def fix_diagram(
        self,
        diagram_code: str,
        diagram_type: str,
        error_context: str | None = None,
        language: str = "es"
    ) -> Dict[str, str]:
        """
        Corregir errores de sintaxis en código de diagrama.

        Args:
            diagram_code: Código del diagrama con errores
            diagram_type: Tipo de diagrama (mermaid, plantuml)
            error_context: Información del error (mensaje, línea)
            language: Idioma para la explicación (es, en)

        Returns:
            Dict con:
            - corrected_code: Código corregido
            - explanation: Explicación de los cambios
            - changes_summary: Resumen breve de cambios

        Raises:
            ValueError: Si la corrección falla
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

    @abstractmethod
    async def chat_with_context(
        self,
        messages: list[dict],
        diagram_code: str,
        diagram_type: str,
        language: str = "es"
    ) -> str:
        """
        Conversación con contexto de historial y diagrama.

        Args:
            messages: Lista de mensajes [{"role": "user"|"assistant", "content": "..."}]
            diagram_code: Código del diagrama actual
            diagram_type: Tipo de diagrama (mermaid, plantuml)
            language: Idioma (es, en)

        Returns:
            Respuesta textual de la IA

        Raises:
            ValueError: Si la generación falla
        """
        pass

    @abstractmethod
    async def summarize_conversation(
        self,
        messages: list[dict],
        language: str = "es"
    ) -> str:
        """
        Genera un resumen compacto de una conversación para compactación de contexto.

        Args:
            messages: Lista de mensajes [{"role": "user"|"assistant", "content": "..."}]
            language: Idioma (es, en)

        Returns:
            Resumen compacto de la conversación

        Raises:
            ValueError: Si la generación falla
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
        Delegado al módulo centralizado de prompts.
        """
        from ..prompts import build_description_prompt
        return build_description_prompt(diagram_code, diagram_type, language)

    def _build_refine_prompt(
        self,
        diagram_code: str,
        diagram_type: str,
        current_description: str,
        refinement_request: str,
        language: str,
    ) -> str:
        """Build prompt for refining an existing description."""
        from ..prompts import build_refine_description_prompt
        return build_refine_description_prompt(
            diagram_code, diagram_type, current_description,
            refinement_request, language,
        )
