# Protections

Controls DiagramaHub applies in the API, in the data and in the browser, on top of [authentication](authentication.md).

## Security headers

The backend adds these headers to **every** API response:

| Header | Value | When |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Always |
| `X-Frame-Options` | `DENY` | Always |
| `X-XSS-Protection` | `1; mode=block` | Always |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Always |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Always |
| `Cache-Control` | `no-store` | Always |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Only with `APP_ENV=production` |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` | Only with `APP_ENV=production` |

!!! note "The frontend CSP is set by the operator"
    The CSP above covers the API's JSON responses. The application HTML is served by the frontend (Nginx), so its own CSP is configured on the web server or the reverse proxy. See [Production](../self-host/production.md).

**CORS** only accepts the origins in `BACKEND_CORS_ORIGINS` (or `FRONTEND_URL` when empty), with an explicit list of methods and headers.

## Production hardening

With `APP_ENV=production`:

- **Swagger UI, ReDoc and `/openapi.json` are disabled.**
- Unhandled errors answer `500 Internal server error`, **without stack traces**; the details only go to the server logs.
- HSTS and the API CSP are enabled.

## Secret encryption and masking

| Data | How it is stored | How it is shown |
|---|---|---|
| Passwords | BCrypt hash | Never returned |
| Email MFA codes and recovery codes | BCrypt hash | Recovery codes are shown only once |
| TOTP secrets | Encrypted with **Fernet** | Never returned after activation |
| AI provider API keys (BYOL) | Encrypted with **Fernet** | Masked: first 4 and last 3 characters (`AIza...xyz`) |
| Integration credentials (email, payments, OAuth) | Encrypted | Masked: only the last 4 characters |
| Access codes of protected links | BCrypt hash | Only at creation, to the owner |

Fernet uses the `AI_ENCRYPTION_KEY` key. If it is lost, the encrypted secrets can't be recovered: users will have to enter their API keys again and set up TOTP again.

!!! warning "Back up `AI_ENCRYPTION_KEY`"
    Keep the key along with the MongoDB backups, but in a different place. A database backup without the key can't decrypt the secrets, and the key without the backup exposes nothing.

## Shared links

- The link token is generated with a cryptographic generator (`secrets.token_urlsafe(32)`) and is unique.
- **Protected** links require an access code of 4 to 20 characters (or a generated 6-character one). After **5 wrong codes in 15 minutes** from the same IP for the same link, access is temporarily blocked.
- Public routes have their own rate limit: **60 requests per IP per minute**.
- Every access is logged (success, expired, invalid code, blocked, not found) with the **IP hashed with SHA-256**, never the plain IP.
- Expiration can be 5, 10 or 30 days, or unlimited; `allow_copy_code` decides whether visitors see the source code.

Using it from the app: [Sharing diagrams](../guide/sharing.md).

## Server-side limits and validation

- **Plan limits** (`max_projects`, `max_diagrams`): checked on the server when creating resources; the client can't skip them.
- **Per-project isolation**: a diagram can only be filed under folders of its own project; a folder of another project answers as not found, without revealing it exists.
- **Request size**: 5 MB by default (`MAX_REQUEST_BODY_BYTES`); project imports accept up to 20 MB, with at most 500 files and 50 MB uncompressed.
- **Usage rate limits**: server-side diagram rendering (60/min per IP), project exports and imports (per user).
- **Stripe webhooks**: the signature is verified before any event is processed, and each event is
  applied only once (a repeated delivery is recognized as a duplicate by its `event_id`).

## Monitoring with Sentry (optional)

Sentry is only initialized when you set `SENTRY_DSN`. Before sending an event, the backend masks as `[Filtered]`:

- The `Authorization` and `Cookie` headers.
- Body and query parameters named `api_key`, `password`, `token`, `secret` or `jwt`.

If sanitization fails, the event **is dropped**; it is never sent uncleaned.

## Containers

- The backend runs as an unprivileged user (`app`, UID 1000).
- The frontend production image serves static files with Nginx as the `nginx` user, without root.

## Browser

- **SVG sanitization**: every rendered SVG goes through **DOMPurify** before it is inserted into the DOM, to prevent XSS from diagram content.
- **Protected routes**: `PrivateRoute` and `InstallationGuard` keep signed-out users out of authenticated views.
- **Interceptors**: the HTTP client attaches the JWT and clears the session on a `401`.
