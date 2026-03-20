"""
OpenAI GPT client implementation.
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
    DESCRIPTION_SYSTEM_PROMPT,
    SUMMARIZE_SYSTEM_PROMPT,
    get_generate_diagram_system_prompt,
    get_improve_diagram_system_prompt,
)


class OpenAIClient(BaseAIClient):
    """Client for OpenAI GPT."""

    def __init__(self, api_key: str, model: str = "gpt-4o-mini", parameters: Dict[str, Any] = None):
        super().__init__(api_key, model, parameters or {})
        self.base_url = "https://api.openai.com/v1"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def _chat_completion(
        self,
        messages: list[dict],
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        """Llamada genérica al endpoint chat/completions de OpenAI."""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature or self.parameters.get("temperature", 0.7),
            "max_tokens": max_tokens or self.parameters.get("max_tokens", 2048),
            "top_p": self.parameters.get("top_p", 1.0),
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
            )

            if response.status_code == 429:
                raise ValueError("Rate limit excedido. Por favor intenta de nuevo en unos momentos.")
            if response.status_code != 200:
                raise ValueError(f"OpenAI API error: {response.status_code} - {response.text}")

            result = response.json()
            if not result.get("choices") or len(result["choices"]) == 0:
                raise ValueError("OpenAI returned empty response")

            return result["choices"][0]["message"]["content"].strip()

    async def generate_description(
        self, diagram_code: str, diagram_type: str, language: str = "es"
    ) -> str:
        prompt = build_description_prompt(diagram_code, diagram_type, language)
        try:
            response = await self._chat_completion([
                {"role": "system", "content": DESCRIPTION_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ])
            return clean_code_response(response)
        except httpx.TimeoutException:
            raise ValueError("OpenAI API request timed out")
        except Exception as e:
            raise ValueError(f"Error generating description with OpenAI: {str(e)}")

    async def validate_api_key(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers=self.headers,
                )
                return response.status_code == 200
        except Exception as e:
            print(f"OpenAI API key validation failed: {str(e)}")
            return False

    async def generate_diagram(
        self, description: str, diagram_type: str, language: str = "es"
    ) -> str:
        prompt = build_generate_diagram_prompt(description, diagram_type, language)
        try:
            response = await self._chat_completion([
                {"role": "system", "content": get_generate_diagram_system_prompt(diagram_type)},
                {"role": "user", "content": prompt},
            ])
            return clean_code_response(response)
        except httpx.TimeoutException:
            raise ValueError("OpenAI API request timed out")
        except Exception as e:
            raise ValueError(f"Error generating diagram with OpenAI: {str(e)}")

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
            response_text = await self._chat_completion(
                [
                    {"role": "system", "content": "You are an expert in fixing syntax errors in technical diagrams. Provide accurate corrections with clear explanations."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
            )

            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if not json_match:
                raise ValueError("No se pudo extraer JSON de la respuesta de OpenAI")

            fix_result = json.loads(json_match.group())
            for field in ("corrected_code", "explanation", "changes_summary"):
                if field not in fix_result:
                    raise ValueError(f"Respuesta de OpenAI no contiene '{field}'")

            fix_result["corrected_code"] = clean_code_response(fix_result["corrected_code"])
            return fix_result

        except httpx.TimeoutException:
            raise ValueError("OpenAI API request timed out")
        except json.JSONDecodeError as e:
            raise ValueError(f"Error al parsear respuesta JSON de OpenAI: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error al corregir diagrama con OpenAI: {str(e)}")

    async def improve_diagram(
        self,
        diagram_code: str,
        improvement_request: str,
        diagram_type: str,
        language: str = "es",
    ) -> str:
        prompt = build_improve_diagram_prompt(diagram_code, improvement_request, diagram_type, language)
        try:
            response = await self._chat_completion([
                {"role": "system", "content": get_improve_diagram_system_prompt(diagram_type)},
                {"role": "user", "content": prompt},
            ])
            return clean_code_response(response)
        except httpx.TimeoutException:
            raise ValueError("OpenAI API request timed out")
        except Exception as e:
            raise ValueError(f"Error improving diagram with OpenAI: {str(e)}")

    async def chat_with_context(
        self,
        messages: list[dict],
        diagram_code: str,
        diagram_type: str,
        language: str = "es",
    ) -> str:
        system_content = build_chat_system_prompt(diagram_code, diagram_type, language)
        api_messages = [{"role": "system", "content": system_content}]
        for msg in messages:
            api_messages.append({"role": msg["role"], "content": msg["content"]})

        try:
            return await self._chat_completion(api_messages)
        except httpx.TimeoutException:
            raise ValueError("OpenAI API request timed out")
        except Exception as e:
            raise ValueError(f"Error in chat with OpenAI: {str(e)}")

    async def summarize_conversation(
        self, messages: list[dict], language: str = "es"
    ) -> str:
        user_prompt = build_summarize_prompt(messages, language)
        try:
            return await self._chat_completion(
                [
                    {"role": "system", "content": SUMMARIZE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.5,
                max_tokens=1024,
            )
        except httpx.TimeoutException:
            raise ValueError("OpenAI API request timed out")
        except Exception as e:
            raise ValueError(f"Error summarizing conversation with OpenAI: {str(e)}")

    @property
    def provider_name(self) -> str:
        return "OpenAI GPT"
