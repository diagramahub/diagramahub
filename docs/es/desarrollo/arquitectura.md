# Arquitectura

DiagramaHub es un monorepo modular con un frontend en **React 19 + Vite 7**, una API en **FastAPI + MongoDB** y **[Kroki](https://kroki.io/)** para renderizar en el servidor los lenguajes que no se dibujan en el navegador. Todo se orquesta con Docker Compose.

## Servicios

```mermaid
flowchart LR
    U["Navegador"] -->|HTTP :5173| FE["Frontend<br/>React 19 + Vite"]
    FE -->|"REST /api/v1 :5172"| BE["Backend<br/>FastAPI"]
    BE -->|Beanie / Motor| DB[("MongoDB 8")]
    BE -->|"POST SVG"| KR["Kroki<br/>(red interna)"]
    BE -.->|HTTPS| AI["Proveedores de IA<br/>Gemini · OpenAI · Claude · DeepSeek · MiniMax"]
    BE -.->|HTTPS| EXT["Stripe · Resend · Google OAuth · Sentry"]
```

| Servicio | Tecnología | Propósito |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite 7 + TailwindCSS v3 | Interfaz, editor Monaco, render de Mermaid en el cliente, pizarrón |
| Backend | FastAPI (imagen `python:3.13-alpine`) | API, lógica de negocio, proxy hacia Kroki, llamadas a la IA |
| Kroki | imagen `yuzutech/kroki` | Render en el servidor de PlantUML, D2 y DBML |
| MongoDB | MongoDB 8 (o externo en el modo `external-mongodb`) | Persistencia |

Los servicios de terceros (IA, Stripe, Resend, Google, Sentry) son opcionales: se activan con la configuración del operador o con la API key de cada usuario (BYOL).

## Flujo de una petición

El backend sigue una arquitectura por capas con inversión de dependencias: las rutas solo traducen HTTP, los servicios dependen de **interfaces** y los repositorios son la única capa que toca MongoDB.

```mermaid
sequenceDiagram
    participant R as React (página)
    participant A as services/api.ts (Axios)
    participant RT as routes.py
    participant S as services.py
    participant RP as repository.py
    participant M as MongoDB
    R->>A: apiService.getProject(id)
    A->>RT: GET /api/v1/projects/{id} + Bearer JWT
    RT->>RT: Depends(get_current_user_id) valida el token
    RT->>S: get_project(id, user_id)
    S->>RP: interfaz IProjectRepository
    RP->>M: consulta Beanie
    M-->>RP: documento
    RP-->>S: modelo InDB
    S-->>RT: esquema Response (Pydantic)
    RT-->>A: 200 JSON
    A-->>R: datos tipados
```

Si la API responde `401`, el interceptor de Axios borra el token de `localStorage` y la app vuelve al login.

## Render de diagramas

Mermaid se dibuja en el navegador; PlantUML, D2 y DBML se envían al backend, que los reenvía a Kroki y devuelve un SVG. El contenido nunca sale de tu instalación: Kroki corre dentro de la red de Docker.

```mermaid
flowchart TD
    E["Código en el editor"] --> T{"diagram_type"}
    T -->|mermaid| MC["Librería mermaid<br/>en el navegador"]
    T -->|"plantuml · d2 · dbml"| API["POST /api/v1/diagrams/render"]
    API --> V["Validación y rate limit<br/>(DiagramService)"]
    V --> K["Kroki"]
    K -->|SVG| API
    MC --> P["Vista previa SVG"]
    API -->|"image/svg+xml"| P
```

`/diagrams/render` es público (lo usa también la vista de enlaces compartidos), por eso tiene su propio límite de peticiones por IP (`diagrams/rate_limiter.py`).

## Flujo del chat de IA

El chat es la única entrada de la interfaz para generar o modificar diagramas con IA. La respuesta llega por streaming (Server-Sent Events, `chat_sessions/sse_events.py`).

```mermaid
sequenceDiagram
    participant UI as AIChatPanel
    participant API as /chat-sessions/{id}/messages/stream
    participant S as ChatSessionService
    participant AI as Cliente IA (BaseAIClient)
    participant K as Kroki
    UI->>API: mensaje + código actual
    API->>S: stream_message()
    S->>S: adivina el modo (pregunta vs. código)
    S->>S: compacta el contexto si se acerca a la ventana del modelo
    S->>AI: prompt unificado (8192 tokens máx.)
    AI-->>S: tokens
    S-->>UI: eventos token / phase / mode
    S->>S: busca marcadores DIAGRAM o un bloque del tipo
    alt la respuesta trae diagrama
        opt D2 y auto-fix activo
            S->>K: valida
            K-->>S: error, se pide una corrección al modelo
        end
        S-->>UI: done (código + texto)
    else respuesta truncada
        S-->>UI: aviso, el código no se aplica
    end
```

Puntos clave:

- **Marcadores**: el modelo envuelve el código en `<<<DIAGRAM>>>` / `<<<END_DIAGRAM>>>` (o `<<<DIAGRAMA>>>` / `<<<END_DIAGRAMA>>>`). Una respuesta con marcadores siempre se trata como código, aunque el modo adivinado fuera "pregunta"; también cuenta un bloque etiquetado con el tipo de diagrama que contenga un diagrama completo (excepto en el modo Explicar).
- **Truncado**: una respuesta cortada por el límite de tokens nunca se aplica como código; la API de generación responde `422 response_truncated` y una vacía `502 empty_response`.
- **Validación**: D2 se valida con Kroki en el servidor; Mermaid con el parser real en el navegador, que pide una corrección al modelo una vez. PlantUML y DBML no se reintentan (daban falsos positivos). Todo respeta el ajuste `auto_fix_generated` del usuario.
- Las etiquetas `<think>` de los modelos de razonamiento se eliminan.

## Estructura del repositorio

```text
diagramahub/
├── backend/            # FastAPI + Beanie (Poetry)
│   ├── app/
│   │   ├── main.py     # app, lifespan, middlewares, registro de routers
│   │   ├── core/       # config, seguridad, rate limit, límites de petición
│   │   └── api/        # deps.py + v1/<módulo>/
│   └── tests/
├── frontend/           # React 19 + Vite 7 (pnpm)
│   └── src/
├── deploy/
│   ├── local-full/         # MongoDB 8 + Kroki + Backend + Frontend
│   └── external-mongodb/   # Kroki + Backend + Frontend (MongoDB externo)
├── docs/               # este sitio (MkDocs Material)
├── scripts/            # check-version.sh, ai-benchmark/, test-helpers.sh
└── docker-compose.yml  # symlink al modo de despliegue
```

Más detalle en [Backend](backend.md) y [Frontend](frontend.md).
