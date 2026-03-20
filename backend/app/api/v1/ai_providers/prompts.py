"""
Módulo centralizado de prompts para todos los proveedores de IA.
Contiene todas las plantillas de prompts y funciones de construcción
utilizadas por los clientes de IA (OpenAI, Claude, Gemini, DeepSeek).
"""
from typing import Optional


# ------------------------------------------------------------------ #
#  Contexto de tipos de diagrama
# ------------------------------------------------------------------ #

MERMAID_CONTEXT_ES = """REFERENCIA DE SINTAXIS MERMAID (solo usar estas construcciones):

TIPOS DE DIAGRAMA: flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, gitGraph

FLOWCHART - SINTAXIS VÁLIDA:
- Dirección: flowchart TD | TB | BT | LR | RL
- Nodos: A[Rectángulo], B(Redondeado), C{Rombo}, D((Círculo)), E([Estadio]), F[[Subrutina]], G[(Base de datos)], H{{Hexágono}}
- Flechas: A --> B, A --- B, A -.-> B, A ==> B
- Etiquetas: A -->|texto| B, A -- texto --> B
- Subgrafos: subgraph idSinEspacios["Título Visible"]  ...  end

ESTILOS VÁLIDOS EN FLOWCHART (definir DESPUÉS de todos los nodos y conexiones):
- classDef nombreEstilo fill:#hex,stroke:#hex,stroke-width:2px,color:#hex
- class nodoA,nodoB nombreEstilo
- style nodoA fill:#hex,stroke:#hex,color:#hex
- style idSubgraph fill:#hex,stroke:#hex (para colorear subgrafos)

EJEMPLO CORRECTO CON ESTILOS Y SUBGRAFOS:
flowchart TD
    subgraph frontend["Capa Frontend"]
        A[Navegador] --> B[React App]
    end
    subgraph backend["Capa Backend"]
        C[API REST] --> D[(Base de Datos)]
    end
    B --> C
    classDef uiStyle fill:#4CAF50,stroke:#388E3C,color:#fff
    classDef apiStyle fill:#2196F3,stroke:#1565C0,color:#fff
    classDef dbStyle fill:#FF9800,stroke:#F57C00,color:#fff
    class A,B uiStyle
    class C apiStyle
    class D dbStyle
    style frontend fill:#E8F5E9,stroke:#4CAF50
    style backend fill:#E3F2FD,stroke:#2196F3

ERRORES COMUNES QUE CAUSAN PARSE ERROR (NUNCA hacer esto):
- class "Texto con espacios" miEstilo     ← INCORRECTO: class NO acepta comillas
- class A,B,C miEstilo                    ← CORRECTO: solo IDs de nodos sin comillas
- classDef subgraph fill:#ccc             ← INCORRECTO: subgraph es palabra reservada
- classDef sgStyle fill:#ccc              ← CORRECTO: usar otro nombre
- classDef default fill:#ccc              ← INCORRECTO: default es palabra reservada
- classDef defaultStyle fill:#ccc         ← CORRECTO: usar otro nombre
- classDef end fill:#ccc                  ← INCORRECTO: end es palabra reservada

SEQUENCEDIAGRAM - NO soporta classDef/style. Usa:
- participant Nombre as Alias
- activate/deactivate
- rect rgb(200, 220, 255)  ...  end (para resaltar bloques)
REGLAS CRÍTICAS DE SINTAXIS:
1. Los IDs de nodos NO pueden tener espacios ni caracteres especiales (usar camelCase o guiones bajos)
2. classDef y class van DESPUÉS de todas las conexiones
3. En colores hex SIEMPRE usar # seguido de 3 o 6 caracteres (ej: #fff, #4CAF50)
4. NO mezclar sintaxis de diferentes tipos de diagrama
5. En sequenceDiagram NO usar classDef ni style
6. Texto con caracteres especiales va entre comillas: A["Texto con (paréntesis)"]

ERRORES COMUNES QUE CAUSAN PARSE ERROR (NUNCA hacer esto):

ERROR 1 - class con texto entre comillas:
  ❌ INCORRECTO: class "Entorno de Desarrollo" estiloVerde
  ✅ CORRECTO:   class entornoDesarrollo estiloVerde
  REGLA: El comando 'class' solo acepta IDs de nodos (sin comillas, sin espacios).

ERROR 2 - classDef con nombre 'subgraph':
  ❌ INCORRECTO: classDef subgraph fill:#F0F9FF,stroke:#1E40AF
  ✅ CORRECTO:   classDef subgrafo fill:#F0F9FF,stroke:#1E40AF
  ✅ CORRECTO:   classDef grupo fill:#F0F9FF,stroke:#1E40AF
  REGLA: 'subgraph' es palabra reservada de Mermaid. Usar otro nombre como 'grupo', 'subgrafo', 'contenedor'.

ERROR 3 - classDef con nombre 'default':
  ❌ INCORRECTO: classDef default fill:#FFFFFF,stroke:#333
  ✅ CORRECTO:   classDef base fill:#FFFFFF,stroke:#333
  ✅ CORRECTO:   classDef normal fill:#FFFFFF,stroke:#333
  REGLA: 'default' es palabra reservada. Usar otro nombre como 'base', 'normal', 'estandar'.

PALABRAS RESERVADAS que NO se pueden usar como nombre de classDef:
subgraph, end, default, graph, flowchart, click, style, linkStyle, callback"""
1. IDs de nodos sin espacios (camelCase: procesoA). Texto visible entre corchetes: procesoA["Proceso A"]
2. classDef y class van DESPUÉS de todas las conexiones
3. class SOLO acepta IDs de nodos: class A,B estilo. NUNCA: class "texto" estilo
4. Nombres de classDef NO pueden ser palabras reservadas: subgraph, end, class, style, graph, flowchart, default
5. Para colorear subgrafos: style idSubgraph fill:#color,stroke:#color
6. Colores hex: # + 3 o 6 chars (#fff, #4CAF50)
7. En sequenceDiagram NO usar classDef ni style
8. Cada classDef en su propia línea"""

MERMAID_CONTEXT_EN = """MERMAID SYNTAX REFERENCE (only use these constructs):

DIAGRAM TYPES: flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, gitGraph

FLOWCHART - VALID SYNTAX:
- Direction: flowchart TD | TB | BT | LR | RL
- Nodes: A[Rectangle], B(Rounded), C{Diamond}, D((Circle)), E([Stadium]), F[[Subroutine]], G[(Database)], H{{Hexagon}}
- Arrows: A --> B, A --- B, A -.-> B, A ==> B
- Labels: A -->|text| B, A -- text --> B
- Subgraphs: subgraph idNoSpaces["Visible Title"]  ...  end

VALID STYLES IN FLOWCHART (define AFTER all nodes and connections):
- classDef styleName fill:#hex,stroke:#hex,stroke-width:2px,color:#hex
- class nodeA,nodeB styleName
- style nodeA fill:#hex,stroke:#hex,color:#hex
CRITICAL SYNTAX RULES:
1. Node IDs CANNOT have spaces or special characters (use camelCase or underscores)
2. classDef and class go AFTER all connections
3. In hex colors ALWAYS use # followed by 3 or 6 characters (e.g., #fff, #4CAF50)
4. DO NOT mix syntax from different diagram types
5. In sequenceDiagram DO NOT use classDef or style
6. Text with special characters goes in quotes: A["Text with (parentheses)"]

COMMON ERRORS THAT CAUSE PARSE ERRORS (NEVER do this):

ERROR 1 - class with quoted text:
  ❌ WRONG:   class "Development Environment" greenStyle
  ✅ CORRECT: class devEnvironment greenStyle
  RULE: The 'class' command only accepts node IDs (no quotes, no spaces).

ERROR 2 - classDef named 'subgraph':
  ❌ WRONG:   classDef subgraph fill:#F0F9FF,stroke:#1E40AF
  ✅ CORRECT: classDef groupStyle fill:#F0F9FF,stroke:#1E40AF
  ✅ CORRECT: classDef container fill:#F0F9FF,stroke:#1E40AF
  RULE: 'subgraph' is a Mermaid reserved word. Use another name like 'groupStyle', 'container', 'section'.

ERROR 3 - classDef named 'default':
  ❌ WRONG:   classDef default fill:#FFFFFF,stroke:#333
  ✅ CORRECT: classDef base fill:#FFFFFF,stroke:#333
  ✅ CORRECT: classDef normal fill:#FFFFFF,stroke:#333
  RULE: 'default' is a reserved word. Use another name like 'base', 'normal', 'standard'.

RESERVED WORDS that CANNOT be used as classDef names:
subgraph, end, default, graph, flowchart, click, style, linkStyle, callback"""
    subgraph backend["Backend Layer"]
        C[REST API] --> D[(Database)]
    end
    B --> C
    classDef uiStyle fill:#4CAF50,stroke:#388E3C,color:#fff
    classDef apiStyle fill:#2196F3,stroke:#1565C0,color:#fff
    classDef dbStyle fill:#FF9800,stroke:#F57C00,color:#fff
    class A,B uiStyle
    class C apiStyle
    class D dbStyle
    style frontend fill:#E8F5E9,stroke:#4CAF50
    style backend fill:#E3F2FD,stroke:#2196F3

COMMON ERRORS THAT CAUSE PARSE ERROR (NEVER do this):
- class "Text with spaces" myStyle        ← WRONG: class does NOT accept quotes
- class A,B,C myStyle                     ← CORRECT: only node IDs without quotes
- classDef subgraph fill:#ccc             ← WRONG: subgraph is a reserved word
- classDef sgStyle fill:#ccc              ← CORRECT: use a different name
- classDef default fill:#ccc              ← WRONG: default is a reserved word
- classDef defaultStyle fill:#ccc         ← CORRECT: use a different name
- classDef end fill:#ccc                  ← WRONG: end is a reserved word

SEQUENCEDIAGRAM - Does NOT support classDef/style. Use:
- participant Name as Alias
- activate/deactivate
- rect rgb(200, 220, 255)  ...  end (to highlight blocks)
- Note over A,B: text

CLASSDIAGRAM, ERDIAGRAM, PIE - Do NOT support classDef/style.
STATEDIAGRAM - Uses classDef similar to flowchart.
GANTT - Colors via sections, not via classDef.

CRITICAL RULES:
1. Node IDs without spaces (camelCase: processA). Visible text in brackets: processA["Process A"]
2. classDef and class go AFTER all connections
3. class ONLY accepts node IDs: class A,B style. NEVER: class "text" style
4. classDef names CANNOT be reserved words: subgraph, end, class, style, graph, flowchart, default
5. To color subgraphs: style subgraphId fill:#color,stroke:#color
6. Hex colors: # + 3 or 6 chars (#fff, #4CAF50)
7. In sequenceDiagram DO NOT use classDef or style
8. Each classDef on its own line"""
