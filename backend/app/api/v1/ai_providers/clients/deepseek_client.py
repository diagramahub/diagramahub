"""
DeepSeek AI client implementation.
"""
import httpx
import json
from typing import Dict, Any, List
from .base import BaseAIClient
from ..prompts import (
    build_description_prompt,
    build_generate_diagram_prompt,
    build_improve_diagram_prompt,
    build_chat_system_prompt,
    build_summarize_prompt,
    clean_code_response,
    SUMMARIZE_SYSTEM_PROMPT,
    get_generate_diagram_system_prompt,
    get_improve_diagram_system_prompt,
)


class DeepSeekClient(BaseAIClient):
    """Client for DeepSeek AI."""

    BASE_URL = "https://api.deepseek.com"

    def __init__(self, api_key: str, model: str = "deepseek-chat", parameters: Dict[str, Any] = None):
        super().__init__(api_key, model, parameters or {})
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def _make_request(
        self,
        messages: List[Dict[str, str]],
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        """Llamada genérica al endpoint chat/completions de DeepSeek."""
        data = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature or self.parameters.get("temperature", 0.7),
            "max_tokens": max_tokens or self.parameters.get("max_output_tokens", 2048),
            "top_p": self.parameters.get("top_p", 1.0),
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{self.BASE_URL}/chat/completions",
                    headers=self.headers,
                    json=data,
                )

                if response.status_code == 429:
                    raise ValueError("Rate limit excedido. Por favor intenta de nuevo en unos momentos.")
                if response.status_code != 200:
                    error_detail = response.text
                    try:
                        error_json = response.json()
                        error_detail = error_json.get("error", {}).get("message", response.text)
                    except Exception:
                        pass
                    raise ValueError(f"DeepSeek API error ({response.status_code}): {error_detail}")

                result = response.json()
                return result["choices"][0]["message"]["content"]

            except httpx.RequestError as e:
                raise ValueError(f"Network error connecting to DeepSeek: {str(e)}")
            except (KeyError, IndexError):
                raise ValueError("DeepSeek returned an unexpected response format")

    async def generate_description(
        self, diagram_code: str, diagram_type: str, language: str = "es"
    ) -> str:
        prompt = build_description_prompt(diagram_code, diagram_type, language)
        try:
            response = await self._make_request([
                {"role": "system", "content": "Eres un experto en análisis de diagramas técnicos."},
                {"role": "user", "content": prompt},
            ])
            return clean_code_response(response)
        except Exception as e:
            raise ValueError(f"Error generating description with DeepSeek: {str(e)}")

    async def validate_api_key(self) -> bool:
        data = {
            "model": self.model,
            "messages": [{"role": "user", "content": "Hi"}],
            "max_tokens": 1,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(
                    f"{self.BASE_URL}/chat/completions",
                    headers=self.headers,
                    json=data,
                )
                return response.status_code == 200
            except Exception:
                return False

    async def generate_diagram(
        self, description: str, diagram_type: str, language: str = "es"
    ) -> str:
        prompt = build_generate_diagram_prompt(description, diagram_type, language)
        try:
            response = await self._make_request([
                {"role": "system", "content": get_generate_diagram_system_prompt(diagram_type)},
                {"role": "user", "content": prompt},
            ])
            return clean_code_response(response)
        except Exception as e:
            raise ValueError(f"Error generating diagram with DeepSeek: {str(e)}")

    async def improve_diagram(
        self,
        diagram_code: str,
        improvement_request: str,
        diagram_type: str,
        language: str = "es",
    ) -> str:
        prompt = build_improve_diagram_prompt(diagram_code, improvement_request, diagram_type, language)
        try:
            response = await self._make_request([
                {"role": "system", "content": get_improve_diagram_system_prompt(diagram_type)},
                {"role": "user", "content": prompt},
            ])
            return clean_code_response(response)
        except Exception as e:
            raise ValueError(f"Error improving diagram with DeepSeek: {str(e)}")

    async def fix_diagram(
        self,
        diagram_code: str,
        diagram_type: str,
        error_context: str | None = None,
        language: str = "es",
    ) -> Dict[str, str]:
        from ...diagrams.fix_prompts import build_fix_prompt
        import re

        prompt = build_fix_prompt(diagram_code, diagram_type, error_context, language)
        try:
            response_text = await self._make_request(
                [
                    {"role": "system", "content": "You are an expert in fixing syntax errors in technical diagrams. Provide accurate corrections with clear explanations."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
            )

            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if not json_match:
                raise ValueError("No se pudo extraer JSON de la respuesta de DeepSeek")

            fix_result = json.loads(json_match.group())
            for field in ("corrected_code", "explanation", "changes_summary"):
                if field not in fix_result:
                    raise ValueError(f"Respuesta de DeepSeek no contiene '{field}'")

            fix_result["corrected_code"] = clean_code_response(fix_result["corrected_code"])
            return fix_result

        except json.JSONDecodeError as e:
            raise ValueError(f"Error al parsear respuesta JSON de DeepSeek: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error al corregir diagrama con DeepSeek: {str(e)}")

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
            return await self._make_request(api_messages)
        except Exception as e:
            raise ValueError(f"Error in chat with DeepSeek: {str(e)}")

    async def summarize_conversation(
        self, messages: list[dict], language: str = "es"
    ) -> str:
        user_prompt = build_summarize_prompt(messages, language)
        try:
            return await self._make_request(
                [
                    {"role": "system", "content": SUMMARIZE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.5,
                max_tokens=1024,
            )
        except Exception as e:
            raise ValueError(f"Error summarizing conversation with DeepSeek: {str(e)}")

    @property
    def provider_name(self) -> str:
        return "DeepSeek AI"
