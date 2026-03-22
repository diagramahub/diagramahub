"""
Google Gemini AI client implementation.
Usa el nuevo SDK google-genai (reemplaza al deprecado google-generativeai).
"""
from google import genai
from google.genai import types
from typing import Dict, Any
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
            max_output_tokens=max_tokens or self.parameters.get("max_output_tokens", 2048),
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
        import json
        import re

        prompt = build_fix_prompt(diagram_code, diagram_type, error_context, language)
        try:
            response_text = await self._generate(prompt, temperature=0.3)

            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if not json_match:
                raise ValueError("No se pudo extraer JSON de la respuesta de Gemini")

            fix_result = json.loads(json_match.group())
            for field in ("corrected_code", "explanation", "changes_summary"):
                if field not in fix_result:
                    raise ValueError(f"Respuesta de Gemini no contiene '{field}'")

            fix_result["corrected_code"] = clean_code_response(fix_result["corrected_code"])
            return fix_result

        except json.JSONDecodeError as e:
            raise ValueError(f"Error al parsear respuesta JSON de Gemini: {str(e)}")
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

    @property
    def provider_name(self) -> str:
        return "Google Gemini"
