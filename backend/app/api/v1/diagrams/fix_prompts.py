"""
Prompts especializados para corrección de diagramas con IA.
"""
from typing import Optional


def build_mermaid_fix_prompt(
    diagram_code: str,
    error_context: Optional[str] = None,
    language: str = "es"
) -> str:
    """
    Construir prompt especializado para corrección de diagramas Mermaid.
    
    Args:
        diagram_code: Código del diagrama con errores
        error_context: Contexto del error (mensaje, línea)
        language: Idioma para la explicación (es, en)
        
    Returns:
        Prompt formateado para el modelo de IA
    """
    lang_instructions = {
        "es": {
            "intro": "Eres un experto en diagramas Mermaid. Analiza el siguiente código que tiene errores de sintaxis y corrígelo.",
            "error_label": "ERROR DETECTADO:",
            "rules_label": "REGLAS DE SINTAXIS MERMAID:",
            "instructions_label": "INSTRUCCIONES:",
            "instructions": [
                "1. Identifica el error de sintaxis específico",
                "2. Corrige SOLO el error, manteniendo la estructura original",
                "3. Preserva todos los nodos, relaciones y etiquetas",
                "4. NO cambies el significado del diagrama",
                "5. NO agregues ni elimines elementos innecesariamente"
            ],
            "format_label": "FORMATO DE RESPUESTA (JSON):"
        },
        "en": {
            "intro": "You are an expert in Mermaid diagrams. Analyze the following code that has syntax errors and fix it.",
            "error_label": "DETECTED ERROR:",
            "rules_label": "MERMAID SYNTAX RULES:",
            "instructions_label": "INSTRUCTIONS:",
            "instructions": [
                "1. Identify the specific syntax error",
                "2. Fix ONLY the error, maintaining the original structure",
                "3. Preserve all nodes, relationships and labels",
                "4. DO NOT change the diagram's meaning",
                "5. DO NOT add or remove elements unnecessarily"
            ],
            "format_label": "RESPONSE FORMAT (JSON):"
        }
    }
    
    lang = lang_instructions.get(language, lang_instructions["es"])
    
    error_section = ""
    if error_context:
        error_section = f"""
{lang["error_label"]}
{error_context}
"""
    
    prompt = f"""{lang["intro"]}

CÓDIGO ORIGINAL:
```mermaid
{diagram_code}
```
{error_section}
{lang["rules_label"]}
- Nodos: A[Texto], B(Texto), C{{Texto}}, D((Texto)), E>Texto], F[/Texto/], G[\\Texto\\]
- Flechas: -->, --->, -.->,-.->, ==>, ==>
- Etiquetas en flechas: -->|texto|, -.->|texto|
- Subgrafos: subgraph titulo ... end
- Comentarios: %% comentario
- Tipos válidos: graph, flowchart, sequenceDiagram, classDiagram, stateDiagram, erDiagram, gantt, pie, journey

{lang["instructions_label"]}
{chr(10).join(lang["instructions"])}

{lang["format_label"]}
{{
  "corrected_code": "código corregido aquí (sin bloques de código markdown)",
  "explanation": "explicación clara de qué se corrigió y por qué",
  "changes_summary": "resumen breve (1 línea)"
}}

IMPORTANTE: Devuelve ÚNICAMENTE el objeto JSON, sin texto adicional antes o después."""
    
    return prompt


def build_plantuml_fix_prompt(
    diagram_code: str,
    error_context: Optional[str] = None,
    language: str = "es"
) -> str:
    """
    Construir prompt especializado para corrección de diagramas PlantUML.
    
    Args:
        diagram_code: Código del diagrama con errores
        error_context: Contexto del error (mensaje, línea)
        language: Idioma para la explicación (es, en)
        
    Returns:
        Prompt formateado para el modelo de IA
    """
    lang_instructions = {
        "es": {
            "intro": "Eres un experto en diagramas PlantUML. Analiza el siguiente código que tiene errores de sintaxis y corrígelo.",
            "error_label": "ERROR DETECTADO:",
            "rules_label": "REGLAS DE SINTAXIS PLANTUML:",
            "instructions_label": "INSTRUCCIONES:",
            "instructions": [
                "1. Identifica el error de sintaxis específico",
                "2. Corrige SOLO el error, manteniendo la estructura original",
                "3. Preserva todos los elementos y relaciones",
                "4. NO cambies el significado del diagrama",
                "5. NO agregues ni elimines elementos innecesariamente"
            ],
            "format_label": "FORMATO DE RESPUESTA (JSON):"
        },
        "en": {
            "intro": "You are an expert in PlantUML diagrams. Analyze the following code that has syntax errors and fix it.",
            "error_label": "DETECTED ERROR:",
            "rules_label": "PLANTUML SYNTAX RULES:",
            "instructions_label": "INSTRUCTIONS:",
            "instructions": [
                "1. Identify the specific syntax error",
                "2. Fix ONLY the error, maintaining the original structure",
                "3. Preserve all elements and relationships",
                "4. DO NOT change the diagram's meaning",
                "5. DO NOT add or remove elements unnecessarily"
            ],
            "format_label": "RESPONSE FORMAT (JSON):"
        }
    }
    
    lang = lang_instructions.get(language, lang_instructions["es"])
    
    error_section = ""
    if error_context:
        error_section = f"""
{lang["error_label"]}
{error_context}
"""
    
    prompt = f"""{lang["intro"]}

CÓDIGO ORIGINAL:
```plantuml
{diagram_code}
```
{error_section}
{lang["rules_label"]}
- Inicio/Fin: @startuml / @enduml
- Clases: class NombreClase {{ ... }}
- Relaciones: <|-- (herencia), *-- (composición), o-- (agregación), --> (asociación)
- Secuencia: participant, activate, deactivate, alt/else/end, loop/end
- Casos de uso: usecase, actor, rectangle
- Componentes: component, interface, package
- Comentarios: ' comentario o /' comentario multilinea '/

{lang["instructions_label"]}
{chr(10).join(lang["instructions"])}

{lang["format_label"]}
{{
  "corrected_code": "código corregido aquí (sin bloques de código markdown)",
  "explanation": "explicación clara de qué se corrigió y por qué",
  "changes_summary": "resumen breve (1 línea)"
}}

IMPORTANTE: Devuelve ÚNICAMENTE el objeto JSON, sin texto adicional antes o después."""
    
    return prompt


def build_d2_fix_prompt(
    diagram_code: str,
    error_context: Optional[str] = None,
    language: str = "es"
) -> str:
    """
    Construir prompt especializado para corrección de diagramas D2.

    Args:
        diagram_code: Código del diagrama con errores
        error_context: Contexto del error (mensaje, línea)
        language: Idioma para la explicación (es, en)

    Returns:
        Prompt formateado para el modelo de IA
    """
    lang_instructions = {
        "es": {
            "intro": (
                "Eres un experto en diagramas D2. Analiza el siguiente código "
                "que tiene errores de sintaxis y corrígelo."
            ),
            "error_label": "ERROR DETECTADO:",
            "rules_label": "REGLAS DE SINTAXIS D2:",
            "instructions_label": "INSTRUCCIONES:",
            "instructions": [
                "1. Identifica el error de sintaxis específico",
                "2. Corrige SOLO el error, manteniendo la estructura original",
                "3. Preserva todos los nodos, conexiones y etiquetas",
                "4. NO cambies el significado del diagrama",
                "5. NO agregues ni elimines elementos innecesariamente",
            ],
            "format_label": "FORMATO DE RESPUESTA (JSON):",
        },
        "en": {
            "intro": (
                "You are an expert in D2 diagrams. Analyze the following code "
                "that has syntax errors and fix it."
            ),
            "error_label": "DETECTED ERROR:",
            "rules_label": "D2 SYNTAX RULES:",
            "instructions_label": "INSTRUCTIONS:",
            "instructions": [
                "1. Identify the specific syntax error",
                "2. Fix ONLY the error, maintaining the original structure",
                "3. Preserve all nodes, connections and labels",
                "4. DO NOT change the diagram's meaning",
                "5. DO NOT add or remove elements unnecessarily",
            ],
            "format_label": "RESPONSE FORMAT (JSON):",
        },
    }

    lang = lang_instructions.get(language, lang_instructions["es"])

    error_section = ""
    if error_context:
        error_section = f"""
{lang["error_label"]}
{error_context}
"""

    prompt = f"""{lang["intro"]}

CÓDIGO ORIGINAL:
```d2
{diagram_code}
```
{error_section}
{lang["rules_label"]}
- Conexiones dirigidas: a -> b (flecha unidireccional)
- Conexiones bidireccionales: a <-> b (flecha bidireccional)
- Conexiones inversas: a <- b (flecha inversa)
- Conexiones sin dirección: a -- b (línea sin flecha)
- Etiquetas en conexiones: a -> b: etiqueta
- Formas (shape): rectangle, square, page, parallelogram, document, cylinder, queue, package, \
step, callout, stored_data, person, diamond, oval, circle, hexagon, cloud, text, code, class, \
sql_table, image, sequence_diagram
- Contenedores: nodo {{ hijos }}
- Estilos (style): opacity, stroke, fill, stroke-width, stroke-dash, border-radius, font-color, \
font-size, font, bold, italic, underline, shadow, multiple, animated, 3d
- Comentarios: # comentario de línea
- Etiquetas de nodos: nodo: "Texto de etiqueta"
- Propiedades especiales: label, icon, near, tooltip, link, constraint
- Clases: classes {{ nombre {{ style {{ ... }} }} }}
- Capas y escenarios: layers {{ ... }}, scenarios {{ ... }}

{lang["instructions_label"]}
{chr(10).join(lang["instructions"])}

{lang["format_label"]}
{{
  "corrected_code": "código corregido aquí (sin bloques de código markdown)",
  "explanation": "explicación clara de qué se corrigió y por qué",
  "changes_summary": "resumen breve (1 línea)"
}}

IMPORTANTE: Devuelve ÚNICAMENTE el objeto JSON, sin texto adicional antes o después."""

    return prompt


def build_fix_prompt(
    diagram_code: str,
    diagram_type: str,
    error_context: Optional[str] = None,
    language: str = "es"
) -> str:
    """
    Construir prompt de corrección según tipo de diagrama.

    Args:
        diagram_code: Código del diagrama con errores
        diagram_type: Tipo de diagrama (mermaid, plantuml, d2)
        error_context: Contexto del error (mensaje, línea)
        language: Idioma para la explicación (es, en)

    Returns:
        Prompt formateado para el modelo de IA
    """
    diagram_type_lower = diagram_type.lower()

    if 'd2' in diagram_type_lower:
        return build_d2_fix_prompt(diagram_code, error_context, language)
    elif 'plantuml' in diagram_type_lower or diagram_type_lower == 'uml':
        return build_plantuml_fix_prompt(diagram_code, error_context, language)
    else:
        # Por defecto, usar prompt de Mermaid
        return build_mermaid_fix_prompt(diagram_code, error_context, language)
