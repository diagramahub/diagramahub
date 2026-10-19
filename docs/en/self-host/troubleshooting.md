# Troubleshooting

First of all, check the services' status and logs:

```bash
docker-compose ps
docker-compose logs --tail=100 backend
bash verify-installation.sh
```

## Startup

??? failure "The backend doesn't start: `JWT_SECRET` field required"
    `JWT_SECRET` is the only variable without a default. Add it to `backend/.env`
    (see [Configuration](configuration.md#security)) and recreate the container:
    `docker-compose up -d backend`.

??? failure "Cannot connect to MongoDB"
    === "Local MongoDB (container)"

        ```bash
        docker-compose ps mongodb
        docker-compose logs mongodb
        docker-compose restart mongodb
        ```

    === "External MongoDB"

        - Check `MONGO_URI` in `backend/.env` (user, password, host).
        - Make sure the server's network can reach the cluster (in Atlas, the IP access
          list).
        - Test the connection string outside DiagramaHub with `mongosh "<MONGO_URI>"`.

??? failure "Port already in use (`port is already allocated`)"
    ```bash
    lsof -i :5172      # or :5173 / :27017
    kill <PID>
    ```
    Or change the published port in the `docker-compose.yml` of the mode you use.

??? failure "`permission denied while trying to connect to the Docker daemon`"
    On Linux, add your user to the `docker` group and sign in again:
    `sudo usermod -aG docker $USER`. On macOS/Windows, open Docker Desktop.

??? failure "The API doesn't answer on port 5172"
    The compose files set `PORT=5172`. Up to 0.8.3 the `external-mongodb` one didn't, and the
    backend listened on `8000`: update the compose file (or add `PORT=5172` to its
    `environment` section) and recreate the backend. The startup log shows the real port
    (`Port: ...`).

## Browser and API connection

??? failure "The frontend loads, but every request fails with CORS"
    - The frontend's origin must be in `BACKEND_CORS_ORIGINS`, or equal to `FRONTEND_URL`
      when that variable is empty.
    - `BACKEND_CORS_ORIGINS` is comma-separated: `https://a.example.com,https://b.example.com`.
      Up to 0.8.3 the bracketed format `["https://a.example.com"]` produced invalid origins;
      since 0.8.4 it is accepted.
    - Use the exact scheme and port (`http://localhost:5173` ≠ `http://127.0.0.1:5173`).

??? failure "The frontend calls `localhost:5172` in production"
    `VITE_API_URL` must be the public API URL. In the production image it is read when the
    container starts: fix it and recreate the frontend (`docker-compose up -d frontend`).
    Check the active value at `https://<your-frontend>/config.js`.

??? failure "Blank page"
    ```bash
    docker-compose logs frontend
    docker-compose build frontend --no-cache
    docker-compose up -d frontend
    ```
    Open the browser console: if you see CSP violations, review the policy you added to
    `frontend/headers.conf` ([Production](production.md#frontend-content-security-policy)).

??? failure "`/docs` returns 404"
    That is expected with `APP_ENV=production`: Swagger, ReDoc and `/openapi.json` are
    disabled. Use an instance with `APP_ENV=development` to browse them.

## Features

??? failure "An AI provider or integration can't be saved, or authenticator-app MFA can't be enabled"
    The backend log shows `AI_ENCRYPTION_KEY not configured`. Generate a Fernet key, add it
    to `backend/.env` and recreate the backend ([Configuration](configuration.md#security)).

??? failure "Integrations or MFA stopped working after moving or restoring the instance"
    The current `AI_ENCRYPTION_KEY` is not the one that encrypted the data. Restore the
    original key or configure the integrations and AI providers again.

??? failure "Password recovery emails and MFA codes don't arrive"
    You need a **default** email engine that passed its connection test in
    **Integrations** ([Email](integrations.md#email-resend)). Also check that the sender
    belongs to a domain verified in Resend.

??? failure "PlantUML, D2 or DBML don't render"
    Those types are rendered on the server by Kroki (Mermaid renders in the browser).

    ```bash
    docker-compose ps kroki
    docker-compose logs kroki
    ```

    The backend answers `400` if the code has a syntax error, `502` if Kroki fails, `504`
    if it takes too long and `429` if one IP exceeds 60 renders per minute. If Kroki runs
    on another host, check `KROKI_URL`.

??? failure "Error 413 when saving a drawing or importing a project"
    The request exceeded the size limit:

    - Regular requests: `MAX_REQUEST_BODY_BYTES` (5 MB).
    - Imports: `MAX_IMPORT_UPLOAD_BYTES` (20 MB), `MAX_IMPORT_FILES` (500) and
      `MAX_IMPORT_UNCOMPRESSED_BYTES` (50 MB).

    Behind Nginx, also raise `client_max_body_size`, which defaults to 1 MB.

??? failure "Error 403 when creating a project or diagram"
    The user reached their plan's limit. Move them to another plan or raise the plan's
    limits ([Plans and limits](plans.md)).

??? failure "Paid plans can't be created"
    A plan with a price requires an active Stripe gateway
    ([Integrations](integrations.md#payments-stripe)).

??? failure "Stripe charges, but the subscription doesn't change"
    The webhook isn't arriving or its secret doesn't match.

    - The endpoint is `POST /api/v1/webhooks/stripe` and must be reachable from the
      internet (or forwarded with `stripe listen` in development).
    - The configured *webhook secret* must be the endpoint's (or the one `stripe listen`
      prints).
    - Check delivery attempts in the Stripe dashboard and
      `docker-compose logs backend | grep -i webhook`.

??? failure "A user can't sign in: too many attempts"
    - After 5 failed attempts the account is locked for 15 minutes.
    - Each IP can try 10 sign-ins per minute.

    These counters live in memory: restarting the backend clears them. Behind a proxy, see
    [Per-IP limits](production.md#reverse-proxy-and-https).

??? failure "Google sign-in fails when coming back from Google"
    The *redirect URI* configured in DiagramaHub must be identical to the one registered in
    Google Cloud and point to the frontend's `/oauth/callback` route
    ([Google OAuth](integrations.md#sign-in-with-google-oauth)).

## Start from scratch

```bash
# Removes containers, network and volumes: the local database is lost
docker-compose down -v
docker-compose up -d --build
```

When you open the frontend again, the `/setup` wizard appears to create the administrator.
