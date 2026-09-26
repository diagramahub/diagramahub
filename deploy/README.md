# DiagramHub Deployment Configurations

This directory contains different Docker Compose configurations for various deployment scenarios.

## Available Deployment Scenarios

### 1. Local Full Stack (`local-full/`)

**Use case:** Local development or self-hosted installations with all services included.

**What's included:**
- ✅ MongoDB (Docker container)
- ✅ Backend (FastAPI)
- ✅ Frontend (React + Vite)

**MongoDB configuration:**
- Local MongoDB running in Docker
- Data persisted in Docker volume `mongodb_data`
- Accessible at `mongodb://mongodb:27017` (from containers)
- Exposed on host at `localhost:27017`

**Environment variables required in `backend/.env`:**
```bash
MONGO_URI=mongodb://mongodb:27017
DATABASE_NAME=diagramahub
JWT_SECRET=<your-secret-here>
ACCESS_TOKEN_EXPIRE_MINUTES=30
API_V1_PREFIX=/api/v1
```

**Start services:**
```bash
cd deploy/local-full
docker-compose up -d
```

---

### 2. External MongoDB (`external-mongodb/`)

**Use case:** Production deployments using managed MongoDB services (Atlas, AWS DocumentDB, etc.)

**What's included:**
- ✅ Backend (FastAPI)
- ✅ Frontend (React + Vite)
- ❌ MongoDB (expects external connection)

**MongoDB configuration:**
- External MongoDB instance (MongoDB Atlas, custom server, etc.)
- Connection configured via `MONGO_URI` in `.env`
- No local MongoDB container

**Environment variables required in `backend/.env`:**
```bash
MONGO_URI=mongodb+srv://<db-user>:<db-password>@cluster.mongodb.net/
# OR for standard connection:
# MONGO_URI=mongodb://<db-user>:<db-password>@host:27017/
DATABASE_NAME=diagramahub
JWT_SECRET=<your-secret-here>
ACCESS_TOKEN_EXPIRE_MINUTES=30
API_V1_PREFIX=/api/v1
```

**Start services:**
```bash
cd deploy/external-mongodb
docker-compose up -d
```

---

## How the Installer Uses These Configurations

The `install.sh` script automatically selects the appropriate configuration based on user choice:

1. **User selects MongoDB option** during installation
2. **Installer creates symlink** from root `docker-compose.yml` to the selected deployment scenario
3. **Services start** with the correct configuration

### Example:

```bash
# If user chooses "Local MongoDB (Docker)"
docker-compose.yml -> deploy/local-full/docker-compose.yml

# If user chooses "External MongoDB"
docker-compose.yml -> deploy/external-mongodb/docker-compose.yml
```

---

## Switching Between Configurations

If you need to switch from one configuration to another:

### Option 1: Re-run the installer
```bash
./install.sh
```

### Option 2: Manual switch

**Switch to local-full:**
```bash
# Stop current services
docker-compose down

# Remove old symlink
rm docker-compose.yml

# Create new symlink
ln -sf deploy/local-full/docker-compose.yml docker-compose.yml

# Update backend/.env with local MongoDB URI
# MONGO_URI=mongodb://mongodb:27017

# Start services
docker-compose up -d
```

**Switch to external-mongodb:**
```bash
# Stop current services
docker-compose down

# Remove old symlink
rm docker-compose.yml

# Create new symlink
ln -sf deploy/external-mongodb/docker-compose.yml docker-compose.yml

# Update backend/.env with external MongoDB URI
# MONGO_URI=mongodb+srv://<db-user>:<db-password>@cluster.mongodb.net/

# Start services
docker-compose up -d
```

---

## Common Commands

All commands assume you're in the project root directory:

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild and restart
docker-compose up -d --build

# Check service status
docker-compose ps
```

---

## Access Points

Once services are running:

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5172
- **API Documentation:** http://localhost:5172/docs (local-full only; disabled when `APP_ENV=production`)
- **MongoDB (local-full only):** localhost:27017

---

## Publishing on a Domain

The shipped configurations assume everything runs on `localhost`. Before exposing an
installation on a public domain, three settings have to change — otherwise the browser
blocks the API and Stripe sends users back to their own machine:

- **`BACKEND_CORS_ORIGINS`** in `backend/.env` — comma-separated list of the origins
  allowed to call the API, e.g. `https://diagramahub.example.com`. When left empty the
  backend falls back to `FRONTEND_URL`.
- **`FRONTEND_URL`** in `backend/.env` — the public frontend URL used by Stripe
  checkout redirects and email links.
- **`VITE_API_URL`** — the public API URL. It lives in the compose file rather than in
  `backend/.env`, and the frontend reads it when Vite starts, so changing it means
  recreating the frontend container.

Two more things to keep in mind:

- The backend serves `/docs` and `/redoc` only when `APP_ENV` is not `production`.
  The external-Mongo configuration builds with `APP_ENV=production` and runs gunicorn
  through `start.sh`; set `APP_ENV=development` in `backend/.env` (then recreate the
  container) only if you want the interactive API docs on a private installation.
- Terminate TLS in a reverse proxy (Nginx, Traefik, Caddy) instead of publishing ports
  5172 and 5173 directly. `INSTALL.md` includes an Nginx example with certbot.

### Managed platforms (e.g. DigitalOcean App Platform)

Docker Compose is not used on a managed platform: each service is an app and the
variables are set in the platform's own settings, not in a file. The same three
settings from above still apply, plus a few platform-specific details:

- **Backend and frontend as separate apps** — set `BACKEND_CORS_ORIGINS` to the
  frontend app's public URL and `VITE_API_URL` to the backend app's public URL.
  `VITE_API_URL` is read when the frontend is **built**, so it belongs to the
  frontend app's build settings.
- **`PORT`** — the backend honours the `PORT` environment variable, which is what
  platforms assign. No change needed.
- **`KROKI_URL`** — defaults to `http://kroki:8000`, a Compose-internal hostname
  that will not resolve outside Docker. Point it at a reachable Kroki (the public
  `https://kroki.io`, or your own deployment) or server-side rendering fails.
- **`APP_ENV`** — leave it at `production` for gunicorn and HSTS; note that this
  also disables `/docs`, `/redoc` and stack traces.
- **No bind mounts** — the Compose files mount `backend/app` and `frontend/src`
  so code edits apply without rebuilding. A managed platform builds the image
  from the repository, so every change needs a new build and deploy.

---

## Adding New Deployment Scenarios

To add a new deployment configuration:

1. **Create new directory** under `deploy/`
   ```bash
   mkdir deploy/my-new-scenario
   ```

2. **Create `docker-compose.yml`** with your configuration
   ```bash
   touch deploy/my-new-scenario/docker-compose.yml
   ```

3. **Update paths** to point to `../../backend` and `../../frontend`

4. **Update `install.sh`** to include the new scenario as an option

5. **Document** the new scenario in this README

---

## Troubleshooting

### "service depends on undefined service" error

This usually happens when:
- Using external-mongodb config but `MONGO_URI` points to `mongodb://mongodb:27017`
- The symlink is pointing to the wrong configuration

**Solution:**
1. Check which config is active: `ls -l docker-compose.yml`
2. Verify `backend/.env` has the correct `MONGO_URI` for your scenario
3. Recreate the symlink if needed

### MongoDB connection errors

**For local-full:**
- Ensure MongoDB container is running: `docker-compose ps`
- Check MongoDB logs: `docker-compose logs mongodb`
- Verify `MONGO_URI=mongodb://mongodb:27017` in `backend/.env`

**For external-mongodb:**
- Test connection string with `mongosh` or MongoDB Compass
- Ensure IP whitelist includes your host (for Atlas)
- Verify credentials in `MONGO_URI`

### Port conflicts

If ports 5172, 5173, or 27017 are already in use:

1. Stop conflicting services
2. Or modify port mappings in the docker-compose.yml files
3. Restart services

---

## Architecture

```
DiagramHub Project Root
│
├── deploy/                          # Deployment configurations
│   ├── local-full/                  # Scenario 1
│   │   └── docker-compose.yml       # Full stack config
│   │
│   ├── external-mongodb/            # Scenario 2
│   │   └── docker-compose.yml       # External DB config
│   │
│   └── README.md                    # This file
│
├── backend/                         # FastAPI application
├── frontend/                        # React application
├── docker-compose.yml               # Symlink to active config
└── install.sh                       # Installation wizard
```

---

## License

Apache 2.0 - See LICENSE file for details
