# Configuration

DiagramaHub is configured with environment variables. The backend reads them from
`backend/.env` (mounted into the container with `env_file`) and the frontend receives them
from the Docker Compose file. This page is the complete reference: anything not listed here
is not configurable through the environment.

!!! tip "After changing a variable"
    The backend reads its configuration at startup. Recreate the container to apply
    changes: `docker-compose up -d backend` (or `frontend`). A `restart` does not re-read
    `env_file`.

## Backend (`backend/.env`)

Variables are defined in `backend/app/core/config.py` and are case-sensitive.

### Database

| Variable | Default | Required | Description |
|---|---|---|---|
| `MONGO_URI` | `mongodb://mongodb:27017` | Yes in `external-mongodb` mode | MongoDB connection string. In `local-full` the default points to the `mongodb` container. Accepts `mongodb+srv://` (Atlas). |
| `DATABASE_NAME` | `diagramahub` | No | Database name. |

### Security

| Variable | Default | Required | Description |
|---|---|---|---|
| `JWT_SECRET` | — | **Yes** | Secret used to sign session tokens. The backend does not start without it. At least 32 random characters. Changing it signs everyone out. |
| `JWT_ALGORITHM` | `HS256` | No | JWT signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | No | **No effect.** Accepted so existing `.env` files keep working, but each sign-in sets the session lifetime (see [Authentication](../security/authentication.md)). |
| `AI_ENCRYPTION_KEY` | empty | **Yes, in practice** | Fernet key that encrypts in the database the AI providers' API keys, the integrations' configuration (Resend, Stripe, Google) and the MFA TOTP secrets. If missing, those operations fail. |

Generate both secrets like this:

```bash
# JWT_SECRET
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# AI_ENCRYPTION_KEY (requires the cryptography package)
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

!!! danger "Back up `AI_ENCRYPTION_KEY` together with the database"
    What was encrypted with one key can only be decrypted with that same key. If you lose
    or change it, every user's AI API keys, integrations and authenticator-app MFA become
    unreadable and must be configured again.

!!! note "`install.sh` generates `AI_ENCRYPTION_KEY`"
    The installer writes `backend/.env` with `MONGO_URI`, `DATABASE_NAME`, `JWT_SECRET`,
    `AI_ENCRYPTION_KEY` and `API_V1_PREFIX`. Running it again keeps an existing
    `AI_ENCRYPTION_KEY`. On installations made with versions before 0.8.4, add it by hand if
    it's missing and recreate the backend.

### URLs and CORS

| Variable | Default | Required | Description |
|---|---|---|---|
| `FRONTEND_URL` | `http://localhost:5173` | Yes in production | Public frontend URL. Used in Stripe Checkout redirects, the password-reset link and the URL of shared links. When `BACKEND_CORS_ORIGINS` is empty, it is also the only allowed CORS origin. |
| `BACKEND_CORS_ORIGINS` | empty | No | Allowed CORS origins, **comma-separated**: `https://diagrams.example.com,https://www.example.com`. |
| `API_V1_PREFIX` | `/api/v1` | No | API route prefix. The frontend assumes `/api/v1`: don't change it. |

!!! note "`BACKEND_CORS_ORIGINS` format"
    Write the origins comma-separated, without brackets or quotes. Since 0.8.4 the bracketed
    format (`["http://localhost:5173"]`) that earlier example files shipped is accepted too:
    the brackets and quotes are dropped.

### Environment and server

| Variable | Default | Required | Description |
|---|---|---|---|
| `APP_ENV` | `production` | No | `production` disables Swagger/ReDoc/OpenAPI, hides error traces, enables HSTS and CSP on API responses and starts with gunicorn. `development` (or `dev`) starts uvicorn with hot reload. |
| `PORT` | `8000` (image) | No | Port the backend listens on inside the container. Both compose files (`local-full` and `external-mongodb`) set it to `5172`, the published port, and that value takes precedence over `backend/.env`. |
| `WORKERS` | `2` | No | gunicorn processes in production mode. Request limits are counted per process (see [Production](production.md#request-limits-and-workers)). |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1,::1` | Yes behind a proxy | Proxies whose `X-Forwarded-For` and `X-Forwarded-Proto` the backend accepts (comma-separated IPs or CIDR networks). Only those connections can change the client IP used by request limits, account lockout and the audit log. See [Production](production.md#real-client-ip-behind-the-proxy). |

### Diagram rendering

| Variable | Default | Required | Description |
|---|---|---|---|
| `KROKI_URL` | `http://kroki:8000` | No | URL of the Kroki service that renders PlantUML, D2 and DBML. Change it only if Kroki runs on another host. |

### Request limits

| Variable | Default | Description |
|---|---|---|
| `MAX_REQUEST_BODY_BYTES` | `5242880` (5 MB) | Maximum body size for any request; above it the API answers `413`. Generous because freehand drawings are stored as JSON. It is also the maximum size of each file inside an import. |
| `MAX_IMPORT_UPLOAD_BYTES` | `20971520` (20 MB) | Maximum size of a project import upload (ZIP or loose files). |
| `MAX_IMPORT_FILES` | `500` | Maximum number of files in one import. |
| `MAX_IMPORT_UNCOMPRESSED_BYTES` | `52428800` (50 MB) | Maximum size a ZIP may expand to. |

### Monitoring (optional)

| Variable | Default | Description |
|---|---|---|
| `SENTRY_DSN` | empty | Sentry DSN for the backend. Empty = Sentry disabled. |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | Fraction of transactions sent for performance monitoring (0.0–1.0). |
| `SENTRY_ENABLE_LOGS` | `True` | Sends logs to Sentry. |

Events are sanitized before they are sent (see [Maintenance](maintenance.md#monitoring-with-sentry)).

### Stripe through environment variables (alternative)

The recommended way to connect Stripe is the [Integrations](integrations.md#payments-stripe)
panel. When no active gateway is configured there, the backend uses these variables:

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Secret key (`sk_...`). Required together with the webhook secret. |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_...`). |
| `STRIPE_PUBLISHABLE_KEY` | Publishable key (`pk_...`). |

### Variables you should not set

`PROJECT_NAME` and `VERSION` are configuration fields too, but the code sets them. If
`backend/.env` defines `VERSION` (the `backend/.env.template` template shipped
`VERSION=1.0.0` up to 0.8.3), the API reports a false version at `/` and to Sentry. Remove it
from your `.env`.

### Minimal example

=== "local-full (development)"

    ```env
    MONGO_URI=mongodb://mongodb:27017
    DATABASE_NAME=diagramahub
    JWT_SECRET=<random-secret-32+-chars>
    AI_ENCRYPTION_KEY=<fernet-key>
    APP_ENV=development
    FRONTEND_URL=http://localhost:5173
    ```

=== "external-mongodb (production)"

    ```env
    MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/
    DATABASE_NAME=diagramahub
    JWT_SECRET=<random-secret-32+-chars>
    AI_ENCRYPTION_KEY=<fernet-key>
    APP_ENV=production
    PORT=5172
    FRONTEND_URL=https://diagrams.example.com
    BACKEND_CORS_ORIGINS=https://diagrams.example.com
    ```

## Frontend

The frontend reads its configuration in this order:

1. `/config.js` (`window.__DH_CONFIG__`), which the **production** image generates when the
   container starts from the environment variables. Changing a value only requires
   recreating the container, not rebuilding the image.
2. The `VITE_*` variables baked into the build (the **development** image, or static
   hosting without a container, where changing a value requires a rebuild).

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5172` | **Public** API URL, as the user's browser sees it (not the internal Docker URL). |
| `VITE_SENTRY_DSN` | empty | Sentry DSN for the frontend. Empty = disabled. |
| `VITE_APP_ENV` | `production` (prod image) | Environment reported to Sentry. |
| `VITE_APP_VERSION` | `package.json` version | Version reported to Sentry as the *release*. Usually not needed. |

In `external-mongodb` mode the compose file takes `VITE_API_URL`, `VITE_SENTRY_DSN` and
`VITE_APP_ENV` from the shell or from a `.env` file next to `docker-compose.yml`:

```env
# .env at the repository root (next to docker-compose.yml)
VITE_API_URL=https://api.diagrams.example.com
```

In `local-full`, `VITE_API_URL` is fixed to `http://localhost:5172` in the compose file.

## Next steps

- [Production](production.md): what changes when you expose the instance to the internet.
- [Integrations](integrations.md): email, payments and Google OAuth.
