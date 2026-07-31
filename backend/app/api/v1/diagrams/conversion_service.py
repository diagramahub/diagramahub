"""
Service for converting diagrams between different types using AI.
"""
import logging
import re
import time
from typing import Optional

from fastapi import HTTPException, status

from app.api.v1.ai_providers.clients.base import BaseAIClient
from app.api.v1.ai_providers.clients.factory import AIClientFactory
from app.api.v1.ai_providers.interfaces import IAIProviderRepository
from app.api.v1.ai_providers.prompts import (
    CONVERSION_SYSTEM_PROMPT,
    build_convert_diagram_prompt,
    clean_code_response,
)
from app.api.v1.ai_providers.schemas import AIProviderType

from .schemas import ConvertDiagramRequest, ConvertDiagramResponse

logger = logging.getLogger(__name__)

# Supported diagram types for conversion (freehand is excluded — it's a visual canvas, not text-based)
CONVERTIBLE_TYPES = {"mermaid", "plantuml", "d2", "dbml"}


def _strip_think_tags(text: str) -> str:
    """Remove <think>...</think> chain-of-thought tags from AI responses."""
    text = re.sub(r"<think>.*?</think>\s*", "", text, flags=re.DOTALL)
    if "<think>" in text:
        text = text[: text.index("<think>")].strip()
    return text.strip()


def _get_conversion_warning(source_type: str, target_type: str, language: str) -> Optional[str]:
    """Generate a user-facing warning about potential conversion incompatibilities."""
    warnings_es = {
        ("mermaid", "dbml"): (
            "La conversión de Mermaid a DBML solo es posible para diagramas ER. "
            "Otros tipos de diagrama (flowchart, sequence, etc.) no tienen equivalente en DBML."
        ),
        ("dbml", "mermaid"): (
            "DBML se convertirá a un diagrama ER de Mermaid. "
            "Algunos atributos específicos de DBML (indexes, enums complejos) pueden simplificarse."
        ),
        ("dbml", "plantuml"): (
            "DBML se convertirá a un diagrama de clases o ER de PlantUML. "
            "Algunos atributos específicos de DBML pueden simplificarse."
        ),
        ("dbml", "d2"): (
            "DBML se convertirá a un diagrama D2 con tablas como objetos. "
            "La representación visual puede diferir significativamente."
        ),
        ("d2", "mermaid"): (
            "Algunos elementos avanzados de D2 (contenedores anidados, estilos avanzados) "
            "pueden no tener equivalente directo en Mermaid."
        ),
        ("mermaid", "d2"): (
            "La mayoría de diagramas Mermaid se convierten bien a D2, "
            "pero diagramas de secuencia y Gantt pueden perder ciertos detalles."
        ),
        ("plantuml", "mermaid"): (
            "PlantUML tiene más opciones de personalización (skinparam, colores). "
            "Algunas de estas personalizaciones pueden simplificarse en Mermaid."
        ),
        ("mermaid", "plantuml"): (
            "La conversión preservará la estructura general. "
            "Estilos visuales (classDef) se adaptarán usando skinparam de PlantUML."
        ),
    }
    warnings_en = {
        ("mermaid", "dbml"): (
            "Converting Mermaid to DBML is only possible for ER diagrams. "
            "Other diagram types (flowchart, sequence, etc.) have no DBML equivalent."
        ),
        ("dbml", "mermaid"): (
            "DBML will be converted to a Mermaid ER diagram. "
            "Some DBML-specific attributes (indexes, complex enums) may be simplified."
        ),
        ("dbml", "plantuml"): (
            "DBML will be converted to a PlantUML class or ER diagram. "
            "Some DBML-specific attributes may be simplified."
        ),
        ("dbml", "d2"): (
            "DBML will be converted to a D2 diagram with tables as objects. "
            "The visual representation may differ significantly."
        ),
        ("d2", "mermaid"): (
            "Some advanced D2 elements (nested containers, advanced styles) "
            "may not have a direct equivalent in Mermaid."
        ),
        ("mermaid", "d2"): (
            "Most Mermaid diagrams convert well to D2, "
            "but sequence diagrams and Gantt charts may lose certain details."
        ),
        ("plantuml", "mermaid"): (
            "PlantUML has more customization options (skinparam, colors). "
            "Some of these customizations may be simplified in Mermaid."
        ),
        ("mermaid", "plantuml"): (
            "The conversion will preserve the overall structure. "
            "Visual styles (classDef) will be adapted using PlantUML skinparam."
        ),
    }

    warnings = warnings_es if language == "es" else warnings_en
    key = (source_type.lower(), target_type.lower())
    return warnings.get(key)


class DiagramConversionService:
    """Service for AI-powered diagram type conversion."""

    def __init__(self, ai_provider_repository: IAIProviderRepository):
        self.ai_provider_repository = ai_provider_repository

    async def convert_diagram(
        self,
        user_id: str,
        request: ConvertDiagramRequest,
    ) -> ConvertDiagramResponse:
        """
        Convert a diagram from one type to another using the user's AI provider.

        This generates a preview — the actual diagram update is handled separately
        by the caller if the user accepts the conversion.

        Args:
            user_id: User ID
            request: Conversion request with source code, types, and preferences

        Returns:
            ConvertDiagramResponse with converted code for preview

        Raises:
            HTTPException: If validation fails or AI generation fails
        """
        source = request.source_type.lower()
        target = request.target_type.lower()

        # Validate types
        if source not in CONVERTIBLE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tipo de diagrama origen '{source}' no soportado para conversión. "
                f"Tipos soportados: {', '.join(sorted(CONVERTIBLE_TYPES))}",
            )
        if target not in CONVERTIBLE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tipo de diagrama destino '{target}' no soportado para conversión. "
                f"Tipos soportados: {', '.join(sorted(CONVERTIBLE_TYPES))}",
            )
        if source == target:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El tipo de diagrama origen y destino no pueden ser iguales.",
            )

        # Resolve provider
        provider_type = (
            AIProviderType(request.provider) if request.provider else None
        )
        provider_config = await self.ai_provider_repository.get_active_provider(
            user_id, provider_type
        )
        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active AI provider configured. Please add an API key in settings.",
            )

        # Create AI client
        try:
            client = AIClientFactory.create_client(
                provider=provider_config.provider,
                api_key=provider_config.api_key,
                model=provider_config.model,
                parameters=provider_config.parameters,
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
            )

        # Build prompt and call AI
        prompt = build_convert_diagram_prompt(
            diagram_code=request.diagram_code,
            source_type=source,
            target_type=target,
            language=request.language,
        )

        start_time = time.time()
        try:
            raw_response = await self._call_with_prompt(client, prompt)
            converted_code = clean_code_response(raw_response)
            converted_code = _strip_think_tags(converted_code)
            generation_time = round(time.time() - start_time, 2)
        except Exception as e:
            logger.error("Diagram conversion failed: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error during diagram conversion: {str(e)}",
            )

        # Generate warning for known incompatibility pairs
        warning = _get_conversion_warning(source, target, request.language)

        return ConvertDiagramResponse(
            original_code=request.diagram_code,
            converted_code=converted_code,
            source_type=source,
            target_type=target,
            provider_used=provider_config.provider,
            model_used=provider_config.model,
            generation_time=generation_time,
            warning=warning,
        )

    async def _call_with_prompt(self, client: BaseAIClient, prompt: str) -> str:
        """Call the AI client with a conversion prompt using the appropriate method."""
        if hasattr(client, "_generate"):
            # Gemini client
            return await client._generate(prompt)
        elif hasattr(client, "_chat_completion"):
            # OpenAI client
            return await client._chat_completion(
                [
                    {"role": "system", "content": CONVERSION_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ]
            )
        elif hasattr(client, "_make_request"):
            # DeepSeek / MiniMax client
            return await client._make_request(
                [
                    {"role": "system", "content": CONVERSION_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ]
            )
        elif hasattr(client, "_messages_request"):
            # Claude client
            return await client._messages_request(
                [{"role": "user", "content": prompt}],
                system=CONVERSION_SYSTEM_PROMPT,
            )
        else:
            raise ValueError(f"Unsupported client type: {type(client).__name__}")
