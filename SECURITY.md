# 🛡️ Security

Security is a foundational principle at Diagramahub, not an afterthought. Every layer of the stack — from the database to the browser — has been hardened with multiple overlapping controls to protect user data and prevent common attack vectors.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it **privately** via [GitHub Security Advisories](https://github.com/diagramahub/diagramahub/security/advisories/new) rather than opening a public issue. We take all reports seriously and will respond as quickly as possible.

> ⚠️ Diagramahub is Beta software (v0.x). Use in production at your own risk.

## Security Controls

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
| **SVG Sanitization** | Rendered diagram SVG is sanitized with DOMPurify before injection to prevent DOM-based XSS. |

### Continuous Security with Snyk

<table>
<tr>
<td width="150"><img src="snyk/snyk_badge_round.svg" alt="Snyk Badge" width="150"></td>
<td>We've partnered with <strong><a href="https://snyk.io/?utm_source=open-source&utm_medium=pg-ptr&utm_campaign=ref-2501-osp&utm_content=pg-cta">Snyk</a></strong> through their <strong>Secure Developer Program for Open Source</strong> to continuously monitor our dependencies and codebase.</td>
</tr>
</table>

Snyk provides real-time vulnerability scanning across our entire stack:

- **Open Source Dependencies** — Automatic detection of known vulnerabilities in npm and Python packages
- **Code Security (SAST)** — Static analysis of our codebase for security anti-patterns
- **Container Scanning** — Vulnerability assessment of our Docker images

This partnership allows us to identify and remediate security issues before they reach our users — at no cost, thanks to Snyk's commitment to open source security.
