# API REST

El backend expone una API REST en JSON. La referencia interactiva y completa (esquemas de petición y respuesta) la genera FastAPI:

- **Swagger UI**: <http://localhost:5172/docs>
- **ReDoc**: <http://localhost:5172/redoc>
- **OpenAPI**: <http://localhost:5172/openapi.json>

!!! warning "Solo fuera de producción"
    Con `APP_ENV=production` (el valor por defecto) estas tres rutas están deshabilitadas. Para explorarlas, levanta tu entorno local con `APP_ENV=development`.

## Convenciones

| Tema | Convención |
|---|---|
| Prefijo | Todas las rutas cuelgan de `/api/v1` (`settings.API_V1_PREFIX`). Los proveedores de IA, de `/api/v1/ai`. |
| Autenticación | `Authorization: Bearer <JWT>` obtenido en `POST /users/login` (o tras el MFA / OAuth). |
| Idioma | `Accept-Language: es` o `en`: los mensajes de error y el contenido de IA responden en ese idioma. |
| Errores | `HTTPException` de FastAPI: cuerpo `{"detail": ...}`, donde `detail` es un texto o un objeto con un código (p. ej. `{"error": "response_truncated"}`). |
| Validación | `422` con el detalle de Pydantic cuando el cuerpo no cumple el esquema. |
| Límites | `413` si el cuerpo supera `MAX_REQUEST_BODY_BYTES`; `429` cuando se excede un límite de peticiones, con `Retry-After` en las rutas que lo calculan. |
| Sesión inválida | `401` si el token expiró, es inválido o es anterior al último cambio de contraseña (claim `pca`). |

Códigos habituales: `200`/`201` éxito, `400` regla de negocio, `401` sin sesión, `403` sin permiso (p. ej. no admin o límite del plan), `404` no existe o no es tuyo.

## Endpoints por grupo

Las rutas están relativas a `/api/v1`. **Público** = sin token; **Usuario** = JWT; **Admin** = JWT de un usuario con rol `admin`.

### Usuarios y autenticación (`users/`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/users/installation-status` | Público |
| GET | `/users/admin-count` | Público |
| POST | `/users/register` | Público |
| POST | `/users/login` | Público |
| POST | `/users/reset-password-request` | Público |
| POST | `/users/reset-password-confirm` | Público |
| GET · PUT · DELETE | `/users/me` | Usuario |
| PUT | `/users/change-password` | Usuario |

### MFA (`mfa/`)

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/mfa/verify`, `/mfa/switch-method`, `/mfa/resend-email-code` | Durante el login (`mfa_token` en el cuerpo) |
| GET | `/mfa/status` | Usuario |
| POST | `/mfa/setup-totp`, `/mfa/enable-totp` | Usuario |
| POST | `/mfa/enable-email`, `/mfa/verify-email-activation` | Usuario |
| POST | `/mfa/disable`, `/mfa/regenerate-recovery-codes` | Usuario |
| PUT | `/mfa/default-method` | Usuario |
| GET | `/mfa/admin/users`, `/mfa/admin/users/export` | Admin |
| POST | `/mfa/admin/users/{user_id}/reset-mfa` | Admin |

### OAuth (`oauth/`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/oauth/providers` | Público |
| GET | `/oauth/authorize/{provider}` | Público |
| POST | `/oauth/callback` | Público |

### Proyectos, carpetas y diagramas

| Método | Ruta | Acceso |
|---|---|---|
| GET · POST | `/projects` | Usuario |
| GET · PUT · DELETE | `/projects/{project_id}` | Usuario |
| GET | `/projects/{project_id}/export`, `/projects/{project_id}/export/summary` | Usuario |
| POST | `/projects/{project_id}/import` | Usuario |
| POST | `/projects/{project_id}/folders` | Usuario |
| GET · PUT · DELETE | `/folders/{folder_id}` | Usuario |
| POST | `/projects/{project_id}/diagrams` | Usuario |
| GET | `/diagrams/recent` | Usuario |
| GET · PUT · DELETE | `/diagrams/{diagram_id}` | Usuario |
| POST | `/diagrams/{diagram_id}/move`, `/diagrams/{diagram_id}/duplicate` | Usuario |
| POST | `/diagrams/{diagram_id}/fix` | Usuario |
| POST | `/diagrams/convert` | Usuario |
| POST | `/diagrams/render` | Público (con límite por IP) |

### IA (`ai_providers/`, montado en `/ai`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/ai/settings` | Usuario |
| PUT | `/ai/settings/default-provider`, `/ai/settings/auto-fix` | Usuario |
| POST | `/ai/providers` | Usuario |
| PUT · DELETE | `/ai/providers/{provider_index}` | Usuario |
| POST | `/ai/test-provider` | Usuario (prueba una key sin guardarla) |
| POST | `/ai/generate-diagram`, `/ai/improve-diagram` | Usuario |
| POST | `/ai/generate-description`, `/ai/refine-description` | Usuario |

### Chat de IA (`chat_sessions/`)

| Método | Ruta | Acceso |
|---|---|---|
| GET · POST | `/chat-sessions` | Usuario |
| GET | `/chat-sessions/stats/provider-usage` | Usuario |
| GET · PUT · DELETE | `/chat-sessions/{session_id}` | Usuario dueño |
| PUT | `/chat-sessions/{session_id}/model` | Usuario dueño |
| POST | `/chat-sessions/{session_id}/messages` | Usuario dueño |
| POST | `/chat-sessions/{session_id}/messages/stream` (SSE) | Usuario dueño |
| DELETE | `/chat-sessions/{session_id}/messages/{message_id}` | Usuario dueño |
| PUT | `/chat-sessions/{session_id}/messages/{message_id}/status` | Usuario dueño |

Cada sesión pertenece a quien la creó: una sesión de otro usuario responde `404`, igual que una inexistente, y los endpoints de mensajes comprueban que el mensaje sea de la sesión indicada en la ruta.

### Historial de prompts (`prompt_history/`)

| Método | Ruta | Acceso |
|---|---|---|
| GET · POST | `/prompt-history` | Usuario |
| DELETE | `/prompt-history/{entry_id}` | Usuario |

### Enlaces compartidos (`shared_links/`)

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/shared-links` | Usuario |
| GET | `/shared-links/diagram/{diagram_id}` | Usuario |
| PUT · DELETE | `/shared-links/{link_id}` | Usuario |
| GET | `/shared/{token}/info`, `/shared/{token}/diagram` | Público |
| POST | `/shared/{token}/verify` | Público (código de acceso) |

### Planes y suscripciones (`subscriptions/`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/plans`, `/plans/{plan_id}` | Público |
| GET | `/subscriptions/me`, `/subscriptions/usage`, `/subscriptions/billing-history` | Usuario |
| POST | `/subscriptions/checkout`, `/subscriptions/cancel`, `/subscriptions/update-payment-method` | Usuario |
| GET | `/subscriptions/invoices/{invoice_id}/pdf-url` | Usuario |
| GET · POST | `/admin/plans` | Admin |
| PUT · DELETE | `/admin/plans/{plan_id}` | Admin |
| POST | `/admin/plans/{plan_id}/prices` | Admin |
| DELETE | `/admin/plans/{plan_id}/prices/{currency}` | Admin |
| POST | `/webhooks/stripe` | Firma de Stripe (idempotente por `event_id`) |

### Integraciones (`integrations/`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/admin/integrations/status` | Admin |
| GET · POST | `/admin/integrations/vendors` | Admin |
| PUT · DELETE | `/admin/integrations/vendors/{vendor_id}` | Admin |
| GET | `/admin/integrations/vendors/{vendor_id}/config` (enmascarada) | Admin |
| POST | `/admin/integrations/vendors/{vendor_id}/test` | Admin |
| PUT | `/admin/integrations/vendors/{vendor_id}/set-default` | Admin |

### Salud

Fuera de `/api/v1`:

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/` | Nombre, versión, entorno y estado |
| GET | `/health` | `{"status": "ok"}` |

## Ejemplo rápido

```bash
# 1. Iniciar sesión
TOKEN=$(curl -s -X POST http://localhost:5172/api/v1/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "tu@correo.com", "password": "<tu-contraseña>"}' | jq -r .access_token)

# 2. Listar tus proyectos
curl -s http://localhost:5172/api/v1/projects -H "Authorization: Bearer $TOKEN"
```

!!! note
    Si la cuenta tiene MFA activo, el login no devuelve el token final sino `mfa_required` y un `mfa_token`, que se canjean por el token de acceso con `POST /mfa/verify`.
