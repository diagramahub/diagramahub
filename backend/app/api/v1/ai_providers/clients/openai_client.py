"""
OpenAI GPT client implementation.
"""
import json
import time

import httpx
from typing import AsyncGenerator, Dict, Any

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

    def __init__(self, api_key: str, model: str = "gpt-4.1-mini", parameters: Dict[str, Any] = None):
        super().__init__(api_key, model, parameters or {})
        self.base_url = "https://api.openai.com/v1"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def _chat_completion(self, messages: list[dict], response_format: dict | None = None) -> str:
        """Llamada genérica al endpoint chat/completions de OpenAI."""
        payload: dict = {
            "model": self.model,
            "messages": messages,
            "max_completion_tokens": self.parameters.get("max_tokens", 4096),
        }
        if response_format:
            payload["response_format"] = response_format

        async with httpx.AsyncClient(timeout=60.0) as client:
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
        from ..prompts import extract_fix_json, extract_fix_delimited, clean_code_response

        prompt = build_fix_prompt(diagram_code, diagram_type, error_context, language)
        try:
            is_dbml = diagram_type.lower() == "dbml"
            system_msg = (
                "You are an expert in fixing syntax errors in DBML diagrams. "
                "Respond using the exact delimiter format requested."
            ) if is_dbml else (
                "You are an expert in fixing syntax errors in technical diagrams. "
                "Always respond with a single valid JSON object containing exactly "
                "three keys: corrected_code, explanation, changes_summary. "
                "No markdown fences, no extra text."
            )

            response_text = await self._chat_completion(
                [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": prompt},
                ],
                response_format=None if is_dbml else {"type": "json_object"},
            )

            if is_dbml:
                fix_result = extract_fix_delimited(response_text, "OpenAI")
            else:
                fix_result = extract_fix_json(response_text, "OpenAI")
                fix_result["corrected_code"] = clean_code_response(fix_result["corrected_code"])
            return fix_result

        except httpx.TimeoutException:
            raise ValueError("OpenAI API request timed out")
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
            cleaned = clean_code_response(response)
            if not cleaned:
                raise ValueError(
                    f"El modelo {self.model} no devolvió código de diagrama. "
                    "Si querías solo una explicación, usa la acción 'Explicar' del chat. "
                    "Si querías mejorar el diagrama, prueba con un modelo más capaz."
                )
            return cleaned
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
            )
        except httpx.TimeoutException:
            raise ValueError("OpenAI API request timed out")
        except Exception as e:
            raise ValueError(f"Error summarizing conversation with OpenAI: {str(e)}")

    async def chat_with_context_stream(
        self,
        messages: list[dict],
        diagram_code: str,
        diagram_type: str,
        language: str = "es",
    ) -> AsyncGenerator[str, None]:
        """Stream chat response token by token using OpenAI streaming API.

        Args:
            messages: Conversation history
            diagram_code: Current diagram code
            diagram_type: Diagram type (mermaid, plantuml, etc.)
            language: Response language (es, en)

        Yields:
            String chunks as they arrive from OpenAI

        Raises:
            ValueError: If streaming fails or times out
        """
        system_content = build_chat_system_prompt(diagram_code, diagram_type, language)
        api_messages = [{"role": "system", "content": system_content}]
        for msg in messages:
            api_messages.append({"role": msg["role"], "content": msg["content"]})

        payload = {
            "model": self.model,
            "messages": api_messages,
            "max_completion_tokens": self.parameters.get("max_tokens", 4096),
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(120.0, connect=10.0)
            ) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=payload,
                ) as response:
                    if response.status_code == 429:
                        raise ValueError(
                            "Rate limit excedido. Por favor intenta de nuevo en unos momentos."
                        )
                    if response.status_code != 200:
                        raise ValueError(
                            f"OpenAI API error: {response.status_code}"
                        )

                    last_token_time = time.time()
                    async for line in response.aiter_lines():
                        if time.time() - last_token_time > 60:
                            raise ValueError(
                                f"{self.provider_name} stream timeout: no token received in 60s"
                            )

                        if not line.startswith("data: "):
                            continue
                        data = line[6:]
                        if data == "[DONE]":
                            return

                        try:
                            chunk = json.loads(data)
                        except json.JSONDecodeError:
                            continue

                        choices = chunk.get("choices", [])
                        if not choices:
                            continue

                        delta = choices[0].get("delta", {})
                        content = delta.get("content")
                        if content:
                            last_token_time = time.time()
                            yield content

        except httpx.TimeoutException:
            raise ValueError(f"{self.provider_name} API streaming request timed out")
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f"Error in streaming chat with {self.provider_name}: {str(e)}")

    @property
    def provider_name(self) -> str:
        return "OpenAI GPT"
