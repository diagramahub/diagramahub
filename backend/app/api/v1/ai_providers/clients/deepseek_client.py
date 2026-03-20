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

    async def fix_diagram(
        self,
        diagram_code: str,
        diagram_type: str,
        error_context: str | None = None,
        language: str = "es"
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
        # Import fix prompts module
        from ...diagrams.fix_prompts import build_mermaid_fix_prompt, build_plantuml_fix_prompt
        
        # Build specialized prompt based on diagram type
        if diagram_type.lower() in ['plantuml', 'uml']:
            prompt = build_plantuml_fix_prompt(diagram_code, error_context, language)
        else:
            prompt = build_mermaid_fix_prompt(diagram_code, error_context, language)
        
        messages = [
            {
                "role": "system",
                "content": "You are an expert in fixing syntax errors in technical diagrams. Provide accurate corrections with clear explanations."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        # Prepare request payload
        data = {
            "model": self.model,
            "messages": messages,
            "temperature": self.parameters.get("temperature", 0.3),  # Lower temperature for more deterministic fixes
            "max_tokens": self.parameters.get("max_output_tokens", 2048),
            "top_p": self.parameters.get("top_p", 1.0),
            "stream": False
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/chat/completions",
                    headers=self.headers,
                    json=data
                )
                
                if response.status_code == 429:
                    raise ValueError("Rate limit excedido. Por favor intenta de nuevo en unos momentos.")
                
                if response.status_code != 200:
                    error_detail = response.text
                    try:
                        error_json = response.json()
                        error_detail = error_json.get("error", {}).get("message", response.text)
                    except:
                        pass
                    raise ValueError(f"DeepSeek API error ({response.status_code}): {error_detail}")
                
                result = response.json()
                response_text = result["choices"][0]["message"]["content"].strip()
                
                # Parse JSON response
                import re
                
                # Try to extract JSON from response
                json_match = re.search(r'\{[\s\S]*\}', response_text)
                if not json_match:
                    raise ValueError("No se pudo extraer JSON de la respuesta de DeepSeek")
                
                fix_result = json.loads(json_match.group())
                
                # Validate required fields
                if "corrected_code" not in fix_result:
                    raise ValueError("Respuesta de DeepSeek no contiene 'corrected_code'")
                if "explanation" not in fix_result:
                    raise ValueError("Respuesta de DeepSeek no contiene 'explanation'")
                if "changes_summary" not in fix_result:
                    raise ValueError("Respuesta de DeepSeek no contiene 'changes_summary'")
                
                # Clean corrected code (remove markdown blocks if present)
                corrected_code = fix_result["corrected_code"].strip()
                if corrected_code.startswith("```"):
                    lines = corrected_code.split("\n")
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].startswith("```"):
                        lines = lines[:-1]
                    corrected_code = "\n".join(lines).strip()
                
                fix_result["corrected_code"] = corrected_code
                
                return fix_result
                
        except httpx.RequestError as e:
            raise ValueError(f"Network error connecting to DeepSeek: {str(e)}")
        except json.JSONDecodeError as e:
            raise ValueError(f"Error al parsear respuesta JSON de DeepSeek: {str(e)}")
        except (KeyError, IndexError):
            raise ValueError("DeepSeek returned an unexpected response format")
        except Exception as e:
            raise ValueError(f"Error al corregir diagrama con DeepSeek: {str(e)}")

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

    async def chat_with_context(
        self,
        messages: list[dict],
        diagram_code: str,
        diagram_type: str,
        language: str = "es"
    ) -> str:
        """
        Conversación con contexto de historial y diagrama usando DeepSeek.
        """
        if language == "es":
            system_content = f"""Eres un asistente experto en diagramas {diagram_type}. El usuario está trabajando en el siguiente diagrama y quiere conversar sobre él.

DIAGRAMA ACTUAL:
```
{diagram_code}
```

Responde de forma clara y útil en español. No modifiques el diagrama a menos que se te pida explícitamente."""
        else:
            system_content = f"""You are an expert assistant in {diagram_type} diagrams. The user is working on the following diagram and wants to discuss it.

CURRENT DIAGRAM:
```
{diagram_code}
```

Respond clearly and helpfully in English. Do not modify the diagram unless explicitly asked."""

        api_messages = [{"role": "system", "content": system_content}]
        for msg in messages:
            api_messages.append({"role": msg["role"], "content": msg["content"]})

        try:
            return await self._make_request(api_messages)
        except Exception as e:
            raise ValueError(f"Error in chat with DeepSeek: {str(e)}")

    async def summarize_conversation(
        self,
        messages: list[dict],
        language: str = "es"
    ) -> str:
        """
        Genera un resumen compacto de una conversación usando DeepSeek.
        """
        conversation_text = "\n".join(
            f"{'Usuario' if m['role'] == 'user' else 'Asistente'}: {m['content']}"
            if language == "es"
            else f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
            for m in messages
        )

        if language == "es":
            user_prompt = f"""Resume la siguiente conversación de forma compacta, capturando los puntos clave, decisiones tomadas y contexto importante. El resumen será usado como contexto inicial para continuar la conversación en una nueva sesión.

CONVERSACIÓN:
{conversation_text}

RESUMEN COMPACTO:"""
        else:
            user_prompt = f"""Summarize the following conversation compactly, capturing key points, decisions made, and important context. The summary will be used as initial context to continue the conversation in a new session.

CONVERSATION:
{conversation_text}

COMPACT SUMMARY:"""

        api_messages = [
            {"role": "system", "content": "You are a helpful assistant that creates concise conversation summaries."},
            {"role": "user", "content": user_prompt}
        ]

        try:
            return await self._make_request(api_messages)
        except Exception as e:
            raise ValueError(f"Error summarizing conversation with DeepSeek: {str(e)}")

    @property
    def provider_name(self) -> str:
        """Provider name."""
        return "DeepSeek AI"
