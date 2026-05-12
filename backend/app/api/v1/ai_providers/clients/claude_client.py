"""
Anthropic Claude client implementation.
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
            "max_tokens": max_tokens or self.parameters.get("max_tokens", 4096),
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
        from ..prompts import extract_fix_json, extract_fix_delimited, clean_code_response

        prompt = build_fix_prompt(diagram_code, diagram_type, error_context, language)
        try:
            is_dbml = diagram_type.lower() == "dbml"
            system_msg = (
                "You are an expert in fixing syntax errors in DBML diagrams. "
                "Respond using the exact delimiter format requested."
            ) if is_dbml else (
                "You are an expert in fixing syntax errors in technical diagrams. "
                "Always respond with valid JSON only, no markdown fences or extra text."
            )

            response_text = await self._messages_request(
                [{"role": "user", "content": prompt}],
                system=system_msg,
                temperature=0.3,
            )

            if is_dbml:
                fix_result = extract_fix_delimited(response_text, "Claude")
            else:
                fix_result = extract_fix_json(response_text, "Claude")
                fix_result["corrected_code"] = clean_code_response(fix_result["corrected_code"])
            return fix_result

        except httpx.TimeoutException:
            raise ValueError("Claude API request timed out")
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

    async def chat_with_context_stream(
        self,
        messages: list[dict],
        diagram_code: str,
        diagram_type: str,
        language: str = "es",
    ) -> AsyncGenerator[str, None]:
        """Stream chat response token by token using Anthropic streaming API.

        Claude uses a different SSE event format than OpenAI:
        - ``content_block_delta`` events contain text chunks
        - ``message_stop`` signals completion
        - ``error`` events signal failures

        Args:
            messages: Conversation history
            diagram_code: Current diagram code
            diagram_type: Diagram type (mermaid, plantuml, etc.)
            language: Response language (es, en)

        Yields:
            String chunks as they arrive from Claude

        Raises:
            ValueError: If streaming fails or times out
        """
        system_content = build_chat_system_prompt(diagram_code, diagram_type, language)
        api_messages = [{"role": msg["role"], "content": msg["content"]} for msg in messages]

        payload: dict = {
            "model": self.model,
            "max_tokens": self.parameters.get("max_tokens", 4096),
            "temperature": self.parameters.get("temperature", 0.7),
            "system": system_content,
            "messages": api_messages,
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(120.0, connect=10.0)
            ) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/messages",
                    headers=self.headers,
                    json=payload,
                ) as response:
                    if response.status_code == 429:
                        raise ValueError(
                            "Rate limit excedido. Por favor intenta de nuevo en unos momentos."
                        )
                    if response.status_code != 200:
                        raise ValueError(
                            f"Claude API error: {response.status_code}"
                        )

                    last_token_time = time.time()
                    async for line in response.aiter_lines():
                        if time.time() - last_token_time > 60:
                            raise ValueError(
                                f"{self.provider_name} stream timeout: "
                                "no token received in 60s"
                            )

                        if not line.startswith("data: "):
                            continue

                        try:
                            event_data = json.loads(line[6:])
                        except json.JSONDecodeError:
                            continue

                        event_type = event_data.get("type")

                        if event_type == "content_block_delta":
                            text = event_data.get("delta", {}).get("text", "")
                            if text:
                                last_token_time = time.time()
                                yield text
                        elif event_type == "message_stop":
                            return
                        elif event_type == "error":
                            error_msg = event_data.get("error", {}).get(
                                "message", "Unknown Claude stream error"
                            )
                            raise ValueError(
                                f"Claude stream error: {error_msg}"
                            )

        except httpx.TimeoutException:
            raise ValueError(f"{self.provider_name} API streaming request timed out")
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(
                f"Error in streaming chat with {self.provider_name}: {str(e)}"
            )

    @property
    def provider_name(self) -> str:
        return "Anthropic Claude"
