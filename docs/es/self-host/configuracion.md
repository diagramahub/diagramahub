# Configuración

DiagramaHub se configura con variables de entorno. El backend las lee de `backend/.env`
(montado en el contenedor con `env_file`) y el frontend las recibe del archivo de Docker
Compose. Esta página es la referencia completa: todo lo que no aparece aquí no es
configurable por entorno.

!!! tip "Después de cambiar una variable"
    El backend lee la configuración al arrancar. Recrea el contenedor para aplicar cambios:
    `docker-compose up -d backend` (o `frontend`). Un `restart` no vuelve a leer `env_file`.

## Backend (`backend/.env`)

Las variables se definen en `backend/app/core/config.py` y distinguen mayúsculas de
minúsculas.

### Base de datos

| Variable | Valor por defecto | Obligatoria | Descripción |
|---|---|---|---|
| `MONGO_URI` | `mongodb://mongodb:27017` | Sí en modo `external-mongodb` | Cadena de conexión a MongoDB. En `local-full` el valor por defecto apunta al contenedor `mongodb`. Acepta `mongodb+srv://` (Atlas). |
| `DATABASE_NAME` | `diagramahub` | No | Nombre de la base de datos. |

### Seguridad

| Variable | Valor por defecto | Obligatoria | Descripción |
|---|---|---|---|
| `JWT_SECRET` | — | **Sí** | Secreto para firmar los tokens de sesión. Sin él, el backend no arranca. Mínimo 32 caracteres aleatorios. Cambiarlo cierra todas las sesiones. |
| `JWT_ALGORITHM` | `HS256` | No | Algoritmo de firma de los JWT. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | No | **Sin efecto.** Se acepta para no romper archivos `.env` existentes, pero la duración de la sesión la fija cada inicio de sesión (ver [Autenticación](../seguridad/autenticacion.md)). |
| `AI_ENCRYPTION_KEY` | vacío | **Sí, en la práctica** | Clave Fernet que cifra en la base de datos las API keys de los proveedores de IA, la configuración de las integraciones (Resend, Stripe, Google) y los secretos TOTP del MFA. Si falta, esas operaciones fallan. |

Genera ambos secretos así:

```bash
# JWT_SECRET
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# AI_ENCRYPTION_KEY (requiere el paquete cryptography)
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

!!! danger "Respalda `AI_ENCRYPTION_KEY` junto con la base de datos"
    Lo que se cifró con una clave solo se descifra con esa misma clave. Si la pierdes o la
    cambias, las API keys de IA, las integraciones y el MFA por app de todos los usuarios
    quedan ilegibles y hay que configurarlos de nuevo.

!!! note "`install.sh` genera `AI_ENCRYPTION_KEY`"
    El instalador crea `backend/.env` con `MONGO_URI`, `DATABASE_NAME`, `JWT_SECRET`,
    `AI_ENCRYPTION_KEY` y `API_V1_PREFIX`. Si vuelves a ejecutarlo, conserva la
    `AI_ENCRYPTION_KEY` que ya exista. En instalaciones hechas con versiones anteriores a 0.8.4,
    agrégala a mano si falta y recrea el backend.

### URLs y CORS

| Variable | Valor por defecto | Obligatoria | Descripción |
|---|---|---|---|
| `FRONTEND_URL` | `http://localhost:5173` | Sí en producción | URL pública del frontend. Se usa en las redirecciones de Stripe Checkout, en el enlace de recuperación de contraseña y en la URL de los enlaces compartidos. Si `BACKEND_CORS_ORIGINS` está vacío, es también el único origen CORS permitido. |
| `BACKEND_CORS_ORIGINS` | vacío | No | Orígenes permitidos por CORS, **separados por comas**: `https://diagramas.ejemplo.com,https://www.ejemplo.com`. |
| `API_V1_PREFIX` | `/api/v1` | No | Prefijo de las rutas de la API. El frontend asume `/api/v1`: no lo cambies. |

!!! note "Formato de `BACKEND_CORS_ORIGINS`"
    Escribe los orígenes separados por comas, sin corchetes ni comillas. Desde 0.8.4 también
    se acepta el formato con corchetes (`["http://localhost:5173"]`) que traían los archivos
    de ejemplo anteriores: los corchetes y las comillas se descartan.

### Entorno y servidor

| Variable | Valor por defecto | Obligatoria | Descripción |
|---|---|---|---|
| `APP_ENV` | `production` | No | `production` desactiva Swagger/ReDoc/OpenAPI, oculta las trazas de error, activa HSTS y CSP en las respuestas de la API y arranca con gunicorn. `development` (o `dev`) arranca uvicorn con recarga en caliente. |
| `PORT` | `8000` (imagen) | No | Puerto en el que escucha el backend dentro del contenedor. Los dos compose (`local-full` y `external-mongodb`) lo fijan en `5172`, el puerto publicado, y ese valor tiene prioridad sobre `backend/.env`. |
| `WORKERS` | `2` | No | Procesos de gunicorn en modo producción. Los límites de peticiones se cuentan por proceso (ver [Producción](produccion.md#limites-de-peticiones-y-workers)). |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1,::1` | Sí detrás de un proxy | Proxies de los que el backend acepta `X-Forwarded-For` y `X-Forwarded-Proto` (IPs o redes CIDR separadas por comas). Solo esas conexiones pueden cambiar la IP de cliente que usan los límites de peticiones, el bloqueo de cuentas y el registro de auditoría. Ver [Producción](produccion.md#ip-real-del-cliente-detras-del-proxy). |

### Render de diagramas

| Variable | Valor por defecto | Obligatoria | Descripción |
|---|---|---|---|
| `KROKI_URL` | `http://kroki:8000` | No | URL del servicio Kroki que renderiza PlantUML, D2 y DBML. Cámbiala solo si Kroki corre en otro host. |

### Límites de peticiones

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `MAX_REQUEST_BODY_BYTES` | `5242880` (5 MB) | Tamaño máximo del cuerpo de cualquier petición; si se excede, la API responde `413`. Es generoso porque los dibujos a mano alzada se guardan como JSON. También es el tamaño máximo de cada archivo dentro de una importación. |
| `MAX_IMPORT_UPLOAD_BYTES` | `20971520` (20 MB) | Tamaño máximo de una subida de importación de proyecto (ZIP o archivos sueltos). |
| `MAX_IMPORT_FILES` | `500` | Número máximo de archivos en una importación. |
| `MAX_IMPORT_UNCOMPRESSED_BYTES` | `52428800` (50 MB) | Tamaño máximo que puede ocupar un ZIP una vez descomprimido. |

### Monitoreo (opcional)

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `SENTRY_DSN` | vacío | DSN de Sentry para el backend. Vacío = Sentry desactivado. |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | Fracción de transacciones que se envían para medir rendimiento (0.0–1.0). |
| `SENTRY_ENABLE_LOGS` | `True` | Envía los logs a Sentry. |

Los eventos se sanitizan antes de enviarse (ver [Mantenimiento](mantenimiento.md#monitoreo-con-sentry)).

### Stripe por variables de entorno (alternativa)

La forma recomendada de conectar Stripe es el panel de [Integraciones](integraciones.md#pagos-stripe).
Si no hay una pasarela activa configurada ahí, el backend usa estas variables:

| Variable | Descripción |
|---|---|
| `STRIPE_SECRET_KEY` | Clave secreta (`sk_...`). Obligatoria junto con el webhook secret. |
| `STRIPE_WEBHOOK_SECRET` | Secreto de firma del webhook (`whsec_...`). |
| `STRIPE_PUBLISHABLE_KEY` | Clave pública (`pk_...`). |

### Variables que no debes definir

`PROJECT_NAME` y `VERSION` también son campos de configuración, pero los fija el código.
Si `backend/.env` define `VERSION` (la plantilla `backend/.env.template` lo incluía con
`VERSION=1.0.0` hasta 0.8.3), la API reporta una versión falsa en `/` y en Sentry. Bórralo de
tu `.env`.

### Ejemplo mínimo

=== "local-full (desarrollo)"

    ```env
    MONGO_URI=mongodb://mongodb:27017
    DATABASE_NAME=diagramahub
    JWT_SECRET=<secreto-aleatorio-de-32+-caracteres>
    AI_ENCRYPTION_KEY=<clave-fernet>
    APP_ENV=development
    FRONTEND_URL=http://localhost:5173
    ```

=== "external-mongodb (producción)"

    ```env
    MONGO_URI=mongodb+srv://<usuario>:<contraseña>@<cluster>/
    DATABASE_NAME=diagramahub
    JWT_SECRET=<secreto-aleatorio-de-32+-caracteres>
    AI_ENCRYPTION_KEY=<clave-fernet>
    APP_ENV=production
    PORT=5172
    FRONTEND_URL=https://diagramas.ejemplo.com
    BACKEND_CORS_ORIGINS=https://diagramas.ejemplo.com
    ```

## Frontend

El frontend lee su configuración en este orden:

1. `/config.js` (`window.__DH_CONFIG__`), que la imagen de **producción** genera al
   arrancar el contenedor a partir de las variables de entorno. Cambiar un valor solo
   requiere recrear el contenedor, no reconstruir la imagen.
2. Las variables `VITE_*` integradas en el build (imagen de **desarrollo**, o un hosting
   estático sin contenedor, donde cambiar un valor obliga a reconstruir).

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5172` | URL **pública** de la API, tal como la ve el navegador del usuario (no la URL interna de Docker). |
| `VITE_SENTRY_DSN` | vacío | DSN de Sentry para el frontend. Vacío = desactivado. |
| `VITE_APP_ENV` | `production` (imagen prod) | Entorno que se reporta a Sentry. |
| `VITE_APP_VERSION` | versión de `package.json` | Versión que se reporta a Sentry como *release*. Normalmente no hace falta definirla. |

En el modo `external-mongodb` el compose toma `VITE_API_URL`, `VITE_SENTRY_DSN` y
`VITE_APP_ENV` del shell o de un archivo `.env` junto al `docker-compose.yml`:

```env
# .env en la raíz del repositorio (junto a docker-compose.yml)
VITE_API_URL=https://api.diagramas.ejemplo.com
```

En `local-full`, `VITE_API_URL` está fijado a `http://localhost:5172` en el compose.

## Siguientes pasos

- [Producción](produccion.md): qué cambia al exponer la instancia a internet.
- [Integraciones](integraciones.md): email, pagos y Google OAuth.
