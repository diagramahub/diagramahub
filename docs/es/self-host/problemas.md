# Solución de problemas

Antes de nada, revisa el estado de los servicios y los logs:

```bash
docker-compose ps
docker-compose logs --tail=100 backend
bash verify-installation.sh
```

## Arranque

??? failure "El backend no arranca: `JWT_SECRET` field required"
    `JWT_SECRET` es la única variable sin valor por defecto. Agrégala a `backend/.env`
    (ver [Configuración](configuracion.md#seguridad)) y recrea el contenedor:
    `docker-compose up -d backend`.

??? failure "No conecta a MongoDB"
    === "MongoDB local (contenedor)"

        ```bash
        docker-compose ps mongodb
        docker-compose logs mongodb
        docker-compose restart mongodb
        ```

    === "MongoDB externo"

        - Revisa `MONGO_URI` en `backend/.env` (usuario, contraseña, host).
        - Comprueba que la red del servidor tenga acceso al clúster (en Atlas, la lista de
          IPs permitidas).
        - Prueba la cadena de conexión fuera de DiagramaHub con `mongosh "<MONGO_URI>"`.

??? failure "El puerto ya está en uso (`port is already allocated`)"
    ```bash
    lsof -i :5172      # o :5173 / :27017
    kill <PID>
    ```
    O cambia el puerto publicado en el `docker-compose.yml` del modo que uses.

??? failure "`permission denied while trying to connect to the Docker daemon`"
    En Linux, agrega tu usuario al grupo `docker` y vuelve a iniciar sesión:
    `sudo usermod -aG docker $USER`. En macOS/Windows, abre Docker Desktop.

??? failure "La API no responde en el puerto 5172"
    Los compose fijan `PORT=5172`. Hasta 0.8.3, el de `external-mongodb` no lo hacía y el
    backend escuchaba en `8000`: actualiza el archivo del compose (o agrega `PORT=5172` en su
    sección `environment`) y recrea el backend. El log de arranque muestra el puerto real
    (`Port: ...`).

## Navegador y conexión con la API

??? failure "El frontend carga, pero todas las peticiones fallan por CORS"
    - El origen del frontend debe estar en `BACKEND_CORS_ORIGINS`, o ser igual a
      `FRONTEND_URL` si esa variable está vacía.
    - `BACKEND_CORS_ORIGINS` se separa por comas: `https://a.ejemplo.com,https://b.ejemplo.com`.
      Hasta 0.8.3, el formato con corchetes `["https://a.ejemplo.com"]` dejaba orígenes
      inválidos; desde 0.8.4 se acepta.
    - Incluye el esquema y el puerto exactos (`http://localhost:5173` ≠ `http://127.0.0.1:5173`).

??? failure "El frontend llama a `localhost:5172` en producción"
    `VITE_API_URL` debe ser la URL pública de la API. En la imagen de producción se lee al
    arrancar el contenedor: corrígela y recrea el frontend
    (`docker-compose up -d frontend`). Comprueba el valor activo en
    `https://<tu-frontend>/config.js`.

??? failure "Página en blanco"
    ```bash
    docker-compose logs frontend
    docker-compose build frontend --no-cache
    docker-compose up -d frontend
    ```
    Abre la consola del navegador: si ves violaciones de CSP, revisa la política que
    agregaste a `frontend/headers.conf` ([Producción](produccion.md#content-security-policy-del-frontend)).

??? failure "`/docs` devuelve 404"
    Es lo esperado con `APP_ENV=production`: Swagger, ReDoc y `/openapi.json` están
    desactivados. Usa una instancia con `APP_ENV=development` para explorarlos.

## Funcionalidades

??? failure "No se puede guardar un proveedor de IA, una integración o activar MFA por app"
    El log del backend muestra `AI_ENCRYPTION_KEY not configured`. Genera una clave Fernet,
    agrégala a `backend/.env` y recrea el backend
    ([Configuración](configuracion.md#seguridad)).

??? failure "Las integraciones o el MFA dejaron de funcionar después de mover o restaurar la instancia"
    El `AI_ENCRYPTION_KEY` actual no es el que cifró los datos. Restaura la clave original o
    configura de nuevo las integraciones y los proveedores de IA.

??? failure "No llegan los correos de recuperación de contraseña ni los códigos MFA"
    Hace falta un motor de email **predeterminado** con la prueba de conexión superada en
    **Integraciones** ([Email](integraciones.md#email-resend)). Revisa también que el
    remitente pertenezca a un dominio verificado en Resend.

??? failure "PlantUML, D2 o DBML no se renderizan"
    Esos tipos se renderizan en el servidor con Kroki (Mermaid se renderiza en el navegador).

    ```bash
    docker-compose ps kroki
    docker-compose logs kroki
    ```

    El backend responde `400` si el código tiene un error de sintaxis, `502` si Kroki falla,
    `504` si tarda demasiado y `429` si una IP supera los 60 renders por minuto. Si Kroki corre en otro host, revisa
    `KROKI_URL`.

??? failure "Error 413 al guardar un dibujo o importar un proyecto"
    La petición superó el límite de tamaño:

    - Peticiones normales: `MAX_REQUEST_BODY_BYTES` (5 MB).
    - Importaciones: `MAX_IMPORT_UPLOAD_BYTES` (20 MB), `MAX_IMPORT_FILES` (500) y
      `MAX_IMPORT_UNCOMPRESSED_BYTES` (50 MB).

    Detrás de Nginx, sube también `client_max_body_size`, cuyo valor por defecto es 1 MB.

??? failure "Error 403 al crear un proyecto o diagrama"
    El usuario alcanzó el límite de su plan. Cámbialo de plan o amplía los límites del plan
    ([Planes y límites](planes.md)).

??? failure "No se pueden crear planes de pago"
    Un plan con precio requiere una pasarela Stripe activa
    ([Integraciones](integraciones.md#pagos-stripe)).

??? failure "Stripe cobra, pero la suscripción no cambia"
    El webhook no está llegando o su secreto no coincide.

    - El endpoint es `POST /api/v1/webhooks/stripe` y debe ser accesible desde internet (o
      redirigido con `stripe listen` en desarrollo).
    - El *webhook secret* configurado debe ser el del endpoint (o el que imprime
      `stripe listen`).
    - Revisa los intentos de entrega en el dashboard de Stripe y
      `docker-compose logs backend | grep -i webhook`.

??? failure "Un usuario no puede iniciar sesión: demasiados intentos"
    - Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.
    - Cada IP puede intentar 10 inicios de sesión por minuto.

    Estos contadores viven en memoria: reiniciar el backend los limpia. Detrás de un proxy,
    revisa [Límites por IP](produccion.md#reverse-proxy-y-https).

??? failure "El login con Google falla al volver de Google"
    La *URI de redirección* configurada en DiagramaHub debe ser idéntica a la registrada en
    Google Cloud y apuntar a la ruta `/oauth/callback` del frontend
    ([Google OAuth](integraciones.md#inicio-de-sesion-con-google-oauth)).

## Empezar de cero

```bash
# Borra contenedores, red y volúmenes: se pierde la base de datos local
docker-compose down -v
docker-compose up -d --build
```

Al abrir el frontend de nuevo aparece el asistente `/setup` para crear el administrador.
