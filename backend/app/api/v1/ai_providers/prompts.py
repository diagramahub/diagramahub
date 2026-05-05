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


def get_d2_context(language: str) -> str:
    """Contexto y mejores prácticas para diagramas D2 con sintaxis válida."""
    if language == "es":
        return (
            "REFERENCIA DE SINTAXIS D2 (solo usar estas construcciones):\n\n"
            "D2 es un lenguaje de diagramación declarativo moderno.\n\n"
            "ESTRUCTURA BASICA:\n"
            "# Los diagramas D2 NO usan @startuml/@enduml\n"
            "# Solo se escribe el contenido directamente\n\n"
            "CONEXIONES:\n"
            "- Dirigida: a -> b\n"
            "- Bidireccional: a <-> b\n"
            "- Sin dirección: a -- b\n"
            "- Con etiqueta: a -> b: etiqueta\n\n"
            "CONTENEDORES (agrupación):\n"
            "server: {\n"
            "  api: {\n"
            "    handler -> db\n"
            "  }\n"
            "}\n\n"
            "FORMAS:\n"
            "- nodo.shape: rectangle\n"
            "- nodo.shape: circle\n"
            "- nodo.shape: diamond\n"
            "- nodo.shape: oval\n"
            "- nodo.shape: cylinder\n"
            "- nodo.shape: queue\n"
            "- nodo.shape: hexagon\n"
            "- nodo.shape: cloud\n"
            "- nodo.shape: person\n"
            "- nodo.shape: package\n"
            "- nodo.shape: page\n"
            "- nodo.shape: sql_table\n"
            "- nodo.shape: class\n\n"
            "ESTILOS:\n"
            "nodo.style: {\n"
            "  fill: \"#E3F2FD\"\n"
            "  stroke: \"#1565C0\"\n"
            "  border-radius: 8\n"
            "  font-color: \"#333\"\n"
            "}\n\n"
            "ETIQUETAS:\n"
            "- nodo: \"Texto de etiqueta\"\n"
            "- nodo.label: \"Texto\"\n\n"
            "COMENTARIOS: # comentario de línea\n\n"
            "EJEMPLO CORRECTO:\n"
            "# Arquitectura de microservicios\n"
            "frontend: {\n"
            "  label: \"Frontend React\"\n"
            "  style.fill: \"#E3F2FD\"\n"
            "}\n"
            "api: {\n"
            "  label: \"API Gateway\"\n"
            "  style.fill: \"#E8F5E9\"\n"
            "}\n"
            "db: {\n"
            "  label: \"PostgreSQL\"\n"
            "  shape: cylinder\n"
            "  style.fill: \"#FFF3E0\"\n"
            "}\n"
            "frontend -> api: REST\n"
            "api -> db: SQL\n\n"
            "REGLAS CRITICAS:\n"
            "1. NO usar @startuml/@enduml (eso es PlantUML, NO D2)\n"
            "2. NO usar sintaxis de Mermaid (graph TD, -->, classDef, etc.)\n"
            "3. Las llaves { } deben estar balanceadas\n"
            "4. Los colores van entre comillas: \"#4CAF50\"\n"
            "5. Comentarios con # (no con // ni ')\n"
            "6. Las conexiones usan -> (no --> ni ->>)"
        )
    else:
        return (
            "D2 SYNTAX REFERENCE (only use these constructs):\n\n"
            "D2 is a modern declarative diagramming language.\n\n"
            "BASIC STRUCTURE:\n"
            "# D2 diagrams do NOT use @startuml/@enduml\n"
            "# Just write the content directly\n\n"
            "CONNECTIONS:\n"
            "- Directed: a -> b\n"
            "- Bidirectional: a <-> b\n"
            "- Undirected: a -- b\n"
            "- With label: a -> b: label\n\n"
            "CONTAINERS (grouping):\n"
            "server: {\n"
            "  api: {\n"
            "    handler -> db\n"
            "  }\n"
            "}\n\n"
            "SHAPES:\n"
            "- node.shape: rectangle\n"
            "- node.shape: circle\n"
            "- node.shape: diamond\n"
            "- node.shape: oval\n"
            "- node.shape: cylinder\n"
            "- node.shape: queue\n"
            "- node.shape: hexagon\n"
            "- node.shape: cloud\n"
            "- node.shape: person\n"
            "- node.shape: package\n"
            "- node.shape: page\n"
            "- node.shape: sql_table\n"
            "- node.shape: class\n\n"
            "STYLES:\n"
            "node.style: {\n"
            "  fill: \"#E3F2FD\"\n"
            "  stroke: \"#1565C0\"\n"
            "  border-radius: 8\n"
            "  font-color: \"#333\"\n"
            "}\n\n"
            "LABELS:\n"
            "- node: \"Label text\"\n"
            "- node.label: \"Text\"\n\n"
            "COMMENTS: # line comment\n\n"
            "CORRECT EXAMPLE:\n"
            "# Microservices architecture\n"
            "frontend: {\n"
            "  label: \"React Frontend\"\n"
            "  style.fill: \"#E3F2FD\"\n"
            "}\n"
            "api: {\n"
            "  label: \"API Gateway\"\n"
            "  style.fill: \"#E8F5E9\"\n"
            "}\n"
            "db: {\n"
            "  label: \"PostgreSQL\"\n"
            "  shape: cylinder\n"
            "  style.fill: \"#FFF3E0\"\n"
            "}\n"
            "frontend -> api: REST\n"
            "api -> db: SQL\n\n"
            "CRITICAL RULES:\n"
            "1. DO NOT use @startuml/@enduml (that's PlantUML, NOT D2)\n"
            "2. DO NOT use Mermaid syntax (graph TD, -->, classDef, etc.)\n"
            "3. Curly braces { } must be balanced\n"
            "4. Colors go in quotes: \"#4CAF50\"\n"
            "5. Comments use # (not // or ')\n"
            "6. Connections use -> (not --> or ->>)"
        )


def get_dbml_context(language: str) -> str:
    """Contexto y mejores prácticas para diagramas DBML con sintaxis válida."""
    if language == "es":
        return (
            "REFERENCIA DE SINTAXIS DBML (solo usar estas construcciones):\n\n"
            "DBML (Database Markup Language) es un lenguaje declarativo para definir esquemas de bases de datos relacionales.\n\n"
            "ESTRUCTURA DE TABLAS:\n"
            "Table nombre_tabla {\n"
            "  nombre_columna tipo_dato [configuraciones]\n"
            "}\n\n"
            "TIPOS DE DATOS COMUNES:\n"
            "- integer, bigint, smallint\n"
            "- varchar, text, char\n"
            "- boolean, bool\n"
            "- timestamp, datetime, date, time\n"
            "- float, double, decimal\n"
            "- json, jsonb\n"
            "- uuid\n"
            "- blob, bytea\n\n"
            "CONFIGURACIONES DE COLUMNA (entre corchetes []):\n"
            "- [primary key] o [pk] — clave primaria\n"
            "- [not null] — no permite nulos\n"
            "- [unique] — valor unico\n"
            "- [default: valor] — valor por defecto (usar backticks para expresiones: `now()`)\n"
            "- [increment] — auto incremento\n"
            "- [note: \"texto\"] — nota descriptiva (SIEMPRE usar comillas dobles)\n"
            "- Se pueden combinar: [pk, not null, increment]\n\n"
            "RELACIONES (Ref):\n"
            "- Uno a muchos: Ref: posts.user_id > users.id\n"
            "- Muchos a uno: Ref: users.id < posts.user_id\n"
            "- Uno a uno: Ref: users.id - user_profiles.user_id\n"
            "- Muchos a muchos: Ref: students.id <> courses.id\n"
            "- Sintaxis inline en columna: user_id integer [ref: > users.id]\n\n"
            "ENUMS:\n"
            "Enum nombre_enum {\n"
            "  valor1\n"
            "  valor2\n"
            "  valor3 [note: \"descripcion\"]\n"
            "}\n"
            "- Uso en columna: status enum_nombre\n\n"
            "NOTAS:\n"
            "- Nota en tabla: Note: \"Descripcion de la tabla\"\n"
            "- Nota en columna: nombre tipo [note: \"descripcion\"]\n"
            "- Nota multilínea:\n"
            "  Note {\n"
            "    \"Linea 1\"\n"
            "    \"Linea 2\"\n"
            "  }\n\n"
            "INDICES:\n"
            "Table nombre {\n"
            "  // columnas...\n"
            "  indexes {\n"
            "    columna1\n"
            "    (columna1, columna2) [unique]\n"
            "    columna3 [name: 'idx_nombre', unique]\n"
            "  }\n"
            "}\n\n"
            "GRUPOS DE TABLAS:\n"
            "TableGroup nombre_grupo {\n"
            "  tabla1\n"
            "  tabla2\n"
            "}\n\n"
            "EJEMPLO CORRECTO:\n"
            "Table users {\n"
            "  id integer [pk, increment]\n"
            "  username varchar [not null, unique]\n"
            "  email varchar [not null, unique]\n"
            "  role varchar [default: \"user\"]\n"
            "  created_at timestamp [default: `now()`]\n"
            "\n"
            "  Note: \"Tabla principal de usuarios\"\n"
            "}\n\n"
            "Table posts {\n"
            "  id integer [pk, increment]\n"
            "  title varchar [not null]\n"
            "  body text\n"
            "  status post_status [not null, default: \"draft\"]\n"
            "  user_id integer [not null]\n"
            "  created_at timestamp [default: `now()`]\n"
            "\n"
            "  indexes {\n"
            "    user_id\n"
            "    (user_id, status)\n"
            "    created_at\n"
            "  }\n"
            "}\n\n"
            "Enum post_status {\n"
            "  draft\n"
            "  published\n"
            "  archived [note: \"No visible para usuarios\"]\n"
            "}\n\n"
            "Ref: posts.user_id > users.id\n\n"
            "ERRORES COMUNES QUE CAUSAN PROBLEMAS (NUNCA hacer esto):\n\n"
            "ERROR 1 - Olvidar llaves en definiciones de tabla:\n"
            "  INCORRECTO: Table users\n"
            "                id integer\n"
            "  CORRECTO:   Table users {\n"
            "                id integer [pk]\n"
            "              }\n"
            "  REGLA: Toda definicion de Table, Enum e indexes requiere llaves { }.\n\n"
            "ERROR 2 - Usar sintaxis de otros lenguajes:\n"
            "  INCORRECTO: CREATE TABLE users (id INT PRIMARY KEY);\n"
            "  INCORRECTO: @startuml\n"
            "  CORRECTO:   Table users { id integer [pk] }\n"
            "  REGLA: DBML tiene su propia sintaxis. NO usar SQL, PlantUML ni Mermaid.\n\n"
            "ERROR 3 - Formato incorrecto de relaciones:\n"
            "  INCORRECTO: Ref: posts.user_id -> users.id\n"
            "  INCORRECTO: Ref: posts -> users\n"
            "  CORRECTO:   Ref: posts.user_id > users.id\n"
            "  REGLA: Las relaciones usan > (uno a muchos), < (muchos a uno), - (uno a uno), <> (muchos a muchos). Siempre especificar columnas.\n\n"
            "ERROR 4 - Llaves desbalanceadas:\n"
            "  INCORRECTO: Table users {\n"
            "                id integer [pk]\n"
            "  CORRECTO:   Table users {\n"
            "                id integer [pk]\n"
            "              }\n"
            "  REGLA: Cada llave de apertura { debe tener su llave de cierre }.\n\n"
            "ERROR 5 - Valores default sin backticks para expresiones:\n"
            "  INCORRECTO: created_at timestamp [default: now()]\n"
            "  CORRECTO:   created_at timestamp [default: `now()`]\n"
            "  REGLA: Las expresiones de base de datos en default deben ir entre backticks.\n\n"
            "REGLAS CRITICAS DE SINTAXIS:\n"
            "1. Cada Table debe tener llaves { } balanceadas\n"
            "2. Las columnas van dentro de la definicion de tabla, una por linea\n"
            "3. Las configuraciones de columna van entre corchetes []\n"
            "4. Las relaciones (Ref) pueden ir fuera de las tablas o inline en columnas\n"
            "5. Los Enums se definen fuera de las tablas y se referencian por nombre\n"
            "6. NO usar sintaxis SQL (CREATE TABLE, ALTER, etc.)\n"
            "7. NO usar sintaxis de Mermaid, PlantUML ni D2\n"
            "8. Los comentarios usan // para linea simple\n"
            "9. SIEMPRE usar comillas DOBLES (\") para notas y strings. NUNCA usar comillas simples ('). El renderer NO soporta comillas simples.\n"
            "10. Para defaults con strings usar comillas dobles: [default: \"valor\"]\n"
            "11. NO usar DiagramView, Schemas ni Project — el renderer solo soporta: Table, Enum, Ref, Note, TableGroup, indexes\n"
            "12. NO usar [headercolor] en tablas — no soportado por el renderer\n"
            "13. NO usar notas multilinea con triple comillas (''') ni con llaves Note: {''} — solo Note: \"texto en una linea\"\n"
            "14. NO usar alias con 'as' en tablas (Table orders as alias) — no soportado"
        )
    else:
        return (
            "DBML SYNTAX REFERENCE (only use these constructs):\n\n"
            "DBML (Database Markup Language) is a declarative language for defining relational database schemas.\n\n"
            "TABLE STRUCTURE:\n"
            "Table table_name {\n"
            "  column_name data_type [settings]\n"
            "}\n\n"
            "COMMON DATA TYPES:\n"
            "- integer, bigint, smallint\n"
            "- varchar, text, char\n"
            "- boolean, bool\n"
            "- timestamp, datetime, date, time\n"
            "- float, double, decimal\n"
            "- json, jsonb\n"
            "- uuid\n"
            "- blob, bytea\n\n"
            "COLUMN SETTINGS (inside brackets []):\n"
            "- [primary key] or [pk] — primary key\n"
            "- [not null] — disallows null values\n"
            "- [unique] — unique value\n"
            "- [default: value] — default value (use backticks for expressions: `now()`)\n"
            "- [increment] — auto increment\n"
            "- [note: 'text'] — descriptive note\n"
            "- Can be combined: [pk, not null, increment]\n\n"
            "RELATIONSHIPS (Ref):\n"
            "- One to many: Ref: posts.user_id > users.id\n"
            "- Many to one: Ref: users.id < posts.user_id\n"
            "- One to one: Ref: users.id - user_profiles.user_id\n"
            "- Many to many: Ref: students.id <> courses.id\n"
            "- Inline syntax in column: user_id integer [ref: > users.id]\n\n"
            "ENUMS:\n"
            "Enum enum_name {\n"
            "  value1\n"
            "  value2\n"
            "  value3 [note: 'description']\n"
            "}\n"
            "- Usage in column: status enum_name\n\n"
            "NOTES:\n"
            "- Table note: Note: 'Table description'\n"
            "- Column note: name type [note: 'description']\n"
            "- Multi-line note:\n"
            "  Note {\n"
            "    'Line 1'\n"
            "    'Line 2'\n"
            "  }\n\n"
            "INDEXES:\n"
            "Table name {\n"
            "  // columns...\n"
            "  indexes {\n"
            "    column1\n"
            "    (column1, column2) [unique]\n"
            "    column3 [name: 'idx_name', unique]\n"
            "  }\n"
            "}\n\n"
            "TABLE GROUPS:\n"
            "TableGroup group_name {\n"
            "  table1\n"
            "  table2\n"
            "}\n\n"
            "CORRECT EXAMPLE:\n"
            "Table users {\n"
            "  id integer [pk, increment]\n"
            "  username varchar [not null, unique]\n"
            "  email varchar [not null, unique]\n"
            "  role varchar [default: 'user']\n"
            "  created_at timestamp [default: `now()`]\n"
            "\n"
            "  Note: 'Main users table'\n"
            "}\n\n"
            "Table posts {\n"
            "  id integer [pk, increment]\n"
            "  title varchar [not null]\n"
            "  body text\n"
            "  status post_status [not null, default: 'draft']\n"
            "  user_id integer [not null]\n"
            "  created_at timestamp [default: `now()`]\n"
            "\n"
            "  indexes {\n"
            "    user_id\n"
            "    (user_id, status)\n"
            "    created_at\n"
            "  }\n"
            "}\n\n"
            "Enum post_status {\n"
            "  draft\n"
            "  published\n"
            "  archived [note: 'Not visible to users']\n"
            "}\n\n"
            "Ref: posts.user_id > users.id\n\n"
            "COMMON ERRORS THAT CAUSE PROBLEMS (NEVER do this):\n\n"
            "ERROR 1 - Forgetting braces in table definitions:\n"
            "  WRONG:   Table users\n"
            "             id integer\n"
            "  CORRECT: Table users {\n"
            "             id integer [pk]\n"
            "           }\n"
            "  RULE: Every Table, Enum and indexes definition requires braces { }.\n\n"
            "ERROR 2 - Using syntax from other languages:\n"
            "  WRONG:   CREATE TABLE users (id INT PRIMARY KEY);\n"
            "  WRONG:   @startuml\n"
            "  CORRECT: Table users { id integer [pk] }\n"
            "  RULE: DBML has its own syntax. DO NOT use SQL, PlantUML or Mermaid.\n\n"
            "ERROR 3 - Incorrect relationship format:\n"
            "  WRONG:   Ref: posts.user_id -> users.id\n"
            "  WRONG:   Ref: posts -> users\n"
            "  CORRECT: Ref: posts.user_id > users.id\n"
            "  RULE: Relationships use > (one to many), < (many to one), - (one to one), <> (many to many). Always specify columns.\n\n"
            "ERROR 4 - Unbalanced braces:\n"
            "  WRONG:   Table users {\n"
            "             id integer [pk]\n"
            "  CORRECT: Table users {\n"
            "             id integer [pk]\n"
            "           }\n"
            "  RULE: Every opening brace { must have a matching closing brace }.\n\n"
            "ERROR 5 - Default values without backticks for expressions:\n"
            "  WRONG:   created_at timestamp [default: now()]\n"
            "  CORRECT: created_at timestamp [default: `now()`]\n"
            "  RULE: Database expressions in default values must be wrapped in backticks.\n\n"
            "CRITICAL SYNTAX RULES:\n"
            "1. Each Table must have balanced braces { }\n"
            "2. Columns go inside the table definition, one per line\n"
            "3. Column settings go inside brackets []\n"
            "4. Relationships (Ref) can be outside tables or inline in columns\n"
            "5. Enums are defined outside tables and referenced by name\n"
            "6. DO NOT use SQL syntax (CREATE TABLE, ALTER, etc.)\n"
            "7. DO NOT use Mermaid, PlantUML or D2 syntax\n"
            "8. Comments use // for single line"
        )


def get_diagram_context(diagram_type: str, language: str) -> str:
    """Obtener contexto segun el tipo de diagrama."""
    if diagram_type == "mermaid":
        return get_mermaid_context(language)
    elif diagram_type == "d2":
        return get_d2_context(language)
    elif diagram_type == "dbml":
        return get_dbml_context(language)
    else:
        return get_plantuml_context(language)


def get_common_errors_section(diagram_type: str, language: str) -> str:
    """Retorna una seccion resumida de errores comunes a evitar para el tipo de diagrama."""
    if language == "es":
        if diagram_type == "mermaid":
            return (
                "ERRORES COMUNES A EVITAR EN MERMAID:\n"
                "1. NO usar 'class' con texto entre comillas: class \"Texto\" estilo → usar IDs sin comillas\n"
                "2. NO usar palabras reservadas como nombre de classDef: subgraph, end, default, graph, flowchart, style\n"
                "3. NO usar classDef/style en sequenceDiagram, classDiagram, erDiagram ni pie\n"
                "4. NO poner espacios en IDs de nodos — usar camelCase: procesoA, no \"proceso A\"\n"
                "5. classDef y class SIEMPRE van DESPUES de todos los nodos y conexiones\n"
                "6. Cada classDef en su propia linea"
            )
        elif diagram_type == "plantuml":
            return (
                "ERRORES COMUNES A EVITAR EN PLANTUML:\n"
                "1. NO olvidar @startuml al inicio y @enduml al final\n"
                "2. NO usar sintaxis de Mermaid (classDef, style, -->, graph TD)\n"
                "3. skinparam SIEMPRE va ANTES de los elementos del diagrama\n"
                "4. Usar comillas para nombres con espacios: participant \"Mi Servicio\" as MS\n"
                "5. Colores con # seguido del nombre o hex: #LightBlue, #4CAF50\n"
                "6. Relaciones: -> (solida), --> (punteada), ->> (asincrona)"
            )
        elif diagram_type == "d2":
            return (
                "ERRORES COMUNES A EVITAR EN D2:\n"
                "1. NO usar @startuml/@enduml — eso es PlantUML, NO D2\n"
                "2. NO usar sintaxis de Mermaid (graph TD, -->, classDef)\n"
                "3. Las llaves { } DEBEN estar balanceadas\n"
                "4. Los colores van entre comillas: \"#4CAF50\"\n"
                "5. Comentarios con # (no con // ni ')\n"
                "6. Conexiones usan -> (no --> ni ->>)"
            )
        elif diagram_type == "dbml":
            return (
                "ERRORES COMUNES A EVITAR EN DBML:\n"
                "1. NO olvidar llaves { } en definiciones de Table, Enum e indexes\n"
                "2. NO usar sintaxis SQL (CREATE TABLE, ALTER), PlantUML ni Mermaid\n"
                "3. Relaciones usan > < - <> (NO usar ->)\n"
                "4. Siempre especificar columnas en Ref: tabla.columna > tabla.columna\n"
                "5. Expresiones default entre backticks: [default: `now()`]\n"
                "6. Cada llave de apertura { debe tener su llave de cierre }\n"
                "7. NUNCA usar comillas simples (') — SIEMPRE usar comillas dobles (\") para notas, defaults y strings\n"
                "   INCORRECTO: Note: 'Mi nota'\n"
                "   CORRECTO:   Note: \"Mi nota\"\n"
                "   INCORRECTO: [default: 'valor']\n"
                "   CORRECTO:   [default: \"valor\"]\n"
                "8. NO usar DiagramView, Schemas ni Project — NO estan soportados por el renderer\n"
                "   Solo usar: Table, Enum, Ref, Note, TableGroup, indexes"
            )
        else:
            return ""
    else:
        if diagram_type == "mermaid":
            return (
                "COMMON ERRORS TO AVOID IN MERMAID:\n"
                "1. DO NOT use 'class' with quoted text: class \"Text\" style → use IDs without quotes\n"
                "2. DO NOT use reserved words as classDef names: subgraph, end, default, graph, flowchart, style\n"
                "3. DO NOT use classDef/style in sequenceDiagram, classDiagram, erDiagram or pie\n"
                "4. DO NOT put spaces in node IDs — use camelCase: processA, not \"process A\"\n"
                "5. classDef and class ALWAYS go AFTER all nodes and connections\n"
                "6. Each classDef on its own line"
            )
        elif diagram_type == "plantuml":
            return (
                "COMMON ERRORS TO AVOID IN PLANTUML:\n"
                "1. DO NOT forget @startuml at the start and @enduml at the end\n"
                "2. DO NOT use Mermaid syntax (classDef, style, -->, graph TD)\n"
                "3. skinparam ALWAYS goes BEFORE diagram elements\n"
                "4. Use quotes for names with spaces: participant \"My Service\" as MS\n"
                "5. Colors with # followed by name or hex: #LightBlue, #4CAF50\n"
                "6. Relationships: -> (solid), --> (dotted), ->> (async)"
            )
        elif diagram_type == "d2":
            return (
                "COMMON ERRORS TO AVOID IN D2:\n"
                "1. DO NOT use @startuml/@enduml — that's PlantUML, NOT D2\n"
                "2. DO NOT use Mermaid syntax (graph TD, -->, classDef)\n"
                "3. Curly braces { } MUST be balanced\n"
                "4. Colors go in quotes: \"#4CAF50\"\n"
                "5. Comments use # (not // or ')\n"
                "6. Connections use -> (not --> or ->>)"
            )
        elif diagram_type == "dbml":
            return (
                "COMMON ERRORS TO AVOID IN DBML:\n"
                "1. DO NOT forget braces { } in Table, Enum and indexes definitions\n"
                "2. DO NOT use SQL syntax (CREATE TABLE, ALTER), PlantUML or Mermaid\n"
                "3. Relationships use > < - <> (DO NOT use ->)\n"
                "4. Always specify columns in Ref: table.column > table.column\n"
                "5. Default expressions in backticks: [default: `now()`]\n"
                "6. Every opening brace { must have a matching closing brace }"
            )
        else:
            return ""


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

    if language == "es":
        return (
            f"Eres un experto en documentacion tecnica de diagramas. Analiza el siguiente "
            f"codigo de diagrama {diagram_type} y genera una descripcion profesional en {lang_text}.\n\n"
            f"Codigo del diagrama:\n```{diagram_type}\n{diagram_code}\n```\n\n"
            "INSTRUCCIONES:\n"
            "1. Genera la descripcion en formato Markdown bien estructurado\n"
            "2. Usa encabezados descriptivos con ## para organizar el contenido "
            "(ej: ## Arquitectura del Sistema, ## Flujo de Autenticacion, ## Componentes Principales)\n"
            "3. Los titulos deben ser especificos al contenido del diagrama, NO genericos\n"
            "4. Usa **negritas** para resaltar nombres de componentes, servicios o conceptos clave\n"
            "5. Usa listas con viñetas (- ) para enumerar elementos cuando sea apropiado\n"
            "6. Explica las relaciones y flujos entre componentes\n"
            "7. La descripcion debe tener entre 150-600 palabras\n"
            "8. Escribe de forma profesional pero comprensible\n\n"
            "FORMATO DE SALIDA: Devuelve UNICAMENTE Markdown puro. "
            "NO incluyas bloques de codigo (```), NO incluyas 'markdown' como prefijo. "
            "Comienza directamente con el primer encabezado ##."
        )
    else:
        return (
            f"You are an expert in technical diagram documentation. Analyze the following "
            f"{diagram_type} diagram code and generate a professional description in {lang_text}.\n\n"
            f"Diagram code:\n```{diagram_type}\n{diagram_code}\n```\n\n"
            "INSTRUCTIONS:\n"
            "1. Generate the description in well-structured Markdown format\n"
            "2. Use descriptive ## headings to organize content "
            "(e.g.: ## System Architecture, ## Authentication Flow, ## Main Components)\n"
            "3. Headings must be specific to the diagram content, NOT generic\n"
            "4. Use **bold** to highlight component names, services, or key concepts\n"
            "5. Use bullet lists (- ) to enumerate elements when appropriate\n"
            "6. Explain relationships and flows between components\n"
            "7. The description should be between 150-600 words\n"
            "8. Write professionally but understandably\n\n"
            "OUTPUT FORMAT: Return ONLY pure Markdown. "
            "Do NOT include code blocks (```), do NOT include 'markdown' as prefix. "
            "Start directly with the first ## heading."
        )


DESCRIPTION_SYSTEM_PROMPT = (
    "You are an expert in analyzing and documenting technical diagrams. "
    "Generate well-structured Markdown descriptions with descriptive headings, "
    "bold key terms, and bullet lists. Never wrap output in code blocks."
)


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

    if language == "es":
        return (
            f"Eres un experto en documentacion tecnica de diagramas. El usuario tiene un diagrama "
            f"{diagram_type} con una descripcion existente y quiere refinarla.\n\n"
            f"Codigo del diagrama:\n```{diagram_type}\n{diagram_code}\n```\n\n"
            f"Descripcion actual:\n{current_description}\n\n"
            f"Instruccion del usuario:\n{refinement_request}\n\n"
            f"Genera la descripcion refinada en {lang_text} aplicando los cambios solicitados.\n\n"
            "REGLAS DE FORMATO:\n"
            "- Usa encabezados ## descriptivos y especificos al contenido\n"
            "- Usa **negritas** para componentes y conceptos clave\n"
            "- Usa listas con viñetas cuando sea apropiado\n"
            "- Mantén el formato Markdown bien estructurado\n\n"
            "FORMATO DE SALIDA: Devuelve UNICAMENTE Markdown puro. "
            "NO incluyas bloques de codigo (```). Comienza directamente con el contenido."
        )
    else:
        return (
            f"You are an expert in technical diagram documentation. The user has a "
            f"{diagram_type} diagram with an existing description and wants to refine it.\n\n"
            f"Diagram code:\n```{diagram_type}\n{diagram_code}\n```\n\n"
            f"Current description:\n{current_description}\n\n"
            f"User instruction:\n{refinement_request}\n\n"
            f"Generate the refined description in {lang_text} applying the requested changes.\n\n"
            "FORMAT RULES:\n"
            "- Use descriptive ## headings specific to the content\n"
            "- Use **bold** for components and key concepts\n"
            "- Use bullet lists when appropriate\n"
            "- Keep well-structured Markdown format\n\n"
            "OUTPUT FORMAT: Return ONLY pure Markdown. "
            "Do NOT include code blocks (```). Start directly with the content."
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
    context = get_diagram_context(diagram_type, language)
    if language == "es":
        return (
            f"Eres un asistente experto en diagramas {diagram_type}. El usuario esta trabajando "
            f"en el siguiente diagrama y quiere conversar sobre el.\n\n"
            f"{context}\n\n"
            f"DIAGRAMA ACTUAL:\n```\n{diagram_code}\n```\n\n"
            f"Responde de forma clara y util en espanol. Cuando generes codigo de diagrama, "
            f"usa EXCLUSIVAMENTE sintaxis {diagram_type} valida. No modifiques el diagrama a menos que se te pida explicitamente."
        )
    else:
        return (
            f"You are an expert assistant in {diagram_type} diagrams. The user is working on "
            f"the following diagram and wants to discuss it.\n\n"
            f"{context}\n\n"
            f"CURRENT DIAGRAM:\n```\n{diagram_code}\n```\n\n"
            f"Respond clearly and helpfully in English. When generating diagram code, "
            f"use EXCLUSIVELY valid {diagram_type} syntax. Do not modify the diagram unless explicitly asked."
        )


def build_unified_chat_prompt(
    diagram_code: str,
    diagram_type: str,
    language: str = "es"
) -> str:
    """System prompt unificado que detecta intencion automaticamente."""
    context = get_diagram_context(diagram_type, language)
    common_errors = get_common_errors_section(diagram_type, language)

    if language == "es":
        lang_instruction = (
            "IDIOMA DE RESPUESTA:\n"
            "DEBES responder SIEMPRE en espanol. Toda explicacion, comentario y texto "
            "debe estar en espanol. Los nombres de elementos dentro del codigo del diagrama "
            "tambien deben estar en espanol cuando sea posible.\n\n"
        )

        complete_code_instruction = (
            "CODIGO COMPLETO OBLIGATORIO:\n"
            "Cuando generes o modifiques codigo de diagrama, SIEMPRE incluye el codigo COMPLETO "
            "del diagrama, no fragmentos parciales. El usuario reemplazara todo el codigo actual "
            "con tu respuesta, por lo que omitir partes causara perdida de contenido. "
            "Nunca uses comentarios como '// ... resto del codigo ...' o '/* codigo anterior */'. "
            "Incluye TODAS las definiciones, conexiones, estilos y configuraciones.\n\n"
        )

        return (
            f"Eres un asistente experto en diagramas {diagram_type}. El usuario esta trabajando "
            f"en el siguiente diagrama.\n\n"
            f"DIAGRAMA ACTUAL:\n```{diagram_type}\n{diagram_code}\n```\n\n"
            f"{context}\n\n"
            f"{common_errors}\n\n"
            f"{complete_code_instruction}"
            f"{lang_instruction}"
            "INSTRUCCIONES DE COMPORTAMIENTO:\n"
            "Debes detectar automaticamente la intencion del usuario:\n\n"
            "1. Si el usuario PREGUNTA, ANALIZA o PIDE EXPLICACION sobre el diagrama "
            "(ej: 'que hace este diagrama?', 'explicame el flujo', 'que componentes tiene?'), "
            "responde con texto explicativo en espanol. NO incluyas codigo de diagrama.\n\n"
            "2. Si el usuario PIDE MODIFICAR, CREAR, AGREGAR, QUITAR o CAMBIAR algo del diagrama "
            "(ej: 'agrega un nodo', 'cambia el color', 'mejora el diagrama', 'agrega autenticacion'), "
            "genera el diagrama completo modificado. En este caso tu respuesta DEBE seguir este formato exacto:\n\n"
            "Breve explicacion de los cambios realizados.\n\n"
            "<<<DIAGRAM>>>\n"
            "(codigo completo del diagrama modificado aqui)\n"
            "<<<END_DIAGRAM>>>\n\n"
            "REGLAS CRITICAS:\n"
            "- Los delimitadores <<<DIAGRAM>>> y <<<END_DIAGRAM>>> deben estar en lineas separadas\n"
            "- El codigo del diagrama debe ser 100% valido segun la referencia de sintaxis\n"
            "- Siempre incluye el diagrama COMPLETO, no solo los cambios\n"
            "- Si no estas seguro de la intencion, responde con texto y pregunta si quiere que modifiques el diagrama\n"
            "- Responde siempre en espanol"
        )
    else:
        lang_instruction = (
            "RESPONSE LANGUAGE:\n"
            "You MUST ALWAYS respond in English. All explanations, comments and text "
            "must be in English. Element names within the diagram code "
            "should also be in English when possible.\n\n"
        )

        complete_code_instruction = (
            "COMPLETE CODE REQUIRED:\n"
            "When generating or modifying diagram code, ALWAYS include the COMPLETE "
            "diagram code, not partial fragments. The user will replace all current code "
            "with your response, so omitting parts will cause content loss. "
            "Never use comments like '// ... rest of code ...' or '/* previous code */'. "
            "Include ALL definitions, connections, styles and configurations.\n\n"
        )

        return (
            f"You are an expert assistant in {diagram_type} diagrams. The user is working on "
            f"the following diagram.\n\n"
            f"CURRENT DIAGRAM:\n```{diagram_type}\n{diagram_code}\n```\n\n"
            f"{context}\n\n"
            f"{common_errors}\n\n"
            f"{complete_code_instruction}"
            f"{lang_instruction}"
            "BEHAVIOR INSTRUCTIONS:\n"
            "You must automatically detect the user's intent:\n\n"
            "1. If the user ASKS, ANALYZES or REQUESTS EXPLANATION about the diagram "
            "(e.g.: 'what does this diagram do?', 'explain the flow', 'what components does it have?'), "
            "respond with explanatory text in English. Do NOT include diagram code.\n\n"
            "2. If the user ASKS TO MODIFY, CREATE, ADD, REMOVE or CHANGE something in the diagram "
            "(e.g.: 'add a node', 'change the color', 'improve the diagram', 'add authentication'), "
            "generate the complete modified diagram. In this case your response MUST follow this exact format:\n\n"
            "Brief explanation of the changes made.\n\n"
            "<<<DIAGRAM>>>\n"
            "(complete modified diagram code here)\n"
            "<<<END_DIAGRAM>>>\n\n"
            "CRITICAL RULES:\n"
            "- The delimiters <<<DIAGRAM>>> and <<<END_DIAGRAM>>> must be on separate lines\n"
            "- The diagram code must be 100% valid according to the syntax reference\n"
            "- Always include the COMPLETE diagram, not just the changes\n"
            "- If unsure about intent, respond with text and ask if they want you to modify the diagram\n"
            "- Always respond in English"
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


def extract_fix_delimited(response_text: str, provider_name: str) -> dict:
    """
    Extraer respuesta de fix usando delimitadores <<<SECTION>>>.
    
    Usado para DBML y otros lenguajes donde JSON es problemático
    por el uso extensivo de llaves {}.
    
    Returns:
        Dict con corrected_code, explanation, changes_summary
    """
    text = response_text.strip()
    
    result = {}
    
    # Extract explanation
    if "<<<EXPLANATION>>>" in text and "<<<END_EXPLANATION>>>" in text:
        start = text.index("<<<EXPLANATION>>>") + len("<<<EXPLANATION>>>")
        end = text.index("<<<END_EXPLANATION>>>")
        result["explanation"] = text[start:end].strip()
    elif "<<<EXPLANATION>>>" in text:
        start = text.index("<<<EXPLANATION>>>") + len("<<<EXPLANATION>>>")
        # Find next delimiter or end
        next_delim = text.find("<<<", start)
        result["explanation"] = text[start:next_delim].strip() if next_delim > start else text[start:].strip()
    
    # Extract changes summary
    if "<<<CHANGES>>>" in text and "<<<END_CHANGES>>>" in text:
        start = text.index("<<<CHANGES>>>") + len("<<<CHANGES>>>")
        end = text.index("<<<END_CHANGES>>>")
        result["changes_summary"] = text[start:end].strip()
    elif "<<<CHANGES>>>" in text:
        start = text.index("<<<CHANGES>>>") + len("<<<CHANGES>>>")
        next_delim = text.find("<<<", start)
        result["changes_summary"] = text[start:next_delim].strip() if next_delim > start else text[start:].strip()
    
    # Extract code
    if "<<<CODE>>>" in text and "<<<END_CODE>>>" in text:
        start = text.index("<<<CODE>>>") + len("<<<CODE>>>")
        end = text.index("<<<END_CODE>>>")
        result["corrected_code"] = text[start:end].strip()
    elif "<<<CODE>>>" in text:
        start = text.index("<<<CODE>>>") + len("<<<CODE>>>")
        result["corrected_code"] = text[start:].strip()
    
    # Validate required fields
    if "corrected_code" not in result or not result["corrected_code"]:
        # Fallback: try to find code in markdown block
        import re
        code_match = re.search(r'```(?:dbml)?\s*\n(.*?)```', text, re.DOTALL)
        if code_match:
            result["corrected_code"] = code_match.group(1).strip()
        else:
            raise ValueError(
                f"No se pudo extraer el código corregido de la respuesta de {provider_name}"
            )
    
    # Clean code from markdown fences if present
    result["corrected_code"] = clean_code_response(result["corrected_code"])
    
    # Set defaults for missing fields
    if "explanation" not in result:
        result["explanation"] = "Código corregido"
    if "changes_summary" not in result:
        result["changes_summary"] = "Corrección de sintaxis aplicada"
    
    return result


def extract_fix_json(response_text: str, provider_name: str) -> dict:
    """
    Extraer y parsear JSON de la respuesta de IA para fix_diagram.

    Maneja correctamente respuestas que contienen código D2 (con llaves anidadas)
    u otros lenguajes que usan {} en su sintaxis.

    Args:
        response_text: Texto crudo de la respuesta del modelo
        provider_name: Nombre del proveedor (para mensajes de error)

    Returns:
        Dict con corrected_code, explanation, changes_summary

    Raises:
        ValueError: Si no se puede extraer o parsear el JSON
    """
    import json
    import re

    text = response_text.strip()

    # 1. Remover bloques de código markdown que envuelvan el JSON
    md_match = re.match(r'^```(?:json)?\s*\n(.*?)```\s*$', text, re.DOTALL)
    if md_match:
        text = md_match.group(1).strip()

    # 2. Intentar parsear directamente (caso ideal: respuesta es solo JSON)
    try:
        result = json.loads(text)
        if isinstance(result, dict):
            _validate_fix_fields(result, provider_name)
            return result
    except json.JSONDecodeError:
        pass

    # 3. Buscar JSON con balance de llaves (maneja llaves anidadas en D2/PlantUML)
    result = _extract_balanced_json(text)
    if result is not None:
        _validate_fix_fields(result, provider_name)
        return result

    # 4. Fallback: intentar regex greedy (último recurso)
    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        try:
            result = json.loads(json_match.group())
            if isinstance(result, dict):
                _validate_fix_fields(result, provider_name)
                return result
        except json.JSONDecodeError:
            pass

    raise ValueError(
        f"No se pudo extraer JSON de la respuesta de {provider_name}"
    )


def _extract_balanced_json(text: str) -> dict | None:
    """
    Extraer el primer objeto JSON con llaves balanceadas del texto.

    Recorre el texto carácter por carácter, rastreando la profundidad de llaves
    y respetando strings JSON (donde las llaves no cuentan).
    """
    import json

    start = text.find('{')
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape_next = False
    i = start

    while i < len(text):
        char = text[i]

        if escape_next:
            escape_next = False
            i += 1
            continue

        if char == '\\' and in_string:
            escape_next = True
            i += 1
            continue

        if char == '"' and not escape_next:
            in_string = not in_string
            i += 1
            continue

        if not in_string:
            if char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    candidate = text[start:i + 1]
                    try:
                        result = json.loads(candidate)
                        if isinstance(result, dict):
                            return result
                    except json.JSONDecodeError:
                        # Este bloque balanceado no es JSON válido,
                        # buscar el siguiente '{'
                        start = text.find('{', i + 1)
                        if start == -1:
                            return None
                        i = start
                        depth = 0
                        continue

        i += 1

    return None


def _validate_fix_fields(result: dict, provider_name: str) -> None:
    """Validar que el dict tenga los campos requeridos para fix_diagram."""
    for field in ("corrected_code", "explanation", "changes_summary"):
        if field not in result:
            raise ValueError(
                f"Respuesta de {provider_name} no contiene '{field}'"
            )
