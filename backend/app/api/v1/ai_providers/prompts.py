"""
Módulo centralizado de prompts para todos los proveedores de IA.
Contiene todas las plantillas de prompts y funciones de construcción
utilizadas por los clientes de IA (OpenAI, Claude, Gemini, DeepSeek).
"""
from typing import Optional


# ------------------------------------------------------------------ #
#  Contexto de tipos de diagrama
# ------------------------------------------------------------------ #

def get_mermaid_context(language: str) -> str:
    """Contexto y mejores prácticas para diagramas Mermaid con sintaxis válida."""
    if language == "es":
        return (
            "REFERENCIA DE SINTAXIS MERMAID (solo usar estas construcciones):\n\n"
            "TIPOS DE DIAGRAMA: flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, gitGraph\n\n"
            "FLOWCHART - SINTAXIS VALIDA:\n"
            "- Direccion: flowchart TD | TB | BT | LR | RL\n"
            "- Nodos: A[Rectangulo], B(Redondeado), C{Rombo}, D((Circulo)), E([Estadio]), F[[Subrutina]], G[(Base de datos)], H{{Hexagono}}\n"
            "- Flechas: A --> B, A --- B, A -.-> B, A ==> B\n"
            "- Etiquetas: A -->|texto| B, A -- texto --> B\n"
            "- Subgrafos: subgraph idSinEspacios[\"Titulo Visible\"]  ...  end\n\n"
            "ESTILOS VALIDOS EN FLOWCHART (definir DESPUES de todos los nodos y conexiones):\n"
            "- classDef nombreEstilo fill:#hex,stroke:#hex,stroke-width:2px,color:#hex\n"
            "- class nodoA,nodoB nombreEstilo\n"
            "- style nodoA fill:#hex,stroke:#hex,color:#hex\n"
            "- style idSubgraph fill:#hex,stroke:#hex (para colorear subgrafos)\n\n"
            "EJEMPLO CORRECTO CON ESTILOS Y SUBGRAFOS:\n"
            "flowchart TD\n"
            "    subgraph frontend[\"Capa Frontend\"]\n"
            "        A[Navegador] --> B[React App]\n"
            "    end\n"
            "    subgraph backend[\"Capa Backend\"]\n"
            "        C[API REST] --> D[(Base de Datos)]\n"
            "    end\n"
            "    B --> C\n"
            "    classDef uiStyle fill:#4CAF50,stroke:#388E3C,color:#fff\n"
            "    classDef apiStyle fill:#2196F3,stroke:#1565C0,color:#fff\n"
            "    classDef dbStyle fill:#FF9800,stroke:#F57C00,color:#fff\n"
            "    class A,B uiStyle\n"
            "    class C apiStyle\n"
            "    class D dbStyle\n"
            "    style frontend fill:#E8F5E9,stroke:#4CAF50\n"
            "    style backend fill:#E3F2FD,stroke:#2196F3\n\n"
            "ERRORES COMUNES QUE CAUSAN PARSE ERROR (NUNCA hacer esto):\n\n"
            "ERROR 1 - class con texto entre comillas:\n"
            "  INCORRECTO: class \"Entorno de Desarrollo\" estiloVerde\n"
            "  CORRECTO:   class entornoDesarrollo estiloVerde\n"
            "  REGLA: El comando 'class' solo acepta IDs de nodos (sin comillas, sin espacios).\n\n"
            "ERROR 2 - classDef con nombre 'subgraph':\n"
            "  INCORRECTO: classDef subgraph fill:#F0F9FF,stroke:#1E40AF\n"
            "  CORRECTO:   classDef subgrafo fill:#F0F9FF,stroke:#1E40AF\n"
            "  CORRECTO:   classDef grupo fill:#F0F9FF,stroke:#1E40AF\n"
            "  REGLA: 'subgraph' es palabra reservada de Mermaid. Usar otro nombre como 'grupo', 'subgrafo', 'contenedor'.\n\n"
            "ERROR 3 - classDef con nombre 'default':\n"
            "  INCORRECTO: classDef default fill:#FFFFFF,stroke:#333\n"
            "  CORRECTO:   classDef base fill:#FFFFFF,stroke:#333\n"
            "  CORRECTO:   classDef normal fill:#FFFFFF,stroke:#333\n"
            "  REGLA: 'default' es palabra reservada. Usar otro nombre como 'base', 'normal', 'estandar'.\n\n"
            "PALABRAS RESERVADAS que NO se pueden usar como nombre de classDef:\n"
            "subgraph, end, default, graph, flowchart, click, style, linkStyle, callback\n\n"
            "SEQUENCEDIAGRAM - NO soporta classDef/style. Usa:\n"
            "- participant Nombre as Alias\n"
            "- activate/deactivate\n"
            "- rect rgb(200, 220, 255) ... end (para resaltar bloques)\n"
            "- Note over A,B: texto\n\n"
            "CLASSDIAGRAM, ERDIAGRAM, PIE - NO soportan classDef/style.\n"
            "STATEDIAGRAM - Usa classDef similar a flowchart.\n"
            "GANTT - Colores via secciones, no via classDef.\n\n"
            "REGLAS CRITICAS DE SINTAXIS:\n"
            "1. IDs de nodos sin espacios (camelCase: procesoA). Texto visible entre corchetes: procesoA[\"Proceso A\"]\n"
            "2. classDef y class van DESPUES de todas las conexiones\n"
            "3. class SOLO acepta IDs de nodos: class A,B estilo. NUNCA: class \"texto\" estilo\n"
            "4. Nombres de classDef NO pueden ser palabras reservadas: subgraph, end, class, style, graph, flowchart, default\n"
            "5. Para colorear subgrafos: style idSubgraph fill:#color,stroke:#color\n"
            "6. Colores hex: # + 3 o 6 chars (#fff, #4CAF50)\n"
            "7. En sequenceDiagram NO usar classDef ni style\n"
            "8. Cada classDef en su propia linea"
        )
    else:
        return (
            "MERMAID SYNTAX REFERENCE (only use these constructs):\n\n"
            "DIAGRAM TYPES: flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, gitGraph\n\n"
            "FLOWCHART - VALID SYNTAX:\n"
            "- Direction: flowchart TD | TB | BT | LR | RL\n"
            "- Nodes: A[Rectangle], B(Rounded), C{Diamond}, D((Circle)), E([Stadium]), F[[Subroutine]], G[(Database)], H{{Hexagon}}\n"
            "- Arrows: A --> B, A --- B, A -.-> B, A ==> B\n"
            "- Labels: A -->|text| B, A -- text --> B\n"
            "- Subgraphs: subgraph idNoSpaces[\"Visible Title\"]  ...  end\n\n"
            "VALID STYLES IN FLOWCHART (define AFTER all nodes and connections):\n"
            "- classDef styleName fill:#hex,stroke:#hex,stroke-width:2px,color:#hex\n"
            "- class nodeA,nodeB styleName\n"
            "- style nodeA fill:#hex,stroke:#hex,color:#hex\n"
            "- style subgraphId fill:#hex,stroke:#hex (to color subgraphs)\n\n"
            "CORRECT EXAMPLE WITH STYLES AND SUBGRAPHS:\n"
            "flowchart TD\n"
            "    subgraph frontend[\"Frontend Layer\"]\n"
            "        A[Browser] --> B[React App]\n"
            "    end\n"
            "    subgraph backend[\"Backend Layer\"]\n"
            "        C[REST API] --> D[(Database)]\n"
            "    end\n"
            "    B --> C\n"
            "    classDef uiStyle fill:#4CAF50,stroke:#388E3C,color:#fff\n"
            "    classDef apiStyle fill:#2196F3,stroke:#1565C0,color:#fff\n"
            "    classDef dbStyle fill:#FF9800,stroke:#F57C00,color:#fff\n"
            "    class A,B uiStyle\n"
            "    class C apiStyle\n"
            "    class D dbStyle\n"
            "    style frontend fill:#E8F5E9,stroke:#4CAF50\n"
            "    style backend fill:#E3F2FD,stroke:#2196F3\n\n"
            "COMMON ERRORS THAT CAUSE PARSE ERRORS (NEVER do this):\n\n"
            "ERROR 1 - class with quoted text:\n"
            "  WRONG:   class \"Development Environment\" greenStyle\n"
            "  CORRECT: class devEnvironment greenStyle\n"
            "  RULE: The 'class' command only accepts node IDs (no quotes, no spaces).\n\n"
            "ERROR 2 - classDef named 'subgraph':\n"
            "  WRONG:   classDef subgraph fill:#F0F9FF,stroke:#1E40AF\n"
            "  CORRECT: classDef groupStyle fill:#F0F9FF,stroke:#1E40AF\n"
            "  CORRECT: classDef container fill:#F0F9FF,stroke:#1E40AF\n"
            "  RULE: 'subgraph' is a Mermaid reserved word. Use another name like 'groupStyle', 'container', 'section'.\n\n"
            "ERROR 3 - classDef named 'default':\n"
            "  WRONG:   classDef default fill:#FFFFFF,stroke:#333\n"
            "  CORRECT: classDef base fill:#FFFFFF,stroke:#333\n"
            "  CORRECT: classDef normal fill:#FFFFFF,stroke:#333\n"
            "  RULE: 'default' is a reserved word. Use another name like 'base', 'normal', 'standard'.\n\n"
            "RESERVED WORDS that CANNOT be used as classDef names:\n"
            "subgraph, end, default, graph, flowchart, click, style, linkStyle, callback\n\n"
            "SEQUENCEDIAGRAM - Does NOT support classDef/style. Use:\n"
            "- participant Name as Alias\n"
            "- activate/deactivate\n"
            "- rect rgb(200, 220, 255) ... end (to highlight blocks)\n"
            "- Note over A,B: text\n\n"
            "CLASSDIAGRAM, ERDIAGRAM, PIE - Do NOT support classDef/style.\n"
            "STATEDIAGRAM - Uses classDef similar to flowchart.\n"
            "GANTT - Colors via sections, not via classDef.\n\n"
            "CRITICAL SYNTAX RULES:\n"
            "1. Node IDs without spaces (camelCase: processA). Visible text in brackets: processA[\"Process A\"]\n"
            "2. classDef and class go AFTER all connections\n"
            "3. class ONLY accepts node IDs: class A,B style. NEVER: class \"text\" style\n"
            "4. classDef names CANNOT be reserved words: subgraph, end, class, style, graph, flowchart, default\n"
            "5. To color subgraphs: style subgraphId fill:#color,stroke:#color\n"
            "6. Hex colors: # + 3 or 6 chars (#fff, #4CAF50)\n"
            "7. In sequenceDiagram DO NOT use classDef or style\n"
            "8. Each classDef on its own line"
        )


def get_plantuml_context(language: str) -> str:
    """Contexto y mejores prácticas para diagramas PlantUML con sintaxis válida."""
    if language == "es":
        return (
            "REFERENCIA DE SINTAXIS PLANTUML (solo usar estas construcciones):\n\n"
            "TIPOS: secuencia, casos de uso, clases, actividad, componentes, estado, objetos\n\n"
            "ESTRUCTURA BASICA:\n"
            "@startuml\n"
            "' contenido aqui\n"
            "@enduml\n\n"
            "ESTILOS VALIDOS:\n"
            "- Colores en elementos: participant Nombre #LightBlue\n"
            "- skinparam global:\n"
            "  skinparam backgroundColor #FEFEFE\n"
            "  skinparam roundcorner 10\n"
            "  skinparam ArrowColor #555555\n"
            "  skinparam ActorBorderColor #2196F3\n"
            "- Colores en notas: note right #FFFFCC : texto\n"
            "- Colores en paquetes: package \"Nombre\" #E3F2FD { }\n"
            "- Colores en rectangulos: rectangle \"Nombre\" #color { }\n\n"
            "EJEMPLO CORRECTO CON ESTILOS:\n"
            "@startuml\n"
            "skinparam backgroundColor #FEFEFE\n"
            "skinparam roundcorner 10\n"
            "skinparam sequence {\n"
            "    ArrowColor #555555\n"
            "    LifeLineBorderColor #2196F3\n"
            "    ParticipantBackgroundColor #E3F2FD\n"
            "    ParticipantBorderColor #1565C0\n"
            "}\n\n"
            "participant \"Usuario\" as U #E3F2FD\n"
            "participant \"Sistema\" as S #E8F5E9\n"
            "database \"Base de Datos\" as DB #FFF3E0\n\n"
            "U -> S: Solicitud\n"
            "activate S #E3F2FD\n"
            "S -> DB: Consultar\n"
            "activate DB #FFF3E0\n"
            "DB --> S: Datos\n"
            "deactivate DB\n"
            "S --> U: Respuesta\n"
            "deactivate S\n"
            "@enduml\n\n"
            "REGLAS CRITICAS:\n"
            "1. SIEMPRE iniciar con @startuml y terminar con @enduml\n"
            "2. Los colores van con # seguido del nombre o hex: #LightBlue, #4CAF50\n"
            "3. skinparam va ANTES de los elementos del diagrama\n"
            "4. NO usar sintaxis de Mermaid (classDef, style, -->, etc.)\n"
            "5. Relaciones: -> (solida), --> (punteada), ->> (asincrona)\n"
            "6. Usar comillas para nombres con espacios: participant \"Mi Servicio\" as MS"
        )
    else:
        return (
            "PLANTUML SYNTAX REFERENCE (only use these constructs):\n\n"
            "TYPES: sequence, use case, class, activity, component, state, object\n\n"
            "BASIC STRUCTURE:\n"
            "@startuml\n"
            "' content here\n"
            "@enduml\n\n"
            "VALID STYLES:\n"
            "- Element colors: participant Name #LightBlue\n"
            "- Global skinparam:\n"
            "  skinparam backgroundColor #FEFEFE\n"
            "  skinparam roundcorner 10\n"
            "  skinparam ArrowColor #555555\n"
            "  skinparam ActorBorderColor #2196F3\n"
            "- Note colors: note right #FFFFCC : text\n"
            "- Package colors: package \"Name\" #E3F2FD { }\n"
            "- Rectangle colors: rectangle \"Name\" #color { }\n\n"
            "CORRECT EXAMPLE WITH STYLES:\n"
            "@startuml\n"
            "skinparam backgroundColor #FEFEFE\n"
            "skinparam roundcorner 10\n"
            "skinparam sequence {\n"
            "    ArrowColor #555555\n"
            "    LifeLineBorderColor #2196F3\n"
            "    ParticipantBackgroundColor #E3F2FD\n"
            "    ParticipantBorderColor #1565C0\n"
            "}\n\n"
            "participant \"User\" as U #E3F2FD\n"
            "participant \"System\" as S #E8F5E9\n"
            "database \"Database\" as DB #FFF3E0\n\n"
            "U -> S: Request\n"
            "activate S #E3F2FD\n"
            "S -> DB: Query\n"
            "activate DB #FFF3E0\n"
            "DB --> S: Data\n"
            "deactivate DB\n"
            "S --> U: Response\n"
            "deactivate S\n"
            "@enduml\n\n"
            "CRITICAL RULES:\n"
            "1. ALWAYS start with @startuml and end with @enduml\n"
            "2. Colors use # followed by name or hex: #LightBlue, #4CAF50\n"
            "3. skinparam goes BEFORE diagram elements\n"
            "4. DO NOT use Mermaid syntax (classDef, style, -->, etc.)\n"
            "5. Relationships: -> (solid), --> (dotted), ->> (async)\n"
            "6. Use quotes for names with spaces: participant \"My Service\" as MS"
        )


def get_diagram_context(diagram_type: str, language: str) -> str:
    """Obtener contexto segun el tipo de diagrama."""
    if diagram_type == "mermaid":
        return get_mermaid_context(language)
    else:
        return get_plantuml_context(language)


# ------------------------------------------------------------------ #
#  Prompt: Generar descripcion de diagrama
# ------------------------------------------------------------------ #

def build_description_prompt(
    diagram_code: str,
    diagram_type: str,
    language: str = "es"
) -> str:
    """Prompt para generar una descripcion tecnica de un diagrama existente."""
    lang_map = {"es": "espanol", "en": "English"}
    lang_text = lang_map.get(language, "espanol")

    return (
        f"Eres un experto en analisis de diagramas tecnicos. Analiza el siguiente codigo "
        f"de diagrama tipo {diagram_type} y genera una descripcion clara y concisa en {lang_text}.\n\n"
        f"Codigo del diagrama:\n```\n{diagram_code}\n```\n\n"
        "Genera una descripcion profesional en formato Markdown que explique de forma natural "
        "que representa el diagrama, que elementos contiene y como se relacionan entre si. "
        "Escribe de forma libre y fluida, sin seguir una estructura rigida de secciones. "
        "La descripcion debe ser tecnica pero comprensible, entre 100-300 palabras.\n\n"
        "IMPORTANTE: Devuelve UNICAMENTE el contenido Markdown puro, SIN bloques de codigo "
        "(```markdown), SIN encabezados adicionales, SIN prefijos. Comienza directamente con "
        "el contenido de la descripcion."
    )


DESCRIPTION_SYSTEM_PROMPT = "You are an expert in analyzing and describing technical diagrams. Provide clear, concise, and professional descriptions."


def build_refine_description_prompt(
    diagram_code: str,
    diagram_type: str,
    current_description: str,
    refinement_request: str,
    language: str = "es"
) -> str:
    """Prompt para refinar una descripcion existente segun instrucciones del usuario."""
    lang_map = {"es": "espanol", "en": "English"}
    lang_text = lang_map.get(language, "espanol")

    return (
        f"Eres un experto en analisis de diagramas tecnicos. El usuario tiene un diagrama "
        f"tipo {diagram_type} con una descripcion existente y quiere refinarla.\n\n"
        f"Codigo del diagrama:\n```\n{diagram_code}\n```\n\n"
        f"Descripcion actual:\n{current_description}\n\n"
        f"Instruccion del usuario para refinar:\n{refinement_request}\n\n"
        f"Genera la descripcion refinada en {lang_text}, aplicando los cambios solicitados. "
        "Escribe de forma libre y fluida en formato Markdown.\n\n"
        "IMPORTANTE: Devuelve UNICAMENTE el contenido Markdown puro, SIN bloques de codigo "
        "(```markdown), SIN encabezados adicionales, SIN prefijos. Comienza directamente con "
        "el contenido de la descripcion refinada."
    )


# ------------------------------------------------------------------ #
#  Prompt: Generar diagrama desde descripcion
# ------------------------------------------------------------------ #

def build_generate_diagram_prompt(
    description: str,
    diagram_type: str,
    language: str = "es"
) -> str:
    """Prompt para generar codigo de diagrama a partir de una descripcion."""
    context = get_diagram_context(diagram_type, language)

    if language == "es":
        return (
            f"Eres un experto en crear diagramas {diagram_type} profesionales y visualmente atractivos.\n\n"
            f"{context}\n\n"
            f"DESCRIPCION DEL USUARIO:\n{description}\n\n"
            "INSTRUCCIONES:\n"
            "1. Crea un diagrama COMPLETO y PROFESIONAL que capture todos los aspectos de la descripcion\n"
            "2. DISENO VISUAL ATRACTIVO:\n"
            "   - Usa colores profesionales para diferenciar tipos de elementos (ver ejemplos en la referencia de sintaxis)\n"
            "   - Agrupa elementos relacionados con subgrafos cuando tenga sentido\n"
            "   - Usa formas variadas segun el tipo de nodo (rectangulos, rombos, circulos, etc.)\n"
            "3. SINTAXIS 100% VALIDA:\n"
            "   - Sigue ESTRICTAMENTE la referencia de sintaxis proporcionada arriba\n"
            "   - Los estilos (classDef, class) van DESPUES de todos los nodos y conexiones\n"
            "   - Los IDs de nodos NO pueden tener espacios (usa camelCase: procesoInicio, no \"proceso inicio\")\n"
            "   - Si el tipo de diagrama NO soporta estilos (erDiagram, pie, etc.), NO intentes agregarlos\n"
            "4. Genera SOLO el codigo del diagrama, sin texto adicional\n"
            "5. NO incluyas markdown code blocks (```)\n"
            "6. Usa nombres descriptivos en espanol\n"
            "7. Organiza el codigo de forma legible con indentacion apropiada\n\n"
            "GENERA EL CODIGO DEL DIAGRAMA:"
        )
    else:
        return (
            f"You are an expert in creating professional and visually appealing {diagram_type} diagrams.\n\n"
            f"{context}\n\n"
            f"USER DESCRIPTION:\n{description}\n\n"
            "INSTRUCTIONS:\n"
            "1. Create a COMPLETE and PROFESSIONAL diagram that captures all aspects of the description\n"
            "2. VISUALLY ATTRACTIVE DESIGN:\n"
            "   - Use professional colors to differentiate element types (see examples in syntax reference)\n"
            "   - Group related elements with subgraphs when it makes sense\n"
            "   - Use varied shapes based on node type (rectangles, diamonds, circles, etc.)\n"
            "3. 100% VALID SYNTAX:\n"
            "   - Follow STRICTLY the syntax reference provided above\n"
            "   - Styles (classDef, class) go AFTER all nodes and connections\n"
            "   - Node IDs CANNOT have spaces (use camelCase: startProcess, not \"start process\")\n"
            "   - If the diagram type does NOT support styles (erDiagram, pie, etc.), DO NOT try to add them\n"
            "4. Generate ONLY the diagram code, no additional text\n"
            "5. DO NOT include markdown code blocks (```)\n"
            "6. Use descriptive names in English\n"
            "7. Organize the code in a readable format with proper indentation\n\n"
            "GENERATE THE DIAGRAM CODE:"
        )


def get_generate_diagram_system_prompt(diagram_type: str) -> str:
    """System prompt para generacion de diagramas."""
    return f"You are an expert in creating visually appealing and professional {diagram_type} diagrams. Generate well-designed diagram code with attractive colors and clear structure."


# ------------------------------------------------------------------ #
#  Prompt: Mejorar diagrama existente
# ------------------------------------------------------------------ #

def build_improve_diagram_prompt(
    diagram_code: str,
    improvement_request: str,
    diagram_type: str,
    language: str = "es"
) -> str:
    """Prompt para mejorar un diagrama existente segun la solicitud del usuario."""
    context = get_diagram_context(diagram_type, language)

    if language == "es":
        return (
            f"Eres un experto en diagramas {diagram_type} con gran sentido del diseno visual.\n\n"
            f"{context}\n\n"
            f"DIAGRAMA ACTUAL:\n```\n{diagram_code}\n```\n\n"
            f"SOLICITUD DE MEJORA DEL USUARIO:\n{improvement_request}\n\n"
            "INSTRUCCIONES PARA LA MEJORA:\n"
            "1. PRESERVA la estructura y logica fundamental del diagrama original\n"
            "2. Aplica las mejoras solicitadas por el usuario de la mejor forma posible\n"
            "3. Si el usuario pide mejoras visuales (colores, estilos, diseno):\n"
            "   - Propon la MEJOR combinacion visual posible usando SOLO sintaxis valida de la referencia\n"
            "   - Usa paletas de colores profesionales y armoniosas\n"
            "   - Aplica los colores de forma coherente (mismo color para elementos del mismo tipo)\n"
            "   - Se generoso con el diseno: haz que se vea espectacular\n"
            "4. SINTAXIS 100% VALIDA:\n"
            "   - Sigue ESTRICTAMENTE la referencia de sintaxis proporcionada arriba\n"
            "   - Los estilos (classDef, class) van DESPUES de todos los nodos y conexiones\n"
            "   - Los IDs de nodos NO pueden tener espacios\n"
            "   - Si el tipo de diagrama NO soporta estilos, NO intentes agregarlos\n"
            "5. Si el usuario pide mas detalle, EXPANDE el diagrama con informacion relevante\n"
            "6. Si el usuario pide simplificacion, CONSOLIDA elementos manteniendo la claridad\n"
            "7. Si el diagrama actual no tiene estilos y el usuario no pide cambios visuales, manten el estilo actual\n"
            "8. Genera SOLO el codigo del diagrama mejorado, sin texto adicional\n"
            "9. NO incluyas markdown code blocks (```)\n"
            "10. Manten la coherencia del idioma del diagrama original\n\n"
            "GENERA EL CODIGO DEL DIAGRAMA MEJORADO:"
        )
    else:
        return (
            f"You are an expert in {diagram_type} diagrams with a strong sense of visual design.\n\n"
            f"{context}\n\n"
            f"CURRENT DIAGRAM:\n```\n{diagram_code}\n```\n\n"
            f"USER'S IMPROVEMENT REQUEST:\n{improvement_request}\n\n"
            "INSTRUCTIONS FOR IMPROVEMENT:\n"
            "1. PRESERVE the fundamental structure and logic of the original diagram\n"
            "2. Apply the user's requested improvements in the best possible way\n"
            "3. If the user requests visual improvements (colors, styles, design):\n"
            "   - Propose the BEST possible visual combination using ONLY valid syntax from the reference\n"
            "   - Use professional and harmonious color palettes\n"
            "   - Apply colors coherently (same color for elements of the same type)\n"
            "   - Be generous with design: make it look spectacular\n"
            "4. 100% VALID SYNTAX:\n"
            "   - Follow STRICTLY the syntax reference provided above\n"
            "   - Styles (classDef, class) go AFTER all nodes and connections\n"
            "   - Node IDs CANNOT have spaces\n"
            "   - If the diagram type does NOT support styles, DO NOT try to add them\n"
            "5. If user requests more detail, EXPAND the diagram with relevant information\n"
            "6. If user requests simplification, CONSOLIDATE elements while maintaining clarity\n"
            "7. If the current diagram has no styles and the user doesn't request visual changes, keep the current style\n"
            "8. Generate ONLY the improved diagram code, no additional text\n"
            "9. DO NOT include markdown code blocks (```)\n"
            "10. Maintain language consistency from the original diagram\n\n"
            "GENERATE THE IMPROVED DIAGRAM CODE:"
        )


def get_improve_diagram_system_prompt(diagram_type: str) -> str:
    """System prompt para mejora de diagramas."""
    return f"You are an expert in improving {diagram_type} diagrams. Apply requested improvements effectively, especially visual enhancements with professional color palettes and attractive design."


# ------------------------------------------------------------------ #
#  Prompt: Chat con contexto de diagrama
# ------------------------------------------------------------------ #

def build_chat_system_prompt(
    diagram_code: str,
    diagram_type: str,
    language: str = "es"
) -> str:
    """System prompt para conversacion con contexto de diagrama."""
    if language == "es":
        return (
            f"Eres un asistente experto en diagramas {diagram_type}. El usuario esta trabajando "
            f"en el siguiente diagrama y quiere conversar sobre el.\n\n"
            f"DIAGRAMA ACTUAL:\n```\n{diagram_code}\n```\n\n"
            "Responde de forma clara y util en espanol. No modifiques el diagrama a menos que se te pida explicitamente."
        )
    else:
        return (
            f"You are an expert assistant in {diagram_type} diagrams. The user is working on "
            f"the following diagram and wants to discuss it.\n\n"
            f"CURRENT DIAGRAM:\n```\n{diagram_code}\n```\n\n"
            "Respond clearly and helpfully in English. Do not modify the diagram unless explicitly asked."
        )


# ------------------------------------------------------------------ #
#  Prompt: Resumir conversacion
# ------------------------------------------------------------------ #

SUMMARIZE_SYSTEM_PROMPT = "You are a helpful assistant that creates concise conversation summaries."


def build_summarize_prompt(
    messages: list[dict],
    language: str = "es"
) -> str:
    """Prompt para generar un resumen compacto de una conversacion."""
    conversation_text = "\n".join(
        f"{'Usuario' if m['role'] == 'user' else 'Asistente'}: {m['content']}"
        if language == "es"
        else f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
        for m in messages
    )

    if language == "es":
        return (
            "Resume la siguiente conversacion de forma compacta, capturando los puntos clave, "
            "decisiones tomadas y contexto importante. El resumen sera usado como contexto inicial "
            "para continuar la conversacion en una nueva sesion.\n\n"
            f"CONVERSACION:\n{conversation_text}\n\n"
            "RESUMEN COMPACTO:"
        )
    else:
        return (
            "Summarize the following conversation compactly, capturing key points, decisions made, "
            "and important context. The summary will be used as initial context to continue the "
            "conversation in a new session.\n\n"
            f"CONVERSATION:\n{conversation_text}\n\n"
            "COMPACT SUMMARY:"
        )


# ------------------------------------------------------------------ #
#  Utilidades comunes
# ------------------------------------------------------------------ #

def clean_code_response(text: str) -> str:
    """Limpiar respuesta de IA removiendo bloques de codigo markdown."""
    import re

    text = text.strip()
    if not text:
        return text

    # Remove markdown code fences: ```lang\n...\n```
    match = re.match(r'^```\w*\s*\n(.*?)```\s*$', text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Handle opening fence without closing
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```lang or ```)
        lines = lines[1:]
        # Remove last line if it's a closing fence
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    elif text.endswith("```"):
        text = text[:-3].strip()

    return text
