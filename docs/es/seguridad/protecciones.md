# Protecciones

Controles que aplica DiagramaHub en la API, en los datos y en el navegador, además de la [autenticación](autenticacion.md).

## Headers de seguridad

El backend agrega estos headers a **todas** las respuestas de la API:

| Header | Valor | Cuándo |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Siempre |
| `X-Frame-Options` | `DENY` | Siempre |
| `X-XSS-Protection` | `1; mode=block` | Siempre |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Siempre |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Siempre |
| `Cache-Control` | `no-store` | Siempre |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Solo con `APP_ENV=production` |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` | Solo con `APP_ENV=production` |

!!! note "La CSP del frontend la define el operador"
    La CSP anterior cubre las respuestas JSON de la API. El HTML de la aplicación lo sirve el frontend (Nginx), así que su propia CSP se configura en el servidor web o en el proxy inverso. Ver [Producción](../self-host/produccion.md).

**CORS** solo acepta los orígenes de `BACKEND_CORS_ORIGINS` (o `FRONTEND_URL` si está vacío), con una lista explícita de métodos y headers.

## Endurecimiento en producción

Con `APP_ENV=production`:

- **Swagger UI, ReDoc y `/openapi.json` están desactivados.**
- Los errores no controlados responden `500 Internal server error`, **sin trazas**; el detalle solo va a los logs del servidor.
- Se activan HSTS y la CSP de la API.

## Cifrado y enmascaramiento de secretos

| Dato | Cómo se guarda | Cómo se muestra |
|---|---|---|
| Contraseñas | Hash BCrypt | Nunca se devuelven |
| Códigos MFA por email y códigos de recuperación | Hash BCrypt | Los de recuperación se muestran una sola vez |
| Secretos TOTP | Cifrados con **Fernet** | Nunca se devuelven tras la activación |
| API keys de proveedores de IA (BYOL) | Cifradas con **Fernet** | Enmascaradas: primeros 4 y últimos 3 caracteres (`AIza...xyz`) |
| Credenciales de integraciones (email, pagos, OAuth) | Cifradas | Enmascaradas: solo los últimos 4 caracteres |
| Códigos de acceso de enlaces protegidos | Hash BCrypt | Solo al crearlos, al dueño |

Fernet usa la llave `AI_ENCRYPTION_KEY`. Si se pierde, los secretos cifrados no se pueden recuperar: los usuarios tendrán que volver a cargar sus API keys y reconfigurar TOTP.

!!! warning "Respalda `AI_ENCRYPTION_KEY`"
    Guarda la llave junto con los respaldos de MongoDB, pero en un lugar distinto. Un respaldo de la base de datos sin la llave no permite descifrar los secretos, y la llave sin el respaldo no expone nada.

## Enlaces compartidos

- El token del enlace se genera con un generador criptográfico (`secrets.token_urlsafe(32)`) y es único.
- Los enlaces **protegidos** exigen un código de acceso de 4 a 20 caracteres (o uno generado de 6). Tras **5 códigos incorrectos en 15 minutos** desde la misma IP para el mismo enlace, el acceso se bloquea temporalmente.
- Las rutas públicas tienen su propio rate limit: **60 peticiones por IP por minuto**.
- Cada acceso se registra (éxito, vencido, código inválido, bloqueado, inexistente) con la **IP hasheada con SHA-256**, nunca la IP en claro.
- La expiración puede ser de 5, 10 o 30 días, o ilimitada; `allow_copy_code` decide si el visitante ve el código fuente.

Uso desde la app: [Compartir diagramas](../guia/compartir.md).

## Límites y validaciones en el servidor

- **Límites de plan** (`max_projects`, `max_diagrams`): se verifican en el servidor al crear recursos; el cliente no puede saltárselos.
- **Aislamiento por proyecto**: un diagrama solo puede guardarse en carpetas de su propio proyecto; una carpeta de otro proyecto responde como inexistente, sin revelar que existe.
- **Tamaño de petición**: 5 MB por defecto (`MAX_REQUEST_BODY_BYTES`); las importaciones de proyecto aceptan hasta 20 MB, con un máximo de 500 archivos y 50 MB descomprimidos.
- **Rate limits por uso**: render de diagramas en el servidor (60/min por IP), exportaciones e importaciones de proyectos (por usuario).
- **Webhooks de Stripe**: la firma se valida antes de procesar cualquier evento, y cada evento se
  aplica una sola vez (una entrega repetida se reconoce como duplicada por su `event_id`).

## Monitoreo con Sentry (opcional)

Sentry solo se inicializa si defines `SENTRY_DSN`. Antes de enviar un evento, el backend enmascara como `[Filtered]`:

- Los headers `Authorization` y `Cookie`.
- Los parámetros de cuerpo y de query llamados `api_key`, `password`, `token`, `secret` o `jwt`.

Si la sanitización falla, el evento **se descarta**; nunca se envía sin limpiar.

## Contenedores

- El backend corre como usuario sin privilegios (`app`, UID 1000).
- La imagen de producción del frontend sirve archivos estáticos con Nginx como usuario `nginx`, sin root.

## Navegador

- **Sanitización de SVG**: todo SVG renderizado pasa por **DOMPurify** antes de insertarse en el DOM, para evitar XSS a partir del contenido del diagrama.
- **Rutas protegidas**: `PrivateRoute` e `InstallationGuard` impiden entrar a vistas autenticadas sin sesión.
- **Interceptores**: el cliente HTTP adjunta el JWT y, ante un `401`, limpia la sesión.
