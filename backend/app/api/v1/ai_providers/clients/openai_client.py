"""
OpenAI GPT client implementation.
"""
import httpx
from typing import Dict, Any
from .base import BaseAIClient


class OpenAIClient(BaseAIClient):
    """Client for OpenAI GPT."""

    def __init__(self, api_key: str, model: str = "gpt-4o-mini", parameters: Dict[str, Any] = None):
        """
        Initialize OpenAI client.

        Args:
            api_key: OpenAI API key
            model: GPT model to use
            parameters: Generation parameters
        """
        super().__init__(api_key, model, parameters or {})
        self.base_url = "https://api.openai.com/v1"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def generate_description(
        self,
        diagram_code: str,
        diagram_type: str,
        language: str = "es"
    ) -> str:
        """
        Generate diagram description using OpenAI GPT.

        Args:
            diagram_code: Diagram source code
            diagram_type: Type of diagram
            language: Target language (es, en)

        Returns:
            Generated description

        Raises:
            ValueError: If generation fails
        """
        # Build optimized prompt
        prompt = self._build_prompt(diagram_code, diagram_type, language)

        # Prepare request payload
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert in analyzing and describing technical diagrams. Provide clear, concise, and professional descriptions."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": self.parameters.get("temperature", 0.7),
            "max_tokens": self.parameters.get("max_tokens", 2048),
            "top_p": self.parameters.get("top_p", 1.0)
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=payload
                )
                
                if response.status_code != 200:
                    raise ValueError(f"OpenAI API error: {response.status_code} - {response.text}")
                
                result = response.json()
                
                if not result.get("choices") or len(result["choices"]) == 0:
                    raise ValueError("OpenAI returned empty response")
                
                description = result["choices"][0]["message"]["content"].strip()
                
                # Clean response: remove markdown code blocks if present
                if description.startswith("```markdown"):
                    description = description[len("```markdown"):].strip()
                elif description.startswith("```"):
                    description = description[3:].strip()

                if description.endswith("```"):
                    description = description[:-3].strip()

                return description

        except httpx.TimeoutException:
            raise ValueError("OpenAI API request timed out")
        except Exception as e:
            raise ValueError(f"Error generating description with OpenAI: {str(e)}")

    async def validate_api_key(self) -> bool:
        """
        Validate OpenAI API key.

        Returns:
            True if valid, False otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers=self.headers
                )
                
                return response.status_code == 200

        except Exception as e:
            print(f"OpenAI API key validation failed: {str(e)}")
            return False

    async def generate_diagram(
        self,
        description: str,
        diagram_type: str,
        language: str = "es"
    ) -> str:
        """
        Generate diagram code from a description.

        Args:
            description: User's description of what they want to diagram
            diagram_type: Type of diagram (mermaid, plantuml)
            language: User's language (es, en)

        Returns:
            Generated diagram code

        Raises:
            ValueError: If generation fails
        """
        # Build context-specific prompt
        if diagram_type == "mermaid":
            context = self._get_mermaid_context(language)
        else:
            context = self._get_plantuml_context(language)

        # Build prompt for diagram generation
        if language == "es":
            visual_instructions = """3. Usa sintaxis SIMPLE y CLARA:
   - EVITA diseños complejos, colores excesivos y decoraciones innecesarias
   - NO uses elementos visuales que no aporten valor (skinparams, estilos personalizados, etc.)
   - Prioriza CLARIDAD y LEGIBILIDAD sobre estética
   - Usa solo la sintaxis básica necesaria para representar la información
   - El diagrama debe ser FUNCIONAL, no decorativo"""

            prompt = f"""Eres un experto en crear diagramas {diagram_type}. Tu especialidad es crear diagramas claros, simples y funcionales.

{context}

DESCRIPCIÓN DEL USUARIO:
{description}

INSTRUCCIONES CRÍTICAS:
1. Crea un diagrama SIMPLE y FUNCIONAL que capture los aspectos esenciales de la descripción
2. Usa una estructura BÁSICA sin elementos decorativos innecesarios
{visual_instructions}
4. El diagrama debe ser COMPLETO pero MINIMALISTA, enfocándose en la información relevante
5. Genera SOLO el código del diagrama, sin texto adicional
6. NO incluyas markdown code blocks (```)
7. El código debe ser 100% válido y renderizable
8. Usa nombres descriptivos en español
9. Organiza el código de forma legible con indentación apropiada
10. NO agregues colores, estilos, íconos o elementos visuales que no sean estrictamente necesarios
11. PROHIBIDO usar: classDef, style, class, cssClass, fill, stroke, o cualquier definición de estilos CSS
12. Usa SOLO la sintaxis básica estándar sin personalizaciones visuales

GENERA EL CÓDIGO DEL DIAGRAMA:"""
        else:
            visual_instructions = """3. Use SIMPLE and CLEAR syntax:
   - AVOID complex designs, excessive colors, and unnecessary decorations
   - DO NOT use visual elements that don't add value (skinparams, custom styles, etc.)
   - Prioritize CLARITY and READABILITY over aesthetics
   - Use only basic syntax necessary to represent the information
   - The diagram should be FUNCTIONAL, not decorative"""

            prompt = f"""You are an expert in creating {diagram_type} diagrams. Your specialty is creating clear, simple, and functional diagrams.

{context}

USER DESCRIPTION:
{description}

CRITICAL INSTRUCTIONS:
1. Create a SIMPLE and FUNCTIONAL diagram that captures the essential aspects of the description
2. Use a BASIC structure without unnecessary decorative elements
{visual_instructions}
4. The diagram must be COMPLETE but MINIMALIST, focusing on relevant information
5. Generate ONLY the diagram code, no additional text
6. DO NOT include markdown code blocks (```)
7. The code must be 100% valid and renderable
8. Use descriptive names in English
9. Organize the code in a readable format with proper indentation
10. DO NOT add colors, styles, icons, or visual elements that are not strictly necessary
11. FORBIDDEN to use: classDef, style, class, cssClass, fill, stroke, or any CSS style definitions
12. Use ONLY basic standard syntax without visual customizations

GENERATE THE DIAGRAM CODE:"""

        # Prepare request payload
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": f"You are an expert in creating {diagram_type} diagrams. Generate clean, simple, and functional diagram code."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": self.parameters.get("temperature", 0.7),
            "max_tokens": self.parameters.get("max_tokens", 2048),
            "top_p": self.parameters.get("top_p", 1.0)
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=payload
                )
                
                if response.status_code != 200:
                    raise ValueError(f"OpenAI API error: {response.status_code} - {response.text}")
                
                result = response.json()
                
                if not result.get("choices") or len(result["choices"]) == 0:
                    raise ValueError("OpenAI returned empty response")
                
                diagram_code = result["choices"][0]["message"]["content"].strip()
                
                # Remove markdown code blocks if present
                if diagram_code.startswith("```"):
                    lines = diagram_code.split("\n")
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].startswith("```"):
                        lines = lines[:-1]
                    diagram_code = "\n".join(lines).strip()

                return diagram_code

        except httpx.TimeoutException:
            raise ValueError("OpenAI API request timed out")
        except Exception as e:
            raise ValueError(f"Error generating diagram with OpenAI: {str(e)}")

    async def improve_diagram(
        self,
        diagram_code: str,
        improvement_request: str,
        diagram_type: str,
        language: str = "es"
    ) -> str:
        """
        Improve an existing diagram based on user's request.

        Args:
            diagram_code: Current diagram code
            improvement_request: User's improvement request
            diagram_type: Type of diagram (mermaid, plantuml)
            language: User's language (es, en)

        Returns:
            Improved diagram code

        Raises:
            ValueError: If improvement fails
        """
        # Build context-specific prompt
        if diagram_type == "mermaid":
            context = self._get_mermaid_context(language)
        else:
            context = self._get_plantuml_context(language)

        # Build prompt for diagram improvement
        if language == "es":
            visual_instructions = """6. Aplica mejoras SIMPLES y FUNCIONALES:
   - EVITA agregar diseños complejos, colores o decoraciones innecesarias
   - NO agregues elementos visuales que no aporten valor funcional
   - Prioriza CLARIDAD y LEGIBILIDAD sobre estética
   - Mantén la sintaxis SIMPLE y básica
   - Solo agrega elementos visuales si el usuario EXPLÍCITAMENTE lo solicita"""

            prompt = f"""Eres un experto en diagramas {diagram_type}. Tu especialidad es mejorar diagramas existentes manteniendo la simplicidad y funcionalidad.

{context}

DIAGRAMA ACTUAL:
```
{diagram_code}
```

SOLICITUD DE MEJORA DEL USUARIO:
{improvement_request}

INSTRUCCIONES CRÍTICAS PARA LA MEJORA:
1. PRESERVA la estructura y lógica fundamental del diagrama original
2. Aplica ÚNICAMENTE las mejoras solicitadas por el usuario, sin agregar elementos extras
3. Si el usuario NO menciona elementos visuales (colores, estilos, formas), NO los agregues
4. Si el usuario pide más detalle, EXPANDE el diagrama con información relevante de forma SIMPLE
5. Si el usuario pide simplificación, CONSOLIDA elementos manteniendo la claridad
{visual_instructions}
7. El diagrama mejorado debe ser MEJOR pero MANTENER LA SIMPLICIDAD
8. Genera SOLO el código del diagrama mejorado, sin texto adicional
9. NO incluyas markdown code blocks (```)
10. El código debe ser 100% válido y renderizable
11. Mantén la coherencia del idioma (español/inglés) del diagrama original
12. Usa indentación apropiada para código legible
13. NO agregues colores, estilos o decoraciones a menos que el usuario ESPECÍFICAMENTE lo pida
14. PROHIBIDO usar: classDef, style, class, cssClass, fill, stroke, o cualquier definición de estilos CSS
15. ELIMINA cualquier classDef o style que exista en el diagrama original, a menos que el usuario pida conservarlos

GENERA EL CÓDIGO DEL DIAGRAMA MEJORADO:"""
        else:
            visual_instructions = """6. Apply SIMPLE and FUNCTIONAL improvements:
   - AVOID adding complex designs, colors, or unnecessary decorations
   - DO NOT add visual elements that don't provide functional value
   - Prioritize CLARITY and READABILITY over aesthetics
   - Keep syntax SIMPLE and basic
   - Only add visual elements if the user EXPLICITLY requests them"""

            prompt = f"""You are an expert in {diagram_type} diagrams. Your specialty is improving existing diagrams while maintaining simplicity and functionality.

{context}

CURRENT DIAGRAM:
```
{diagram_code}
```

USER'S IMPROVEMENT REQUEST:
{improvement_request}

CRITICAL INSTRUCTIONS FOR IMPROVEMENT:
1. PRESERVE the fundamental structure and logic of the original diagram
2. Apply ONLY the improvements requested by the user, without adding extra elements
3. If the user does NOT mention visual elements (colors, styles, shapes), DO NOT add them
4. If user requests more detail, EXPAND the diagram with relevant information in a SIMPLE way
5. If user requests simplification, CONSOLIDATE elements while maintaining clarity
{visual_instructions}
7. The improved diagram must be BETTER but MAINTAIN SIMPLICITY
8. Generate ONLY the improved diagram code, no additional text
9. DO NOT include markdown code blocks (```)
10. The code must be 100% valid and renderable
11. Maintain language consistency (Spanish/English) from the original diagram
12. Use proper indentation for readable code
13. DO NOT add colors, styles, or decorations unless the user SPECIFICALLY requests them
14. FORBIDDEN to use: classDef, style, class, cssClass, fill, stroke, or any CSS style definitions
15. REMOVE any classDef or style that exists in the original diagram, unless the user asks to keep them

GENERATE THE IMPROVED DIAGRAM CODE:"""

        # Prepare request payload
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": f"You are an expert in improving {diagram_type} diagrams. Maintain simplicity while applying requested improvements."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": self.parameters.get("temperature", 0.7),
            "max_tokens": self.parameters.get("max_tokens", 2048),
            "top_p": self.parameters.get("top_p", 1.0)
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=payload
                )
                
                if response.status_code != 200:
                    raise ValueError(f"OpenAI API error: {response.status_code} - {response.text}")
                
                result = response.json()
                
                if not result.get("choices") or len(result["choices"]) == 0:
                    raise ValueError("OpenAI returned empty response")
                
                improved_code = result["choices"][0]["message"]["content"].strip()
                
                # Remove markdown code blocks if present
                if improved_code.startswith("```"):
                    lines = improved_code.split("\n")
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].startswith("```"):
                        lines = lines[:-1]
                    improved_code = "\n".join(lines).strip()

                return improved_code

        except httpx.TimeoutException:
            raise ValueError("OpenAI API request timed out")
        except Exception as e:
            raise ValueError(f"Error improving diagram with OpenAI: {str(e)}")

    def _get_mermaid_context(self, language: str) -> str:
        """Get Mermaid-specific context and best practices."""
        if language == "es":
            return """CONTEXTO MERMAID:
Mermaid soporta múltiples tipos de diagramas:
- flowchart/graph: Diagramas de flujo (usa TD, LR, TB para dirección)
- sequenceDiagram: Diagramas de secuencia con actores y mensajes
- classDiagram: Diagramas de clases UML
- stateDiagram-v2: Máquinas de estado
- erDiagram: Diagramas entidad-relación
- gantt: Diagramas de Gantt para cronogramas
- pie: Gráficos circulares
- gitGraph: Grafos de Git

REGLAS IMPORTANTES:
- Usa SOLO la sintaxis básica de Mermaid
- NO uses classDef, style, o cualquier definición de estilos CSS
- NO agregues colores (fill, stroke, etc.)
- NO uses cssClass o class para aplicar estilos
- Usa solo nodos básicos: [], {}, (), [[]], [()]
- Flechas simples: -->, ---|texto|, etc.
- Subgrafos SOLO si son necesarios para la organización lógica"""
        else:
            return """MERMAID CONTEXT:
Mermaid supports multiple diagram types:
- flowchart/graph: Flow diagrams (use TD, LR, TB for direction)
- sequenceDiagram: Sequence diagrams with actors and messages
- classDiagram: UML class diagrams
- stateDiagram-v2: State machines
- erDiagram: Entity-relationship diagrams
- gantt: Gantt charts for timelines
- pie: Pie charts
- gitGraph: Git graphs

IMPORTANT RULES:
- Use ONLY basic Mermaid syntax
- DO NOT use classDef, style, or any CSS style definitions
- DO NOT add colors (fill, stroke, etc.)
- DO NOT use cssClass or class to apply styles
- Use only basic nodes: [], {}, (), [[]], [()]
- Simple arrows: -->, ---|text|, etc.
- Subgraphs ONLY if necessary for logical organization"""

    def _get_plantuml_context(self, language: str) -> str:
        """Get PlantUML-specific context and best practices."""
        if language == "es":
            return """CONTEXTO PLANTUML:
PlantUML es una herramienta para diagramas UML y técnicos:
- Diagramas de secuencia
- Diagramas de casos de uso
- Diagramas de clases
- Diagramas de actividad
- Diagramas de componentes
- Diagramas de estado
- Diagramas de objetos

REGLAS IMPORTANTES PARA PLANTUML:
1. SIEMPRE usa la sintaxis MÁS SIMPLE Y COMPATIBLE
2. EVITA diseños complejos, colores excesivos y skinparams innecesarios
3. Prioriza CLARIDAD y COMPATIBILIDAD sobre estética
4. Solo usa features básicas que funcionen en cualquier versión de PlantUML
5. Minimiza el uso de skinparam (solo si es absolutamente necesario)
6. Usa nombres cortos y descriptivos
7. Prefiere diagramas simples y legibles"""
        else:
            return """PLANTUML CONTEXT:
PlantUML is a tool for UML and technical diagrams:
- Sequence diagrams
- Use case diagrams
- Class diagrams
- Activity diagrams
- Component diagrams
- State diagrams
- Object diagrams

IMPORTANT RULES FOR PLANTUML:
1. ALWAYS use the SIMPLEST AND MOST COMPATIBLE syntax
2. AVOID complex designs, excessive colors, and unnecessary skinparams
3. Prioritize CLARITY and COMPATIBILITY over aesthetics
4. Only use basic features that work in any PlantUML version
5. Minimize skinparam usage (only if absolutely necessary)
6. Use short and descriptive names
7. Prefer simple and readable diagrams"""

    @property
    def provider_name(self) -> str:
        """Provider name."""
        return "OpenAI GPT"
