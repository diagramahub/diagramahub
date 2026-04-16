# Welcome to DiagramaHub

Welcome to the official documentation for the **DiagramaHub** codebase!

This documentation is built with [MkDocs](https://squidfunk.github.io/mkdocs-material/) and is designed to be the single source of truth for all developers working on the project.

## What is DiagramaHub?

DiagramaHub is an open-source platform for creating, organizing, and exporting diagrams using plain text markup (Mermaid, PlantUML). It targets developers and teams who prefer text-based diagramming.

## Key Features

- **Text-to-diagram**: Mermaid and PlantUML support with real-time rendering.
- **Organization**: Projects, folders, and hierarchical navigation.
- **Flexible export**: PNG, PDF, and Markdown.
- **AI generation (BYOL)**: Create and improve diagrams with your own LLM key (Gemini, OpenAI, Claude, DeepSeek).
- **AI chat**: Iterative chat sessions for diagram refinement.
- **Prompt history**: Full log of all AI interactions.
- **Diagram sharing**: Public links protected with access codes.
- **Subscriptions and billing**: Plan system with Stripe integration.
- **Authentication**: JWT with registration, login, password reset, and account deletion flows.
- **Onboarding**: Installation wizard and new-user onboarding.
- **Presentation mode**: Full-screen diagram viewing with annotations.
- **Multi-language**: Spanish (default) and English.
- **Admin panel**: Email vendor and integration configuration.
- **Self-hostable**: Full deployment via Docker Compose.

## What will you find here?

In these manuals you can discover:

* **Installation Guide:** How to deploy DiagramaHub with the automatic installer or manually.
* **Architecture:** How the frontend and backend communicate.
* **Tech Stack:** Technologies, dependencies, and project tooling.

## Main Repository Structure

```text
diagramahub/
├── frontend/               # React 19 + TypeScript + Vite 7 web app
├── backend/                # FastAPI + MongoDB (Beanie ODM) REST API
├── deploy/                 # Docker Compose configurations
│   ├── local-full/         # MongoDB 8 + Backend + Frontend
│   └── external-mongodb/   # Backend + Frontend (external MongoDB)
├── docs/                   # This documentation (MkDocs Material)
├── install.sh              # Interactive one-line installer
├── verify-installation.sh  # Post-installation verification script
├── test-api.sh             # API test script
├── test-onboarding.sh      # Onboarding flow test script
├── docker-compose.yml      # Symlinked to chosen deploy mode
├── mkdocs.yml              # MkDocs configuration
├── INSTALL.md              # Detailed installation guide
├── STRIPE_QUICKSTART.md    # Stripe configuration quickstart
├── README.md               # Main project readme
└── LICENSE                 # Apache License 2.0
```

## Tech Stack

### Backend

| Technology | Version / Detail |
|---|---|
| Python | 3.11+ |
| FastAPI | 0.115+ |
| MongoDB | 8 (via Docker) |
| Beanie ODM | 1.27+ (Motor async driver) |
| Pydantic | v2 |
| Authentication | JWT (python-jose) + BCrypt (passlib) |
| Payments | Stripe SDK 11+ |
| AI Clients | google-genai, httpx (OpenAI, Claude, DeepSeek) |
| Email | Resend (async) |
| Dependencies | Poetry 1.8+ |
| Linting | Ruff (line-length 100, target py311) |
| Formatting | Black (line-length 100, target py311) |
| Type checking | mypy |
| Testing | pytest + pytest-asyncio + pytest-cov + Hypothesis + Faker |

### Frontend

| Technology | Version / Detail |
|---|---|
| React | 19 |
| TypeScript | 5.9+ |
| Vite | 7 |
| TailwindCSS | v3 |
| React Router | v7 |
| Axios | HTTP client with interceptors |
| i18next | Spanish (default) and English |
| Mermaid | 11+ |
| PlantUML | via plantuml-encoder |
| Monaco Editor | Code editor |
| react-markdown | Markdown rendering |
| ESLint | typescript-eslint |

### Infrastructure

| Aspect | Detail |
|---|---|
| Containers | Docker Compose |
| Deploy modes | `deploy/local-full/` and `deploy/external-mongodb/` |
| Hot reload (dev) | Backend: uvicorn `--reload`, Frontend: Vite HMR |
| Production | Reverse proxy (Nginx/Traefik) recommended for SSL |

## Ports

| Service | Port |
|---|---|
| Frontend | 5173 |
| Backend | 5172 |
| MongoDB | 27017 (local-full mode only) |

## Backend Modules

The backend follows SOLID principles. Each entity lives in its own folder under `backend/app/api/v1/`:

| Module | Description |
|---|---|
| `users/` | Authentication, registration, password management, account deletion |
| `projects/` | Project CRUD |
| `diagrams/` | Diagram CRUD, AI fix service, syntax validation |
| `folders/` | Folder CRUD |
| `ai_providers/` | AI provider configuration, LLM clients (Gemini, OpenAI, Claude, DeepSeek) |
| `chat_sessions/` | AI chat session management |
| `subscriptions/` | Stripe billing, plans, webhooks, payment providers |
| `shared_links/` | Public diagram sharing, rate limiting |
| `prompt_history/` | AI prompt history tracking |
| `integrations/` | Email vendor configuration (admin) |

## Frontend Routes

| Route | Description | Protected |
|---|---|---|
| `/setup` | Initial installation wizard | No |
| `/login` | Login page | No |
| `/register` | Registration page | No |
| `/forgot-password` | Password recovery | No |
| `/reset-password` | Password reset | No |
| `/shared/:token` | Public shared diagram | No |
| `/onboarding` | Onboarding wizard | Yes |
| `/dashboard` | User dashboard | Yes |
| `/projects/:projectId` | Project view | Yes |
| `/projects/:projectId/diagrams/:diagramId` | Diagram editor | Yes |
| `/profile` | User profile | Yes |
| `/` | Redirect to `/dashboard` | — |

---

*To serve this documentation locally:*
```bash
pip install mkdocs mkdocs-material
mkdocs serve
```
