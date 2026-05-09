# CLAUDE.md

Diagramahub project guidance — single source of truth for AI coding assistants (Claude Code, DeepSeek TUI, Open Code, etc.).

---

## Project Overview

Diagramahub is an open-source, self-hostable platform for creating, organizing, and exporting diagrams using plain text markup (Mermaid, PlantUML, DBML). Targets developers and teams who prefer text-based diagramming. Server-side rendering via [Kroki](https://kroki.io/).

- **License**: Apache 2.0
- **Status**: Beta (v0.x) — APIs and data structures may change between versions
- **Current version**: 0.5.2
- **Repo**: https://github.com/alexdzul/diagramahub

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript 5.9+ + Vite 7 + TailwindCSS v3 |
| **Backend** | Python 3.11+ + FastAPI + Beanie ODM (MongoDB) + Poetry |
| **Database** | MongoDB 8 via Motor async driver |
| **Diagram rendering** | Mermaid (client-side), PlantUML/DBML/D2 (server-side via Kroki) |
| **Payments** | Stripe SDK |
| **AI Clients** | google-genai, httpx (OpenAI/Claude/DeepSeek/MiniMax) |
| **Email** | Resend (async) |
| **Auth** | JWT (python-jose) + BCrypt (passlib) |
| **Validation** | Pydantic v2 + pydantic-settings |
| **Testing** | pytest + pytest-asyncio + pytest-cov + Hypothesis (property-based) |
| **Lint/Format** | Ruff (line-length 100) + Black + mypy |
| **i18n** | i18next + react-i18next (Spanish default, English) |
| **Monitoring** | Sentry (conditional, backend + frontend) |
| **Infrastructure** | Docker Compose (4 services) |

## Common Commands

Everything runs via Docker Compose — no direct Poetry/npm on the host.

```bash
# Start all services
docker-compose up --build
docker-compose up -d                    # background

# Stop
docker-compose down

# Logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild a specific service
docker-compose build backend --no-cache
docker-compose build frontend --no-cache

# Shell access
docker exec -it diagramahub-backend bash
docker exec -it diagramahub-mongodb mongosh
```

### Backend (inside container)

```bash
docker exec diagramahub-backend poetry run pytest           # all tests + coverage
docker exec diagramahub-backend poetry run pytest --no-cov  # fast, no coverage
docker exec diagramahub-backend poetry run pytest -m unit
docker exec diagramahub-backend poetry run pytest -m integration
docker exec diagramahub-backend poetry run pytest -m property
docker exec diagramahub-backend poetry run pytest -x        # stop on first failure
docker exec diagramahub-backend poetry run black app/
docker exec diagramahub-backend poetry run ruff check app/
docker exec diagramahub-backend poetry run mypy app/
```

### Frontend

```bash
cd frontend && npm install
npm run dev         # hot reload on 5173
npm run build       # production build
npm run lint        # ESLint
npm run preview     # preview production build
```

### Shell test scripts

```bash
bash test-api.sh
bash test-onboarding.sh
bash test-onboarding-wizard.sh
bash verify-installation.sh
```

## Services & Ports

| Service | Container | Port | Notes |
|---------|-----------|------|-------|
| Frontend | diagramahub-frontend | 5173 | Vite dev server + HMR |
| Backend | diagramahub-backend | 5172 | FastAPI + hot reload |
| Kroki | diagramahub-kroki | internal | Diagram rendering (PlantUML, DBML, D2) |
| MongoDB | diagramahub-mongodb | 27017 | Persistent volume |

All services on `diagramahub-network` bridge.

---

## Architecture

### Directory Map

```
diagramahub/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan, router registration, Sentry
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic Settings (env vars)
│   │   │   └── security.py      # JWT + BCrypt utilities
│   │   └── api/v1/              # All feature modules (14 modules, see below)
│   ├── tests/
│   │   ├── conftest.py          # Shared fixtures (async client, test DB, Faker)
│   │   └── api/v1/              # Tests mirror module structure
│   ├── pyproject.toml           # Poetry deps + tool config
│   └── Dockerfile
├── frontend/src/
│   ├── App.tsx                  # Root + React Router v7 config
│   ├── main.tsx                 # Entry point + Sentry init
│   ├── index.css                # Tailwind directives + custom @layer components
│   ├── components/              # Reusable UI (flat + feature subfolders)
│   │   ├── admin/               # Admin panel components
│   │   ├── annotations/         # Presentation annotation components
│   │   ├── mfa/                 # MFA-related components
│   │   └── subscription/        # Billing components
│   ├── pages/                   # Route-level page components
│   │   └── admin/               # Admin pages
│   ├── contexts/                # AuthContext, ThemeContext
│   ├── services/api.ts          # Axios instance + ApiService class
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript types by domain
│   ├── i18n/
│   │   ├── config.ts            # i18next setup
│   │   └── locales/             # es.json (default), en.json
│   └── utils/                   # Utility functions
├── deploy/
│   ├── local-full/              # MongoDB 8 + Kroki + Backend + Frontend
│   └── external-mongodb/        # Kroki + Backend + Frontend (external DB)
├── docs/                        # MkDocs Material (ES/EN)
├── docker-compose.yml           # Symlinked to chosen deploy mode
```

### Backend Module Registry (All 14 Modules)

Every domain entity lives in its own isolated folder under `backend/app/api/v1/`. Complex modules extend the base 5-file pattern with additional files.

| Module | Path | Purpose | Extra files beyond base pattern |
|--------|------|---------|----------------------------------|
| **users** | `users/` | Auth, registration, password mgmt, account deletion | `audit_log.py` |
| **projects** | `projects/` | Project CRUD | — |
| **diagrams** | `diagrams/` | Diagram CRUD, AI fix, syntax validation, Kroki proxy | `fix_service.py`, `syntax_validator.py`, `config_utils.py`, `fix_prompts.py`, `kroki_client.py` |
| **folders** | `folders/` | Folder CRUD | — |
| **ai_providers** | `ai_providers/` | AI provider config + LLM clients (5 providers) | `clients/` subfolder, `factory.py`, `prompts.py` |
| **chat_sessions** | `chat_sessions/` | AI chat session management | — |
| **subscriptions** | `subscriptions/` | Stripe billing, plans, webhooks | `billing_service.py`, `webhook_handler.py`, `webhook_routes.py`, `usage_limiter.py`, `payment_providers/`, `constants.py`, `exceptions.py`, `logger.py`, `plan_service.py`, `stripe_catalog_service.py`, `subscription_service.py`, `migration_service.py` |
| **shared_links** | `shared_links/` | Public diagram sharing, rate limiting | `public_routes.py`, `rate_limiter.py` |
| **prompt_history** | `prompt_history/` | AI prompt history tracking | — |
| **integrations** | `integrations/` | Admin email/payment/OAuth vendor config | `email_service.py`, `email_vendors/`, `vendor_factory.py` |
| **mfa** | `mfa/` | Multi-factor auth (TOTP + email codes) | `totp_service.py` |
| **oauth** | `oauth/` | OAuth 2.0 / OpenID Connect (Google + extensible) | `providers/` subfolder |
| **prompt_history** | `prompt_history/` | AI prompt history | — |

### Backend Module Pattern (SOLID — Required for Every CRUD Entity)

```
backend/app/api/v1/<entity>/
├── __init__.py          # Module marker
├── interfaces.py        # Abstract base classes (ABC) — repository contracts
├── repository.py        # Concrete MongoDB implementation via Beanie ODM
├── services.py          # Business logic — depends on interfaces, never on concrete repos
├── schemas.py           # Pydantic v2: Base, Create, Update, InDB (Beanie Document), Response
└── routes.py            # FastAPI APIRouter — HTTP parsing only, delegates to services
```

**Key rule**: Services depend on abstract interfaces, not concrete implementations (Dependency Inversion). Routes handle HTTP only — all logic delegates to services.

### Module Registration Checklist

When creating a new module, you MUST:

1. Register the Beanie `Document` model in `main.py` → `init_beanie(document_models=[...])`
2. Register the router in `main.py` → `app.include_router(router, prefix=settings.API_V1_PREFIX)`
3. If the module has webhook or public routes, register them as additional routers in `main.py`

### Frontend Architecture

**State & Auth**:
- Auth: `AuthContext` (React Context) with JWT in `localStorage`, auto-logout on 401
- Theme: `ThemeContext` — light/dark persisted in `localStorage` under key `theme`

**Routing** (React Router v7):
- Protected routes via `PrivateRoute` component
- Initial setup enforced by `InstallationGuard`
- Public routes (e.g., `/shared/:token`) placed outside `AuthProvider` in `App.tsx`

**API Layer** (`services/api.ts`):
- Axios instance with auth interceptor (auto-attaches `Authorization: Bearer`)
- Response interceptor handles 401 → auto-logout
- All API calls centralized in `ApiService` class

### Frontend Design System

**Brand**: Purple gradient primary identity. Glassmorphism buttons (`.btn-glass` in `index.css`).

| Purpose | Tailwind Class |
|---------|----------------|
| Primary gradient | `bg-gradient-to-r from-purple-600 via-purple-400 to-purple-700` |
| Primary solid | `bg-purple-600`, `text-purple-600` |
| Primary hover | `bg-purple-700` |
| Danger | `bg-red-600`, `text-red-600` |
| Success | `bg-green-600`, `text-green-600` |
| Neutral text | `text-gray-700`, `text-gray-500` |
| Borders | `border-gray-200` |
| Background | `bg-white` |

**Rules**:
- All UI text uses i18n keys via `t('key')` — never hardcode strings
- Icons are inline SVGs (Heroicons-style), not icon libraries
- No external UI libraries (no Ant Design, Material UI, Chakra UI)
- TailwindCSS utility classes for all styling — no inline `style` for colors
- Custom CSS in `index.css` under `@layer components` only when Tailwind is insufficient
- Dark mode via `darkMode: 'class'` with `dark:` variants on all components

**Key custom classes** (`index.css`):
- `.btn-glass` — glassmorphism button effect
- `.chat-markdown` — compact markdown for AI chat bubbles
- `.animate-slide-in-right` — slide-in animation for chat panel
- `.markdown-wysiwyg` — EasyMDE WYSIWYG overrides

---

## Domain Model

| Entity | Key Fields | Relationships |
|--------|-----------|---------------|
| **Diagram** | `content`, `diagram_type`, `config`, `user_preferences` | belongs to Project, optionally to Folder |
| **Project** | name, owner | has many Diagrams, has many Folders |
| **Folder** | name, project_id | belongs to Project, has many Diagrams |
| **Shared Link** | token, access_type, expiration, `allow_copy_code` | references one Diagram |
| **Subscription** | plan, user_id | belongs to User, references Plan |
| **Plan** | `code` (e.g. `FREE`, `PRO`), limits, `prices` dict | has many Subscriptions |
| **AI Provider** | provider type, encrypted API key | belongs to User |
| **Chat Session** | messages, rolling summary | belongs to User + Diagram |
| **Prompt History** | prompt text, provider, model, generation_time | belongs to User |

## Features & Product Rules

### Diagram Engine
- Supported: **Mermaid** (client-side), **PlantUML**, **D2**, **DBML** (server-side via Kroki)
- Monaco Editor with Dark theme, syntax highlighting, autocomplete
- Export: PNG, PDF, Markdown
- Mermaid: themes (default/dark/forest/neutral/base), layout engines (dagre/elk), visual styles (classic/handDrawn), curve types
- PlantUML: themes + skinparam. D2: themes. DBML: background only.
- Shared `DiagramConfig`: background color + pattern (plain/dots/grid)
- Viewport state (zoom, x, y) persisted per diagram — **never overwrite on load**
- Presentation mode with full-screen viewing and annotations

### AI Integration (BYOL)
- 5 providers: Google Gemini, OpenAI GPT, Anthropic Claude, DeepSeek, **MiniMax**
- Pattern: abstract `BaseAIClient` → concrete clients in `ai_providers/clients/` → registered in `factory.py`
- Capabilities: generation, improvement, auto-fix, description generation, chat refinement
- API keys stored Fernet-encrypted, returned masked in responses
- `max_tokens`: 4096 across all providers
- Auto-fix retry disabled for PlantUML and DBML (false positives)
- AI content respects `language` parameter (`es`/`en`)
- Code markers: `<<<DIAGRAM>>>`/`<<<END_DIAGRAM>>>` (English), `<<<DIAGRAMA>>>`/`<<<END_DIAGRAMA>>>` (Spanish)
- Strip `<think>` tags from AI responses

### Auth & Security
- JWT + BCrypt. Tokens in `localStorage`.
- Two roles: `admin`, `user` (default)
- Password policy: **min 12 chars**, uppercase + lowercase + digit + special character
- Rate limiting: 10 login attempts/IP/minute. Lockout: 15 min after 5 failures.
- Session invalidation on password change (`pca` claim in JWT)
- MFA: email codes + TOTP (both active simultaneously, configurable default). 8 recovery codes.
- Session duration: 2 days without MFA, 5 days with MFA. OAuth: 5 days (MFA bypass).
- OAuth: provider-agnostic (`IOAuthProvider` interface). Google implemented. Auto-link by email.
- Security headers: X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy, Cache-Control
- Swagger/OpenAPI + stack traces disabled in production
- Sentry: conditional initialization, `before_send` sanitization (filters `Authorization`, `Cookie`, `api_key`, `password`, `token`, `secret`, `jwt`)

### Subscriptions & Billing
- Every user gets FREE plan on registration (including OAuth)
- Resource limits (`max_projects`, `max_diagrams`): `-1` or `None` = unlimited
- Stripe: checkout sessions, idempotent webhooks (keyed by `event_id`), billing portal
- Multi-currency pricing via `prices` dict on plans
- Provider-agnostic payment gateway (Stripe active, Conekta placeholder)

### Sharing
- Access types: `public` (open) or `protected` (access code 4–20 chars)
- Expiration: 5, 10, 30 days, or unlimited
- `allow_copy_code` controls source visibility
- Rate limiting + IP-hashed access logging

### Admin Panel
- User management: pagination, search, MFA status, plan display, Excel export
- Integrations (3 categories): Email (Resend), Payment (Stripe), OAuth (Google)
- Connection testing required before activation. One active vendor per type per category.

### Security Audit Log
- MongoDB collection with 90-day TTL auto-cleanup
- Events: login success/failure, lockout, MFA verified, password changed/reset, MFA enabled/disabled, recovery code used, admin MFA reset, account deleted, OAuth login success/failure, OAuth account linked

## Key Invariants (Must Preserve)

1. Every new user gets the FREE plan automatically
2. Resource limits enforced server-side (never trust client)
3. API keys never appear unmasked in any API response
4. Stripe webhook processing must be idempotent (check `event_id`)
5. Viewport state must not be overwritten when loading a diagram
6. Shared link tokens must be cryptographically random and unique
7. All security-sensitive actions must emit an audit log entry
8. AI auto-fix retry is disabled for PlantUML and DBML

---

## API Endpoints

All prefixed with `/api/v1`. See Swagger UI at `/docs` for full interactive docs.

**Auth (public)**:
- `POST /users/register`, `POST /users/login`
- `POST /users/reset-password-request`, `POST /users/reset-password-confirm`

**OAuth (public)**:
- `GET /oauth/providers` — list active providers
- `GET /oauth/{provider}/authorize` — initiate flow
- `GET /oauth/{provider}/callback` — handle callback

**Protected** (JWT required):
- `GET /users/me`, `PUT /users/change-password`
- `CRUD /projects`, `CRUD /diagrams`, `CRUD /folders`
- `CRUD /ai/providers`, `POST /ai/providers/{type}/test`
- `CRUD /chat-sessions`, `POST /chat-sessions/{id}/messages`
- `CRUD /shared-links`, `GET /shared-links/public/{token}` (public)
- `GET /subscriptions/me`, `POST /subscriptions/checkout`, `GET /subscriptions/billing`
- `GET /prompt-history`
- `CRUD /mfa` (TOTP setup, verify, recovery codes)
- Admin: `GET /admin/users`, `CRUD /integrations`
- Webhooks: `POST /webhooks/stripe`

**Health**:
- `GET /` — version info + status
- `GET /health` — health check

---

## Environment Configuration

**Backend** (`backend/.env`):
```bash
JWT_SECRET=<generated-32-char-min>
MONGO_URI=mongodb://mongodb:27017
DATABASE_NAME=diagramahub
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Optional
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ENABLE_LOGS=True
```

**Frontend** (via docker-compose or `.env`):
```bash
VITE_API_URL=http://localhost:5172
VITE_SENTRY_DSN=
VITE_APP_ENV=development
VITE_APP_VERSION=0.5.0
```

---

## Internationalization (i18n)

- **Framework**: i18next + react-i18next
- **Languages**: Spanish (default), English
- **Files**: `frontend/src/i18n/locales/es.json`, `en.json`
- **Rule**: ALL UI text uses `t('key')` — never hardcode strings
- **New text**: add keys to BOTH `es.json` and `en.json`
- Language preference persisted in `localStorage` under key `language`
- AI-generated content accepts `language` parameter (`es`/`en`)

Key sections in translation files: `common`, `nav`, `auth`, `validation`, `dashboard`, `project`, `diagram`, `profile`, `settings`, `editor`, `errors`.

---

## Testing Architecture

### Backend Tests (`backend/tests/`)

- **Framework**: pytest + pytest-asyncio (mode: `auto` — no `@pytest.mark.asyncio` needed) + pytest-cov + Hypothesis
- **Test DB**: Isolated `diagramahub_test` database, dropped after each test (function scope)
- **Fixtures** (`conftest.py`): `test_db`, `client` (async httpx.AsyncClient), `authenticated_client`, `user_data` (Faker)
- **Markers**: `@pytest.mark.unit`, `@pytest.mark.integration`, `@pytest.mark.slow`, `@pytest.mark.property`
- **Coverage**: enabled by default (`--cov=app`), skip with `--no-cov`
- Tests mirror module structure under `tests/api/v1/`

### Frontend Tests

- No framework configured yet (no Jest/Vitest in `package.json`)
- UI property validation done via example-based tests or manual verification

---

## Data Flow

```
React (Frontend) → Axios (api.ts) → FastAPI Routes → Services (business logic) → Repository (Beanie) → MongoDB
```

---

## Adding New Features

### Creating a Backend Module

1. Create `backend/app/api/v1/<entity_name>/` with 5 files: `__init__.py`, `interfaces.py`, `repository.py`, `services.py`, `schemas.py`, `routes.py`
2. Define Beanie Document in `schemas.py` (extends `Document`)
3. Define abstract interface in `interfaces.py` (extends `ABC`)
4. Implement repository in `repository.py` (implements interface)
5. Implement service in `services.py` (depends on interface, not repository)
6. Define routes in `routes.py` (FastAPI APIRouter, delegates to service)
7. Register Document in `main.py` → `init_beanie(document_models=[...])`
8. Register router in `main.py` → `app.include_router(router, prefix=...)`
9. Write tests in `tests/api/v1/<entity_name>/`

### Adding an AI Provider

1. Create client class extending `BaseAIClient` in `ai_providers/clients/`
2. Register in `factory.py` → `_clients_map`
3. Add frontend UI in provider configuration
4. Add provider type to `AIProviderType` enum (backend + frontend)
5. Add models to `AI_PROVIDER_MODELS` in frontend types
6. Add translations in `es.json` + `en.json`

### Adding a Frontend Page

1. Create page component in `pages/`
2. Add route in `App.tsx`
3. Add API methods to `services/api.ts`
4. Add types in `types/`
5. All text via i18n keys, added to both `es.json` and `en.json`

---

## Versioning

SemVer 2.0.0: `MAJOR.MINOR.PATCH`. Current: **0.5.2**.

| Bump | When |
|------|------|
| PATCH | Fixes, polish, internal refactors, prompt tweaks — no new capability |
| MINOR | New backwards-compatible feature or capability |
| MAJOR | Breaking changes to API, data structures, contracts |

Release notes in `docs/{es,en}/release-notes/{VERSION}.md`. CHANGELOG in Spanish (Keep a Changelog format). Git tags without `v` prefix (e.g., `0.5.0`).

---

## Code Quality Standards

- **Type hints**: All Python functions must have type hints
- **Validation**: Pydantic models for all API inputs/outputs
- **Async/await**: Consistent throughout backend
- **Error handling**: FastAPI HTTPException for API errors
- **Naming**: snake_case (Python), camelCase (TypeScript)
- **Testing**: Write tests for all new endpoints
- **Documentation**: Docstrings on all functions and classes
- **One entity = one module folder** — never mix entities

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| Port conflicts | Backend 5172, Frontend 5173, MongoDB 27017 |
| TailwindCSS | Using v3 (not v4) for PostCSS compatibility |
| Test failures | `docker-compose ps` to confirm MongoDB is running. Tests use `diagramahub_test` DB |
| Hot reload not working | Verify volume mounts in `docker-compose.yml`, restart containers |
| Sentry not reporting | Ensure `SENTRY_DSN` / `VITE_SENTRY_DSN` is set; Sentry is conditional |
| i18n key showing as raw text | Key missing from `es.json` or `en.json`, or path incorrect |

---

## Documentation Links

- **Swagger UI**: http://localhost:5172/docs
- **ReDoc**: http://localhost:5172/redoc
- **README.md**: Public project overview
- **INSTALL.md**: Installation + production deployment
- **STRIPE_QUICKSTART.md**: Stripe setup
- **CHANGELOG.md**: Version history (Spanish)
- **backend/README.md**, **frontend/README.md**: Layer-specific docs

---

License: Apache 2.0 — see LICENSE file.