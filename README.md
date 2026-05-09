# ✏️ Diagramahub

[![Known Vulnerabilities](https://snyk.io/test/github/diagramahub/diagramahub/badge.svg?targetFile=frontend/package.json)](https://snyk.io/test/github/diagramahub/diagramahub?targetFile=frontend/package.json)

**Diagramahub** is an open-source platform for creating, organizing, and exporting diagrams using plain text markup. It combines the power of Mermaid, PlantUML, and D2 with a polished interface — ideal for developers and teams who want to diagram fast and stay in flow.

Server-side rendering powered by [Kroki](https://kroki.io/). Self-hostable via Docker Compose. No vendor lock-in. Apache 2.0 licensed.

> ⚠️ **Beta Software** — DiagramaHub is in early development (v0.x). It is not yet considered stable software. APIs, data structures, and features may change between versions. Use in production at your own risk.

---

## ✨ Features

### Diagramming
- 📝 **Mermaid, PlantUML & D2** — Real-time text-to-diagram rendering with syntax validation.
- 🔌 **[Kroki](https://kroki.io/) Integration** — Self-hosted server-side rendering engine for PlantUML, D2, and 20+ other diagram types. Your diagram content stays private.
- 🖥️ **Monaco Editor** — Full code editor with syntax highlighting for Mermaid, PlantUML, and D2.
- 🖼️ **Export** — PNG, PDF, and Markdown.
- 🎨 **Themes** — Configurable diagram appearance: Mermaid themes, PlantUML skins, and 19 D2 themes (light, dark, special).
- 📺 **Presentation Mode** — Full-screen diagram viewing with annotations.

### AI-Powered (BYOL — Bring Your Own LLM)
- 🤖 **AI Diagram Generation** — Describe what you need and AI creates the diagram for you.
- ✨ **AI Diagram Improvement** — Enhance existing diagrams with AI suggestions and diff preview.
- 🔧 **AI Diagram Fix** — Automatic syntax error detection and correction.
- 💬 **AI Chat Sessions** — Iterative conversations to refine diagrams step by step.
- 📋 **Prompt History** — Full log of all AI interactions, searchable and reusable.
- 🔑 **4 Providers** — Google Gemini, OpenAI GPT, Anthropic Claude, and DeepSeek.

### Organization & Collaboration
- 📂 **Projects & Folders** — Hierarchical organization for all your diagrams.
- 🔗 **Shared Links** — Public diagram sharing protected with access codes and rate limiting.
- 👥 **Onboarding** — Installation wizard and guided onboarding for new users.

### Platform
- 🔒 **Authentication** — JWT + BCrypt with registration, login, password reset, and account deletion.
- 💳 **Subscriptions** — Plan system with Stripe integration (checkout, webhooks, billing portal).
- 🌍 **Multi-language** — Spanish (default) and English, with i18next.
- 👤 **Profile Management** — Timezone, language, avatar, and security settings.
- 📧 **Email Integrations** — Configurable email vendors (Resend) for transactional emails.
- 🐳 **Docker Ready** — Self-host anywhere in minutes with the one-line installer.

---

## 🛡️ Secure by Design

<table>
<tr>
<td width="200"><img src="snyk/scanned_by_snyk.png" alt="Scanned by Snyk" width="180"></td>
<td>Security is a foundational principle at Diagramahub, not an afterthought. Every layer of the stack — from the database to the browser — has been hardened with multiple overlapping controls to protect user data and prevent common attack vectors.</td>
</tr>
</table>

### Backend

| Control | Implementation |
|---------|---------------|
| **Multi-Factor Authentication** | Dual MFA with TOTP (Google Authenticator, Authy) and email codes, plus single-use recovery codes. Sessions last 2 days without MFA, 5 days with MFA enabled. |
| **Password Policy** | Enforced minimum 12 characters with uppercase, lowercase, digit, and special character. Hashed with BCrypt. |
| **Session Security** | JWT tokens with automatic invalidation on password change (`pca` claim). Differentiated session durations based on MFA status. |
| **Brute Force Protection** | Rate limiting on login (10 attempts/IP/minute) with account lockout after 5 consecutive failures (15-minute cooldown). |
| **API Key Encryption** | All third-party API keys (AI providers, payment gateways) encrypted at rest with Fernet (AES-128-CBC). Keys are masked in all API responses. |
| **Security Headers** | HSTS (production), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and `Cache-Control: no-store`. |
| **Audit Logging** | Immutable security audit log with 90-day retention. Tracks login attempts, MFA events, password changes, OAuth activity, and account lifecycle. |
| **CSRF Protection** | Server-side state tokens with 10-minute TTL for OAuth flows. Cryptographic validation of all OAuth ID tokens (signature, issuer, audience, expiration). |
| **Webhook Verification** | Stripe webhooks verified via signature check before processing. Idempotent event handling prevents duplicate processing. |
| **Production Hardening** | Swagger/OpenAPI disabled in production. Stack traces hidden. Sentry error tracking with PII sanitization. |

### Frontend

| Control | Implementation |
|---------|---------------|
| **Auth Interceptors** | Centralized Axios service automatically attaches JWT to all requests and handles 401 responses with session cleanup. |
| **Protected Routing** | Route-level guards via `PrivateRoute` and `InstallationGuard` prevent unauthorized access to authenticated views. |
| **API Key Masking** | AI provider keys are never displayed in full — only first 4 and last 3 characters are shown in the UI. |

### Continuous Security with Snyk

<table>
<tr>
<td width="100"><img src="snyk/snyk_badge_round.svg" alt="Snyk Badge" width="150"></td>
<td>We've partnered with <strong><a href="https://snyk.io/?utm_source=open-source&utm_medium=pg-ptr&utm_campaign=ref-2501-osp&utm_content=pg-cta">Snyk</a></strong> through their <strong>Secure Developer Program for Open Source</strong> to continuously monitor our dependencies and codebase.</td>
</tr>
</table>

Snyk provides real-time vulnerability scanning across our entire stack:

- **Open Source Dependencies** — Automatic detection of known vulnerabilities in npm and Python packages
- **Code Security (SAST)** — Static analysis of our codebase for security anti-patterns
- **Container Scanning** — Vulnerability assessment of our Docker images

This partnership allows us to identify and remediate security issues before they reach our users — at no cost, thanks to Snyk's commitment to open source security.
---

## 🚀 Quickstart

### Automatic Install (Recommended)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/diagramahub/diagramahub/main/install.sh)
```

The installer detects your OS, installs Docker if needed, configures MongoDB (local or external), generates secrets, and starts everything.

### Manual Install

```bash
git clone https://github.com/diagramahub/diagramahub.git
cd diagramahub

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env — set JWT_SECRET at minimum

# Choose deployment mode
ln -sf deploy/local-full/docker-compose.yml docker-compose.yml

# Build and start
docker-compose up -d --build
```

Once running:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5172 |
| Kroki | http://localhost:8000 (internal) |
| Swagger UI | http://localhost:5172/docs |
| ReDoc | http://localhost:5172/redoc |

---

## 🏗️ Architecture

Built with a modular approach following **SOLID** principles:

```text
diagramahub/
├── frontend/               # React 19 + TypeScript + Vite 7 + TailwindCSS v3
├── backend/                # FastAPI + MongoDB (Beanie ODM) + Poetry
├── deploy/
│   ├── local-full/         # MongoDB 8 + Kroki + Backend + Frontend
│   └── external-mongodb/   # Kroki + Backend + Frontend (external DB)
└── docs/                   # MkDocs Material documentation (ES/EN)
```

### Services

| Service | Technology | Purpose |
|---|---|---|
| Frontend | React 19 + Vite 7 | UI, client-side Mermaid rendering |
| Backend | FastAPI + Python 3.11 | API, business logic, Kroki proxy |
| [Kroki](https://kroki.io/) | `yuzutech/kroki` Docker image | Server-side rendering for PlantUML, D2, and 20+ diagram types |
| MongoDB | MongoDB 8 (or external) | Data storage |

### Backend

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

### Frontend

React 19 · TypeScript 5.9+ · Vite 7 · TailwindCSS v3 · React Router v7

- All UI text uses i18n translation keys — Spanish and English locales.
- Auth state via React Context with JWT stored in localStorage.
- API calls through a centralized Axios service with auth interceptors.
- Protected routes via `PrivateRoute` and `InstallationGuard` components.

---

## 📖 Documentation

- 🛠️ **[Installation & Update Guide](INSTALL.md)** — Detailed setup, production deployment (Nginx/SSL), troubleshooting, and upgrades.
- 💳 **[Stripe Quickstart](STRIPE_QUICKSTART.md)** — Configure subscriptions and billing.
- 📖 **[Backend Documentation](backend/README.md)** — API structure, endpoints, and development.
- 📖 **[Frontend Documentation](frontend/README.md)** — UI components and i18n.
- 📚 **[Full Documentation](docs/)** — MkDocs Material site in Spanish and English.
- 🧪 **API Docs** — [Swagger UI](http://localhost:5172/docs) | [ReDoc](http://localhost:5172/redoc) (when running).

---

## 🧪 Testing

```bash
# Unit tests with coverage
docker exec diagramahub-backend poetry run pytest

# By marker
docker exec diagramahub-backend poetry run pytest -m unit
docker exec diagramahub-backend poetry run pytest -m integration
docker exec diagramahub-backend poetry run pytest -m property

# Linting and formatting
docker exec diagramahub-backend poetry run ruff check app/
docker exec diagramahub-backend poetry run black app/
docker exec diagramahub-backend poetry run mypy app/
```

Shell-based test scripts are also available:

```bash
bash test-api.sh              # API endpoint tests
bash test-onboarding.sh       # Onboarding flow tests
bash verify-installation.sh   # Post-install health checks
```

---

## 🙌 Contributing

We welcome contributions! Please check the development guidelines in the [Installation Guide](INSTALL.md).

---

## � Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes.

---

## �📜 License

Licensed under the [Apache License 2.0](LICENSE).

---

## 🧠 Made with care by [@alexdzul](https://github.com/alexdzul) and contributors
