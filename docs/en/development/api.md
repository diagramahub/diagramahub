# REST API

The backend exposes a JSON REST API. FastAPI generates the full interactive reference (request and response schemas):

- **Swagger UI**: <http://localhost:5172/docs>
- **ReDoc**: <http://localhost:5172/redoc>
- **OpenAPI**: <http://localhost:5172/openapi.json>

!!! warning "Outside production only"
    With `APP_ENV=production` (the default) these three routes are disabled. To browse them, run your local environment with `APP_ENV=development`.

## Conventions

| Topic | Convention |
|---|---|
| Prefix | Every route lives under `/api/v1` (`settings.API_V1_PREFIX`). AI providers under `/api/v1/ai`. |
| Authentication | `Authorization: Bearer <JWT>` obtained from `POST /users/login` (or after MFA / OAuth). |
| Language | `Accept-Language: es` or `en`: error messages and AI content answer in that language. |
| Errors | FastAPI `HTTPException`: body `{"detail": ...}`, where `detail` is a string or an object with a code (e.g. `{"error": "response_truncated"}`). |
| Validation | `422` with Pydantic's detail when the body doesn't match the schema. |
| Limits | `413` when the body exceeds `MAX_REQUEST_BODY_BYTES`; `429` when a rate limit is exceeded, with `Retry-After` on the routes that compute it. |
| Invalid session | `401` when the token expired, is invalid or predates the last password change (`pca` claim). |

Common codes: `200`/`201` success, `400` business rule, `401` no session, `403` not allowed (e.g. not an admin or plan limit), `404` doesn't exist or isn't yours.

## Endpoints by group

Routes are relative to `/api/v1`. **Public** = no token; **User** = JWT; **Admin** = JWT of a user with the `admin` role.

### Users and authentication (`users/`)

| Method | Route | Access |
|---|---|---|
| GET | `/users/installation-status` | Public |
| GET | `/users/admin-count` | Public |
| POST | `/users/register` | Public |
| POST | `/users/login` | Public |
| POST | `/users/reset-password-request` | Public |
| POST | `/users/reset-password-confirm` | Public |
| GET · PUT · DELETE | `/users/me` | User |
| PUT | `/users/change-password` | User |

### MFA (`mfa/`)

| Method | Route | Access |
|---|---|---|
| POST | `/mfa/verify`, `/mfa/switch-method`, `/mfa/resend-email-code` | During login (`mfa_token` in the body) |
| GET | `/mfa/status` | User |
| POST | `/mfa/setup-totp`, `/mfa/enable-totp` | User |
| POST | `/mfa/enable-email`, `/mfa/verify-email-activation` | User |
| POST | `/mfa/disable`, `/mfa/regenerate-recovery-codes` | User |
| PUT | `/mfa/default-method` | User |
| GET | `/mfa/admin/users`, `/mfa/admin/users/export` | Admin |
| POST | `/mfa/admin/users/{user_id}/reset-mfa` | Admin |

### OAuth (`oauth/`)

| Method | Route | Access |
|---|---|---|
| GET | `/oauth/providers` | Public |
| GET | `/oauth/authorize/{provider}` | Public |
| POST | `/oauth/callback` | Public |

### Projects, folders and diagrams

| Method | Route | Access |
|---|---|---|
| GET · POST | `/projects` | User |
| GET · PUT · DELETE | `/projects/{project_id}` | User |
| GET | `/projects/{project_id}/export`, `/projects/{project_id}/export/summary` | User |
| POST | `/projects/{project_id}/import` | User |
| POST | `/projects/{project_id}/folders` | User |
| GET · PUT · DELETE | `/folders/{folder_id}` | User |
| POST | `/projects/{project_id}/diagrams` | User |
| GET | `/diagrams/recent` | User |
| GET · PUT · DELETE | `/diagrams/{diagram_id}` | User |
| POST | `/diagrams/{diagram_id}/move`, `/diagrams/{diagram_id}/duplicate` | User |
| POST | `/diagrams/{diagram_id}/fix` | User |
| POST | `/diagrams/convert` | User |
| POST | `/diagrams/render` | Public (per-IP limit) |

### AI (`ai_providers/`, mounted at `/ai`)

| Method | Route | Access |
|---|---|---|
| GET | `/ai/settings` | User |
| PUT | `/ai/settings/default-provider`, `/ai/settings/auto-fix` | User |
| POST | `/ai/providers` | User |
| PUT · DELETE | `/ai/providers/{provider_index}` | User |
| POST | `/ai/test-provider` | User (tests a key without saving it) |
| POST | `/ai/generate-diagram`, `/ai/improve-diagram` | User |
| POST | `/ai/generate-description`, `/ai/refine-description` | User |

### AI chat (`chat_sessions/`)

| Method | Route | Access |
|---|---|---|
| GET · POST | `/chat-sessions` | User |
| GET | `/chat-sessions/stats/provider-usage` | User |
| GET · PUT · DELETE | `/chat-sessions/{session_id}` | Owner |
| PUT | `/chat-sessions/{session_id}/model` | Owner |
| POST | `/chat-sessions/{session_id}/messages` | Owner |
| POST | `/chat-sessions/{session_id}/messages/stream` (SSE) | Owner |
| DELETE | `/chat-sessions/{session_id}/messages/{message_id}` | Owner |
| PUT | `/chat-sessions/{session_id}/messages/{message_id}/status` | Owner |

Each session belongs to the user who created it: another user's session answers `404`, like a missing one, and the message endpoints check that the message belongs to the session in the route.

### Prompt history (`prompt_history/`)

| Method | Route | Access |
|---|---|---|
| GET · POST | `/prompt-history` | User |
| DELETE | `/prompt-history/{entry_id}` | User |

### Shared links (`shared_links/`)

| Method | Route | Access |
|---|---|---|
| POST | `/shared-links` | User |
| GET | `/shared-links/diagram/{diagram_id}` | User |
| PUT · DELETE | `/shared-links/{link_id}` | User |
| GET | `/shared/{token}/info`, `/shared/{token}/diagram` | Public |
| POST | `/shared/{token}/verify` | Public (access code) |

### Plans and subscriptions (`subscriptions/`)

| Method | Route | Access |
|---|---|---|
| GET | `/plans`, `/plans/{plan_id}` | Public |
| GET | `/subscriptions/me`, `/subscriptions/usage`, `/subscriptions/billing-history` | User |
| POST | `/subscriptions/checkout`, `/subscriptions/cancel`, `/subscriptions/update-payment-method` | User |
| GET | `/subscriptions/invoices/{invoice_id}/pdf-url` | User |
| GET · POST | `/admin/plans` | Admin |
| PUT · DELETE | `/admin/plans/{plan_id}` | Admin |
| POST | `/admin/plans/{plan_id}/prices` | Admin |
| DELETE | `/admin/plans/{plan_id}/prices/{currency}` | Admin |
| POST | `/webhooks/stripe` | Stripe signature (idempotent by `event_id`) |

### Integrations (`integrations/`)

| Method | Route | Access |
|---|---|---|
| GET | `/admin/integrations/status` | Admin |
| GET · POST | `/admin/integrations/vendors` | Admin |
| PUT · DELETE | `/admin/integrations/vendors/{vendor_id}` | Admin |
| GET | `/admin/integrations/vendors/{vendor_id}/config` (masked) | Admin |
| POST | `/admin/integrations/vendors/{vendor_id}/test` | Admin |
| PUT | `/admin/integrations/vendors/{vendor_id}/set-default` | Admin |

### Health

Outside `/api/v1`:

| Method | Route | Response |
|---|---|---|
| GET | `/` | Name, version, environment and status |
| GET | `/health` | `{"status": "ok"}` |

## Quick example

```bash
# 1. Sign in
TOKEN=$(curl -s -X POST http://localhost:5172/api/v1/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "you@example.com", "password": "<your-password>"}' | jq -r .access_token)

# 2. List your projects
curl -s http://localhost:5172/api/v1/projects -H "Authorization: Bearer $TOKEN"
```

!!! note
    When the account has MFA enabled, login doesn't return the final token but `mfa_required` and an `mfa_token`, which are exchanged for the access token with `POST /mfa/verify`.
