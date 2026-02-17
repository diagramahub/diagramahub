"""
DeepSeek AI client implementation.
"""
import httpx
import json
from typing import Dict, Any, List
from .base import BaseAIClient


class DeepSeekClient(BaseAIClient):
    """Client for DeepSeek AI."""

    BASE_URL = "https://api.deepseek.com"

    def __init__(self, api_key: str, model: str = "deepseek-chat", parameters: Dict[str, Any] = None):
        """
        Initialize DeepSeek client.

        Args:
            api_key: DeepSeek API key
            model: DeepSeek model to use (default: deepseek-chat)
            parameters: Generation parameters
        """
        super().__init__(api_key, model, parameters or {})
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def _make_request(self, messages: List[Dict[str, str]]) -> str:
        """
        Make request to DeepSeek API.
        """
        data = {
            "model": self.model,
            "messages": messages,
            "temperature": self.parameters.get("temperature", 0.7),
            "max_tokens": self.parameters.get("max_output_tokens", 2048),
            "top_p": self.parameters.get("top_p", 1.0),
            "stream": False
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{self.BASE_URL}/chat/completions",
                    headers=self.headers,
                    json=data
                )
                
                if response.status_code != 200:
                    error_detail = response.text
                    try:
                        error_json = response.json()
                        error_detail = error_json.get("error", {}).get("message", response.text)
                    except:
                        pass
                    raise ValueError(f"DeepSeek API error ({response.status_code}): {error_detail}")

                result = response.json()
                return result["choices"][0]["message"]["content"]

            except httpx.RequestError as e:
                raise ValueError(f"Network error connecting to DeepSeek: {str(e)}")
            except (KeyError, IndexError):
                raise ValueError("DeepSeek returned an unexpected response format")

    async def generate_description(
        self,
        diagram_code: str,
        diagram_type: str,
        language: str = "es"
    ) -> str:
        """
        Generate diagram description using DeepSeek.
        """
        prompt = self._build_prompt(diagram_code, diagram_type, language)
        messages = [
            {"role": "system", "content": "Eres un experto en análisis de diagramas técnicos."},
            {"role": "user", "content": prompt}
        ]

        try:
            description = await self._make_request(messages)
            return self._clean_response(description)
        except Exception as e:
            raise ValueError(f"Error generating description with DeepSeek: {str(e)}")

    async def validate_api_key(self) -> bool:
        """
        Validate DeepSeek API key by attempting a small request.
        """
        messages = [
            {"role": "user", "content": "Hi"}
        ]
        data = {
            "model": self.model,
            "messages": messages,
            "max_tokens": 1
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(
                    f"{self.BASE_URL}/chat/completions",
                    headers=self.headers,
                    json=data
                )
                return response.status_code == 200
            except:
                return False

    async def generate_diagram(
        self,
        description: str,
        diagram_type: str,
        language: str = "es"
    ) -> str:
        """
        Generate diagram code from a description.
        """
        context = self._get_context(diagram_type, language)
        system_prompt = f"Eres un experto en crear diagramas {diagram_type}. Tu especialidad es crear diagramas claros, simples y funcionales."
        
        user_prompt = f"""
{context}

DESCRIPCIÓN DEL USUARIO:
{description}

INSTRUCCIONES CRÍTICAS:
1. Crea un diagrama SIMPLE y FUNCIONAL que capture los aspectos esenciales de la descripción.
2. Genera SOLO el código del diagrama, sin texto adicional.
3. NO incluyas markdown code blocks (```).
4. El código debe ser 100% válido y renderizable.
5. Usa nombres descriptivos en {language}.
6. PROHIBIDO usar estilos CSS o decoraciones innecesarias.
"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        try:
            diagram_code = await self._make_request(messages)
            return self._clean_response(diagram_code)
        except Exception as e:
            raise ValueError(f"Error generating diagram with DeepSeek: {str(e)}")

    async def improve_diagram(
        self,
        diagram_code: str,
        improvement_request: str,
        diagram_type: str,
        language: str = "es"
    ) -> str:
        """
        Improve an existing diagram based on user's request.
        """
        context = self._get_context(diagram_type, language)
        system_prompt = f"Eres un experto en diagramas {diagram_type}. Tu especialidad es mejorar diagramas existentes manteniendo la simplicidad y funcionalidad."

        user_prompt = f"""
{context}

DIAGRAMA ACTUAL:
```
{diagram_code}
```

SOLICITUD DE MEJORA DEL USUARIO:
{improvement_request}

INSTRUCCIONES CRÍTICAS:
1. Mejora el diagrama según la solicitud.
2. Mantén la estructura básica si es posible.
3. Genera SOLO el código mejorado, sin texto adicional.
4. NO incluyas markdown code blocks (```).
"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        try:
            improved_code = await self._make_request(messages)
            return self._clean_response(improved_code)
        except Exception as e:
            raise ValueError(f"Error improving diagram with DeepSeek: {str(e)}")

    def _clean_response(self, text: str) -> str:
        """Clean response from AI (remove markers)."""
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()
        return text

    def _get_context(self, diagram_type: str, language: str) -> str:
        """Helper to get context (could reuse Gemini implementation if refactored)."""
        # For now, providing a simplified version or I could import from a shared helper
        # But for this task, I'll keep it simple or copy key parts.
        if diagram_type == "mermaid":
            return "Usa sintaxis Mermaid válida. Comienza con el tipo de diagrama (e.g., flowchart TD)."
        else:
            return "Usa sintaxis PlantUML válida. Comienza con @startuml y termina con @enduml."

    @property
    def provider_name(self) -> str:
        """Provider name."""
        return "DeepSeek AI"
