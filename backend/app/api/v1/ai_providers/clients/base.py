"""
Base abstract client for AI providers.
"""

from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any, Optional

from ..prompts import (
    build_code_system_prompt,
    build_generate_user_prompt,
    build_improve_user_prompt,
    extract_diagram_code,
)

# Diagram code can be long, and reasoning models spend part of the output
# budget thinking: generating/improving gets a larger budget than chat.
CODE_MAX_TOKENS = 8192
# Code must follow a strict syntax: low temperature (ignored by models that
# don't accept it).
CODE_TEMPERATURE = 0.2


class TruncatedResponseError(ValueError):
    """The provider stopped at the output-token limit: the code is incomplete."""


class EmptyResponseError(ValueError):
    """The provider answered without any diagram code."""


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
        # Set by each provider's request method: True when the last reply was
        # cut at the output-token limit (finish/stop reason "length").
        self.last_truncated = False

    @abstractmethod
    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> str:
        """
        Complete a chat request with system and user prompts.

        Single public entry point for raw prompt completion; each client
        maps this to its provider-specific request method and records
        ``last_truncated``.

        Args:
            system_prompt: System-level instructions for the model
            user_prompt: User message content
            max_tokens: Output budget for this call (default: provider settings)
            temperature: Sampling temperature (skipped where unsupported)

        Returns:
            Plain text response from the provider

        Raises:
            ValueError: If generation fails
        """
        pass

    @staticmethod
    def _chat_turns(messages: list[dict]) -> list[dict]:
        """Keep only the ``role``/``content`` keys providers accept for a turn."""
        return [{"role": m["role"], "content": m["content"]} for m in messages]

    async def complete_chat(
        self, system_prompt: str, messages: list[dict], language: str = "es"
    ) -> str:
        """
        Complete a multi-turn conversation.

        Providers with a native chat API override this to send each message as
        a real ``user``/``assistant`` turn, which keeps role adherence (the model
        doesn't "continue the transcript") and matches how they are trained.
        This default flattens the history into a single labelled transcript for
        providers without that API, ending with an assistant cue.

        Args:
            system_prompt: System-level instructions (diagram, markers, rules)
            messages: Conversation turns as ``{"role", "content"}`` dicts
            language: ``es`` or ``en``, used for the transcript labels

        Returns:
            Plain text response from the provider
        """
        user_label, assistant_label = (
            ("Usuario", "Asistente") if language == "es" else ("User", "Assistant")
        )
        lines = [
            f"{user_label if m['role'] == 'user' else assistant_label}: {m['content']}"
            for m in messages
        ]
        lines.append(f"{assistant_label}:")
        return await self.complete(system_prompt, "\n".join(lines))

    @abstractmethod
    async def generate_description(
        self, diagram_code: str, diagram_type: str, language: str = "es"
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

    async def _complete_code(self, system_prompt: str, user_prompt: str) -> str:
        """Run a code request and return just the diagram code.

        Raises:
            TruncatedResponseError: the reply hit the output limit (code incomplete)
            EmptyResponseError: the reply contains no code
        """
        self.last_truncated = False
        reply = await self.complete(
            system_prompt, user_prompt, max_tokens=CODE_MAX_TOKENS, temperature=CODE_TEMPERATURE
        )
        if self.last_truncated:
            raise TruncatedResponseError("The diagram was cut off at the output limit")
        code = extract_diagram_code(reply)
        if not code.strip():
            raise EmptyResponseError("The model returned no diagram code")
        return code

    async def generate_diagram(
        self, description: str, diagram_type: str, language: str = "es"
    ) -> str:
        """
        Generate diagram code from a description (same prompt for every provider).

        Args:
            description: User's description of what they want to diagram
            diagram_type: Type of diagram (mermaid, plantuml, d2, dbml)
            language: User's language (es, en) for the labels

        Returns:
            Generated diagram code

        Raises:
            TruncatedResponseError / EmptyResponseError: see ``_complete_code``
            ValueError: If the provider call fails
        """
        return await self._complete_code(
            build_code_system_prompt(diagram_type, language),
            build_generate_user_prompt(description),
        )

    async def improve_diagram(
        self, diagram_code: str, improvement_request: str, diagram_type: str, language: str = "es"
    ) -> str:
        """
        Improve an existing diagram based on the user's request.

        Args:
            diagram_code: Current diagram code
            improvement_request: User's improvement request
            diagram_type: Type of diagram (mermaid, plantuml, d2, dbml)
            language: User's language (es, en) for the labels

        Returns:
            Improved diagram code

        Raises:
            TruncatedResponseError / EmptyResponseError: see ``_complete_code``
            ValueError: If the provider call fails
        """
        return await self._complete_code(
            build_code_system_prompt(diagram_type, language),
            build_improve_user_prompt(diagram_code, improvement_request),
        )

    @abstractmethod
    async def fix_diagram(
        self,
        diagram_code: str,
        diagram_type: str,
        error_context: str | None = None,
        language: str = "es",
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
        self, messages: list[dict], diagram_code: str, diagram_type: str, language: str = "es"
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
    async def summarize_conversation(self, messages: list[dict], language: str = "es") -> str:
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

    async def chat_with_context_stream(
        self,
        messages: list[dict],
        diagram_code: str,
        diagram_type: str,
        language: str = "es",
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat response token by token.

        Override this method in provider clients that support streaming.
        The StreamingService detects streaming support by checking whether
        this method has been overridden (not raising NotImplementedError).

        Args:
            messages: Conversation history [{"role": "user"|"assistant", "content": "..."}]
            diagram_code: Current diagram code
            diagram_type: Diagram type (mermaid, plantuml, d2, dbml)
            language: Response language (es, en)

        Yields:
            String chunks as they arrive from the provider

        Raises:
            NotImplementedError: If the provider does not support streaming
            ValueError: If streaming fails or times out
        """
        raise NotImplementedError(f"{self.provider_name} does not support streaming")
        # Make this an async generator (yield is unreachable but required by Python)
        yield ""  # pragma: no cover

    def _build_prompt(self, diagram_code: str, diagram_type: str, language: str) -> str:
        """
        Build optimized prompt for AI generation.
        Delegado al módulo centralizado de prompts.
        """
        from ..prompts import build_description_prompt

        return build_description_prompt(diagram_code, diagram_type, language)
