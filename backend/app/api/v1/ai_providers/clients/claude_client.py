"""
Anthropic Claude client implementation.
"""
import httpx
from typing import Dict, Any
from .base import BaseAIClient
from ..prompts import (
    build_description_prompt,
    build_generate_diagram_prompt,
    build_improve_diagram_prompt,
    build_chat_system_prompt,
    build_summarize_prompt,
    clean_code_response,
    SUMMARIZE_SYSTEM_PROMPT,
)


class ClaudeClient(BaseAIClient):
    """Client for Anthropic Claude."""

    def __init__(self, api_key: str, model: str = "claude-haiku-4-5-20251001", parameters: Dict[str, Any] = None):
        super().__init__(api_key, model, parameters or {})
        self.base_url = "https://api.anthropic.com/v1"
        self.headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

    async def _messages_request(
        self,
        messages: list[dict],
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        """Llamada genérica al endpoint /messages de Claude.
        
        Claude usa un campo 'system' de nivel superior en lugar de un mensaje con role=system.
        """
        payload: dict[str, Any] = {
            "model": self.model,
            "max_tokens": max_tokens or self.parameters.get("max_tokens", 2048),
            "temperature": temperature or self.parameters.get("temperature", 0.7),
            "messages": messages,
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/messages",
                headers=self.headers,
                json=payload,
            )

            if response.status_code == 429:
                raise ValueError("Rate limit excedido. Por favor intenta de nuevo en unos momentos.")
            if response.status_code != 200:
                raise ValueError(f"Claude API error: {response.status_code} - {response.text}")

            result = response.json()
            if not result.get("content") or len(result["content"]) == 0:
                raise ValueError("Claude returned empty response")

            return result["content"][0]["text"].strip()

    async def generate_description(
        self, diagram_code: str, diagram_type: str, language: str = "es"
    ) -> str:
        prompt = build_description_prompt(diagram_code, diagram_type, language)
        try:
            response = await self._messages_request(
                [{"role": "user", "content": prompt}]
            )
            return clean_code_response(response)
        except httpx.TimeoutException:
            raise ValueError("Claude API request timed out")
        except Exception as e:
            raise ValueError(f"Error generating description with Claude: {str(e)}")

    async def validate_api_key(self) -> bool:
        try:
            payload = {
                "model": self.model,
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "Hi"}],
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/messages",
                    headers=self.headers,
                    json=payload,
                )
                return response.status_code == 200
        except Exception as e:
            print(f"Claude API key validation failed: {str(e)}")
            return False

    async def generate_diagram(
        self, description: str, diagram_type: str, language: str = "es"
    ) -> str:
        prompt = build_generate_diagram_prompt(description, diagram_type, language)
        try:
            response = await self._messages_request(
                [{"role": "user", "content": prompt}]
            )
            return clean_code_response(response)
        except httpx.TimeoutException:
            raise ValueError("Claude API request timed out")
        except Exception as e:
            raise ValueError(f"Error generating diagram with Claude: {str(e)}")

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
            response_text = await self._messages_request(
                [{"role": "user", "content": prompt}],
                temperature=0.3,
            )

            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if not json_match:
                raise ValueError("No se pudo extraer JSON de la respuesta de Claude")

            fix_result = json.loads(json_match.group())
            for field in ("corrected_code", "explanation", "changes_summary"):
                if field not in fix_result:
                    raise ValueError(f"Respuesta de Claude no contiene '{field}'")

            fix_result["corrected_code"] = clean_code_response(fix_result["corrected_code"])
            return fix_result

        except httpx.TimeoutException:
            raise ValueError("Claude API request timed out")
        except json.JSONDecodeError as e:
            raise ValueError(f"Error al parsear respuesta JSON de Claude: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error al corregir diagrama con Claude: {str(e)}")

    async def improve_diagram(
        self,
        diagram_code: str,
        improvement_request: str,
        diagram_type: str,
        language: str = "es",
    ) -> str:
        prompt = build_improve_diagram_prompt(diagram_code, improvement_request, diagram_type, language)
        try:
            response = await self._messages_request(
                [{"role": "user", "content": prompt}]
            )
            return clean_code_response(response)
        except httpx.TimeoutException:
            raise ValueError("Claude API request timed out")
        except Exception as e:
            raise ValueError(f"Error improving diagram with Claude: {str(e)}")

    async def chat_with_context(
        self,
        messages: list[dict],
        diagram_code: str,
        diagram_type: str,
        language: str = "es",
    ) -> str:
        system_content = build_chat_system_prompt(diagram_code, diagram_type, language)
        api_messages = [{"role": msg["role"], "content": msg["content"]} for msg in messages]

        try:
            return await self._messages_request(api_messages, system=system_content)
        except httpx.TimeoutException:
            raise ValueError("Claude API request timed out")
        except Exception as e:
            raise ValueError(f"Error in chat with Claude: {str(e)}")

    async def summarize_conversation(
        self, messages: list[dict], language: str = "es"
    ) -> str:
        user_prompt = build_summarize_prompt(messages, language)
        try:
            return await self._messages_request(
                [{"role": "user", "content": user_prompt}],
                system=SUMMARIZE_SYSTEM_PROMPT,
                temperature=0.5,
                max_tokens=1024,
            )
        except httpx.TimeoutException:
            raise ValueError("Claude API request timed out")
        except Exception as e:
            raise ValueError(f"Error summarizing conversation with Claude: {str(e)}")

    @property
    def provider_name(self) -> str:
        return "Anthropic Claude"
