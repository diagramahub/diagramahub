"""
Google Gemini AI client implementation.
Usa el nuevo SDK google-genai (reemplaza al deprecado google-generativeai).
"""
import time

from google import genai
from google.genai import types
from typing import AsyncGenerator, Dict, Any

from .base import BaseAIClient
from ..prompts import (
    build_description_prompt,
    build_generate_diagram_prompt,
    build_improve_diagram_prompt,
    build_chat_system_prompt,
    build_summarize_prompt,
    clean_code_response,
)


class GeminiClient(BaseAIClient):
    """Client for Google Gemini AI."""

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash-lite", parameters: Dict[str, Any] = None):
        super().__init__(api_key, model, parameters or {})
        self.client = genai.Client(api_key=self.api_key)

    def _gen_config(self, temperature: float | None = None, max_tokens: int | None = None) -> types.GenerateContentConfig:
        """Configuracion de generacion reutilizable."""
        return types.GenerateContentConfig(
            temperature=temperature or self.parameters.get("temperature", 0.7),
            top_p=self.parameters.get("top_p", 0.95),
            max_output_tokens=max_tokens or self.parameters.get("max_output_tokens", 4096),
        )

    async def _generate(self, prompt: str, temperature: float | None = None, max_tokens: int | None = None) -> str:
        """Llamada generica async a generate_content de Gemini."""
        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=prompt,
            config=self._gen_config(temperature, max_tokens),
        )
        if not response or not response.text:
            raise ValueError("Gemini returned empty response")
        return response.text.strip()

    async def generate_description(
        self, diagram_code: str, diagram_type: str, language: str = "es"
    ) -> str:
        prompt = build_description_prompt(diagram_code, diagram_type, language)
        try:
            return clean_code_response(await self._generate(prompt))
        except Exception as e:
            raise ValueError(f"Error generating description with Gemini: {str(e)}")

    async def validate_api_key(self) -> bool:
        try:
            result = self.client.models.list()
            return len(list(result)) > 0
        except Exception as e:
            print(f"Gemini API key validation failed: {str(e)}")
            return False

    async def generate_diagram(
        self, description: str, diagram_type: str, language: str = "es"
    ) -> str:
        prompt = build_generate_diagram_prompt(description, diagram_type, language)
        try:
            return clean_code_response(await self._generate(prompt))
        except Exception as e:
            raise ValueError(f"Error generating diagram with Gemini: {str(e)}")

    async def fix_diagram(
        self,
        diagram_code: str,
        diagram_type: str,
        error_context: str | None = None,
        language: str = "es",
    ) -> Dict[str, str]:
        from ...diagrams.fix_prompts import build_fix_prompt
        from ..prompts import extract_fix_json, extract_fix_delimited, clean_code_response

        prompt = build_fix_prompt(diagram_code, diagram_type, error_context, language)
        try:
            response_text = await self._generate(prompt, temperature=0.3)

            if diagram_type.lower() == "dbml":
                fix_result = extract_fix_delimited(response_text, "Gemini")
            else:
                fix_result = extract_fix_json(response_text, "Gemini")
                fix_result["corrected_code"] = clean_code_response(fix_result["corrected_code"])
            return fix_result

        except Exception as e:
            raise ValueError(f"Error al corregir diagrama con Gemini: {str(e)}")

    async def improve_diagram(
        self,
        diagram_code: str,
        improvement_request: str,
        diagram_type: str,
        language: str = "es",
    ) -> str:
        prompt = build_improve_diagram_prompt(diagram_code, improvement_request, diagram_type, language)
        try:
            return clean_code_response(await self._generate(prompt))
        except Exception as e:
            raise ValueError(f"Error improving diagram with Gemini: {str(e)}")

    async def chat_with_context(
        self,
        messages: list[dict],
        diagram_code: str,
        diagram_type: str,
        language: str = "es",
    ) -> str:
        system_prompt = build_chat_system_prompt(diagram_code, diagram_type, language)

        # Gemini usa un prompt unico con historial concatenado
        conversation_parts = [system_prompt, ""]
        for msg in messages:
            role_label = "Usuario" if msg["role"] == "user" else "Asistente"
            if language != "es":
                role_label = "User" if msg["role"] == "user" else "Assistant"
            conversation_parts.append(f"{role_label}: {msg['content']}")

        if language == "es":
            conversation_parts.append("Asistente:")
        else:
            conversation_parts.append("Assistant:")

        full_prompt = "\n".join(conversation_parts)

        try:
            return await self._generate(full_prompt)
        except Exception as e:
            raise ValueError(f"Error in chat with Gemini: {str(e)}")

    async def summarize_conversation(
        self, messages: list[dict], language: str = "es"
    ) -> str:
        prompt = build_summarize_prompt(messages, language)
        try:
            return await self._generate(prompt, temperature=0.5, max_tokens=1024)
        except Exception as e:
            raise ValueError(f"Error summarizing conversation with Gemini: {str(e)}")

    async def chat_with_context_stream(
        self,
        messages: list[dict],
        diagram_code: str,
        diagram_type: str,
        language: str = "es",
    ) -> AsyncGenerator[str, None]:
        """Stream chat response token by token using Gemini async streaming API.

        Uses ``client.aio.models.generate_content_stream`` from the google-genai SDK.

        Args:
            messages: Conversation history
            diagram_code: Current diagram code
            diagram_type: Diagram type (mermaid, plantuml, etc.)
            language: Response language (es, en)

        Yields:
            String chunks as they arrive from Gemini

        Raises:
            ValueError: If streaming fails or times out
        """
        system_prompt = build_chat_system_prompt(diagram_code, diagram_type, language)

        # Build concatenated prompt (same pattern as chat_with_context)
        conversation_parts = [system_prompt, ""]
        for msg in messages:
            role_label = "Usuario" if msg["role"] == "user" else "Asistente"
            if language != "es":
                role_label = "User" if msg["role"] == "user" else "Assistant"
            conversation_parts.append(f"{role_label}: {msg['content']}")

        if language == "es":
            conversation_parts.append("Asistente:")
        else:
            conversation_parts.append("Assistant:")

        full_prompt = "\n".join(conversation_parts)

        try:
            last_token_time = time.time()
            async for chunk in await self.client.aio.models.generate_content_stream(
                model=self.model,
                contents=full_prompt,
                config=self._gen_config(),
            ):
                if time.time() - last_token_time > 60:
                    raise ValueError(
                        f"{self.provider_name} stream timeout: no token received in 60s"
                    )
                if chunk.text:
                    last_token_time = time.time()
                    yield chunk.text

        except ValueError:
            raise
        except Exception as e:
            raise ValueError(
                f"Error in streaming chat with {self.provider_name}: {str(e)}"
            )

    @property
    def provider_name(self) -> str:
        return "Google Gemini"
