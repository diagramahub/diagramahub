# 🏗️ Architecture

Diagramahub is built with a modular approach following **SOLID** principles.

```text
diagramahub/
├── frontend/               # React 19 + TypeScript + Vite 7 + TailwindCSS v3
├── backend/                # FastAPI + MongoDB (Beanie ODM) + Poetry
├── deploy/
│   ├── local-full/         # MongoDB 8 + Kroki + Backend + Frontend
│   └── external-mongodb/   # Kroki + Backend + Frontend (external DB)
└── docs/                   # MkDocs Material documentation (ES/EN)
```

## Services

| Service | Technology | Purpose |
|---|---|---|
| Frontend | React 19 + Vite 7 | UI, client-side Mermaid rendering |
| Backend | FastAPI + Python 3.11 | API, business logic, Kroki proxy |
| [Kroki](https://kroki.io/) | `yuzutech/kroki` Docker image | Server-side rendering for PlantUML, D2, and 20+ diagram types |
| MongoDB | MongoDB 8 (or external) | Data storage |

## Backend

Python 3.11+ · FastAPI 0.115+ · Beanie 1.27+ · Pydantic v2 · Poetry

Each domain module lives in its own folder under `backend/app/api/v1/` with a consistent structure: `interfaces.py` → `repository.py` → `services.py` → `schemas.py` → `routes.py`.

| Module | Description |
|---|---|
| `users/` | Auth, registration, password management, account deletion |
| `projects/` | Project CRUD |
| `diagrams/` | Diagram CRUD, AI fix service, syntax validation, Kroki rendering proxy |
| `folders/` | Folder CRUD |
| `ai_providers/` | AI provider config, LLM clients (Gemini, OpenAI, Claude, DeepSeek) |
| `chat_sessions/` | AI chat session management |
| `subscriptions/` | Stripe billing, plans, webhooks, payment providers |
| `shared_links/` | Public diagram sharing, rate limiting |
| `prompt_history/` | AI prompt history tracking |
| `integrations/` | Email vendor configuration (admin) |

## Frontend

React 19 · TypeScript 5.9+ · Vite 7 · TailwindCSS v3 · React Router v7

- All UI text uses i18n translation keys — Spanish and English locales.
- Auth state via React Context with JWT stored in localStorage.
- API calls through a centralized Axios service with auth interceptors.
- Protected routes via `PrivateRoute` and `InstallationGuard` components.

---

For layer-specific details, see the [Backend](backend/README.md) and [Frontend](frontend/README.md) documentation.
