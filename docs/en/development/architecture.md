# Architecture

DiagramaHub is a modular monorepo with a **React 19 + Vite 7** frontend, a **FastAPI + MongoDB** API and **[Kroki](https://kroki.io/)** to render on the server the languages that aren't drawn in the browser. Everything is orchestrated with Docker Compose.

## Services

```mermaid
flowchart LR
    U["Browser"] -->|HTTP :5173| FE["Frontend<br/>React 19 + Vite"]
    FE -->|"REST /api/v1 :5172"| BE["Backend<br/>FastAPI"]
    BE -->|Beanie / Motor| DB[("MongoDB 8")]
    BE -->|"POST SVG"| KR["Kroki<br/>(internal network)"]
    BE -.->|HTTPS| AI["AI providers<br/>Gemini · OpenAI · Claude · DeepSeek · MiniMax"]
    BE -.->|HTTPS| EXT["Stripe · Resend · Google OAuth · Sentry"]
```

| Service | Technology | Purpose |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite 7 + TailwindCSS v3 | UI, Monaco editor, client-side Mermaid rendering, whiteboard |
| Backend | FastAPI (`python:3.13-alpine` image) | API, business logic, Kroki proxy, AI calls |
| Kroki | `yuzutech/kroki` image | Server-side rendering of PlantUML, D2 and DBML |
| MongoDB | MongoDB 8 (or external in `external-mongodb` mode) | Persistence |

Third-party services (AI, Stripe, Resend, Google, Sentry) are optional: they are enabled by the operator's configuration or by each user's own API key (BYOL).

## Request flow

The backend follows a layered architecture with dependency inversion: routes only translate HTTP, services depend on **interfaces**, and repositories are the only layer that touches MongoDB.

```mermaid
sequenceDiagram
    participant R as React (page)
    participant A as services/api.ts (Axios)
    participant RT as routes.py
    participant S as services.py
    participant RP as repository.py
    participant M as MongoDB
    R->>A: apiService.getProject(id)
    A->>RT: GET /api/v1/projects/{id} + Bearer JWT
    RT->>RT: Depends(get_current_user_id) checks the token
    RT->>S: get_project(id, user_id)
    S->>RP: IProjectRepository interface
    RP->>M: Beanie query
    M-->>RP: document
    RP-->>S: InDB model
    S-->>RT: Response schema (Pydantic)
    RT-->>A: 200 JSON
    A-->>R: typed data
```

If the API answers `401`, the Axios interceptor removes the token from `localStorage` and the app goes back to the login page.

## Diagram rendering

Mermaid is drawn in the browser; PlantUML, D2 and DBML are sent to the backend, which forwards them to Kroki and returns an SVG. Content never leaves your installation: Kroki runs inside the Docker network.

```mermaid
flowchart TD
    E["Code in the editor"] --> T{"diagram_type"}
    T -->|mermaid| MC["mermaid library<br/>in the browser"]
    T -->|"plantuml · d2 · dbml"| API["POST /api/v1/diagrams/render"]
    API --> V["Validation and rate limit<br/>(DiagramService)"]
    V --> K["Kroki"]
    K -->|SVG| API
    MC --> P["SVG preview"]
    API -->|"image/svg+xml"| P
```

`/diagrams/render` is public (shared-link pages use it too), so it has its own per-IP rate limit (`diagrams/rate_limiter.py`).

## AI chat flow

The chat is the only UI entry point for generating or modifying diagrams with AI. The reply is streamed (Server-Sent Events, `chat_sessions/sse_events.py`).

```mermaid
sequenceDiagram
    participant UI as AIChatPanel
    participant API as /chat-sessions/{id}/messages/stream
    participant S as ChatSessionService
    participant AI as AI client (BaseAIClient)
    participant K as Kroki
    UI->>API: message + current code
    API->>S: stream_message()
    S->>S: guesses the mode (question vs. code)
    S->>S: compacts the context near the model's window
    S->>AI: unified prompt (8192 tokens max)
    AI-->>S: tokens
    S-->>UI: token / phase / mode events
    S->>S: looks for DIAGRAM markers or a typed block
    alt the reply carries a diagram
        opt D2 with auto-fix on
            S->>K: validates
            K-->>S: error, the model is asked for a fix
        end
        S-->>UI: done (code + text)
    else truncated reply
        S-->>UI: notice, the code is not applied
    end
```

Key points:

- **Markers**: the model wraps the code in `<<<DIAGRAM>>>` / `<<<END_DIAGRAM>>>` (or `<<<DIAGRAMA>>>` / `<<<END_DIAGRAMA>>>`). A reply with markers is always handled as code, even if the guessed mode was "question"; a block tagged with the diagram type holding a whole diagram counts too (except in Explain mode).
- **Truncation**: a reply cut at the token limit is never applied as code; the generation API answers `422 response_truncated` and an empty one `502 empty_response`.
- **Validation**: D2 is validated with Kroki on the server; Mermaid with the real parser in the browser, which asks the model once for a fix. PlantUML and DBML are not retried (they produced false positives). Everything obeys the user's `auto_fix_generated` setting.
- `<think>` tags from reasoning models are stripped.

## Repository layout

```text
diagramahub/
├── backend/            # FastAPI + Beanie (Poetry)
│   ├── app/
│   │   ├── main.py     # app, lifespan, middlewares, router registration
│   │   ├── core/       # config, security, rate limit, request limits
│   │   └── api/        # deps.py + v1/<module>/
│   └── tests/
├── frontend/           # React 19 + Vite 7 (pnpm)
│   └── src/
├── deploy/
│   ├── local-full/         # MongoDB 8 + Kroki + Backend + Frontend
│   └── external-mongodb/   # Kroki + Backend + Frontend (external MongoDB)
├── docs/               # this site (MkDocs Material)
├── scripts/            # check-version.sh, ai-benchmark/, test-helpers.sh
└── docker-compose.yml  # symlink to the deployment mode
```

More detail in [Backend](backend.md) and [Frontend](frontend.md).
