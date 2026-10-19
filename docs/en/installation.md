# Installation Guide

Welcome to the DiagramaHub installation guide. We have prepared tools to facilitate the deployment of the application for both local development environments and production setups.

!!! tip "After installing"
    The full variable reference is in [Configuration](self-host/configuration.md). Before exposing the instance to the internet, follow the [Production](self-host/production.md) guide. If something fails, see [Troubleshooting](self-host/troubleshooting.md).

Our recommended and primary tool is the `install.sh` installer, an interactive script that takes care of installing prerequisites, cloning the repository, and configuring the project for you.

## Automatic Installer (`install.sh`)

The `install.sh` file is designed to offer a smooth, terminal-based experience (a "Next, Next" style wizard). When run interactively, it performs the following:

1. **OS Detection:** Automatically detects if you are on macOS, Ubuntu/Debian, CentOS/RHEL, or Fedora.
2. **Checks and Installation:** Verifies if you have `git`, `docker`, and `docker compose` installed. If not, it offers to install them automatically.
3. **Cloning:** Downloads the GitHub repository and places it in `$HOME/diagramahub`.
4. **MongoDB Configuration:** Interactive wizard to choose between local MongoDB (Docker) or external MongoDB (Atlas, DocumentDB, etc.).
5. **Security and Variables:** Cryptographically generates the `JWT_SECRET` (32 bytes, base64) and the `AI_ENCRYPTION_KEY` (a Fernet key; an existing one in `backend/.env` is kept) and builds the `backend/.env` file automatically.
6. **Docker Compose:** Creates a symlink from `docker-compose.yml` to the chosen deployment mode.
7. **Build and Start:** Builds Docker images and starts all services.
8. **Verification:** Waits 15 seconds and checks that all services are running.

---

### Environment 1: Development / Local Environment (Local Full Stack) 🐳

This level is recommended if you want to **explore the application**, **test new versions**, or **perform fast local development**.

**Key aspects:**

* Manages a **MongoDB 8** database in a Docker container with a persistent volume.
* Deploys **Kroki** (server-side rendering for PlantUML, D2 and DBML), reachable only inside the Docker network.
* Deploys the Backend (FastAPI on port 5172).
* Deploys the Frontend (Vite/React on port 5173).
* Hot reload enabled: backend via uvicorn `--reload`, frontend via Vite HMR.
* All data is saved in a persistent Docker volume (`mongodb_data`).

**What happens internally?**

The installer links the main orchestrator to `deploy/local-full/docker-compose.yml`, which has all 4 services declared: `mongodb`, `kroki`, `backend`, and `frontend`.

---

### Environment 2: Production (External MongoDB) 🌐

This environment is designed for **Production** setups. The best practice in Kubernetes or the cloud is to separate the database layer from the stateless application containers.

**Key aspects:**

* **It does not initialize the MongoDB container.**
* The script will prompt you for your connection string and external URI (e.g., MongoDB Atlas, Amazon DocumentDB, or a self-hosted DB).
* It only spins up Kroki, the Backend and the Frontend in Docker, which communicate with your cloud database.
* The backend runs in production mode (`APP_ENV=production`, gunicorn, no Swagger) and the frontend is served as a static build by non-root Nginx.
* Ideal because it offloads the backup and recovery management of your main database to a managed service.

**What happens internally?**

The installer links the main orchestrator to `deploy/external-mongodb/docker-compose.yml`, where only Kroki, the API and the Client are defined. Details in [Production](self-host/production.md#deployment-modes).

---

## Running the "One Line Installer"

If you wish to use the quick installation, open a terminal on the server where you want to install and run one of the following commands:

```bash
# Option 1 (Via curl)
bash <(curl -fsSL https://raw.githubusercontent.com/diagramahub/diagramahub/main/install.sh)

# Option 2 (Via wget)
wget -qO- https://raw.githubusercontent.com/diagramahub/diagramahub/main/install.sh | bash
```

---

## Manual Installation

If you prefer manual installation, ensure you have:

- **Docker** (20.10 or higher)
- **Docker Compose** (2.0 or higher)
- **Git**

### 1. Clone the repository

```bash
git clone https://github.com/diagramahub/diagramahub.git
cd diagramahub
```

### 2. Configure environment variables

Create the `backend/.env` file from the example:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and configure at least:

```env
# MongoDB
MONGO_URI=mongodb://mongodb:27017          # For local Docker MongoDB
# MONGO_URI=mongodb+srv://<db-user>:<db-password>@cluster.mongodb.net/  # For external MongoDB
DATABASE_NAME=diagramahub

# JWT (generate a secure secret)
JWT_SECRET=your-secure-secret-here-min-32-characters

# API
API_V1_PREFIX=/api/v1

# CORS (allowed origins, comma-separated)
BACKEND_CORS_ORIGINS=http://localhost:5173

# Environment
APP_ENV=development

# Frontend URL (Stripe redirects, email and share links)
FRONTEND_URL=http://localhost:5173

# Encrypts AI API keys, integrations and MFA (needed in practice)
AI_ENCRYPTION_KEY=<fernet-key>
```

!!! note "`BACKEND_CORS_ORIGINS`"
    The value is a comma-separated list, without brackets: `http://localhost:5173,https://diagrams.example.com`.

To generate a secure JWT secret:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

To generate `AI_ENCRYPTION_KEY` (without it, AI providers, integrations and authenticator-app MFA cannot be saved):

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 3. Choose deployment mode

```bash
# For local MongoDB (development):
ln -sf deploy/local-full/docker-compose.yml docker-compose.yml

# For external MongoDB (production):
ln -sf deploy/external-mongodb/docker-compose.yml docker-compose.yml
```

> **Note:** `docker-compose.yml` is in `.gitignore` so your local choice doesn't interfere with updates.

### 4. Build and start

```bash
docker-compose up -d --build
```

---

## Verifying the Installation

### Automatic verification script

The project includes a script that checks all services are running:

```bash
bash verify-installation.sh
```

### Manual verification

```bash
# Service status
docker-compose ps

# Test the backend
curl http://localhost:5172/

# Test the health check
curl http://localhost:5172/health

# Access API documentation
# Swagger UI: http://localhost:5172/docs
# ReDoc: http://localhost:5172/redoc

# Access the frontend
# http://localhost:5173
```

### Test scripts

```bash
# API tests (registration, login, password reset, etc.)
bash test-api.sh

# Onboarding flow tests
bash test-onboarding.sh
```

---

## Useful Post-Installation Commands

Everything runs via Docker Compose. Poetry and npm are not used directly on the host machine.

```bash
# View general logs
docker-compose logs -f

# View logs per service
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Update to the latest version
git pull
docker-compose build
docker-compose up -d
```

### Backend commands (inside the container)

```bash
# Tests with coverage
docker exec diagramahub-backend poetry run pytest

# Tests without coverage (faster)
docker exec diagramahub-backend poetry run pytest --no-cov

# Tests by marker
docker exec diagramahub-backend poetry run pytest -m unit
docker exec diagramahub-backend poetry run pytest -m integration
docker exec diagramahub-backend poetry run pytest -m property

# Stop on first failure
docker exec diagramahub-backend poetry run pytest -x

# Formatting
docker exec diagramahub-backend poetry run black app/

# Linting
docker exec diagramahub-backend poetry run ruff check app/

# Type checking
docker exec diagramahub-backend poetry run mypy app/

# Interactive shell
docker exec -it diagramahub-backend bash
```

---

## Accessing the Application

| Service | URL |
|---|---|
| Frontend (React) | http://localhost:5173 |
| Backend API | http://localhost:5172 |
| Swagger UI | http://localhost:5172/docs |
| ReDoc | http://localhost:5172/redoc |

Swagger and ReDoc are only available when `APP_ENV` is not `production` (`local-full` mode).
| MongoDB | localhost:27017 (local mode only) |

---

## First Use

1. Open http://localhost:5173 — you'll see the **installation wizard** (`/setup`) if it's the first time.
2. Create your **admin account** following the wizard.
3. Complete the **onboarding** where your first project is created automatically.
4. Start creating diagrams with Mermaid, PlantUML, D2 or DBML.
5. (Optional) Connect your **AI provider** in **Settings** to generate and refine diagrams with AI.
6. (Optional) Connect an **email** engine, **Stripe** or **Google OAuth** from **Integrations** — see [Integrations](self-host/integrations.md) and [Plans and limits](self-host/plans.md).

---

## Production Deployment

For production environments, it is recommended to use a reverse proxy like **Nginx** or **Traefik** to handle SSL (HTTPS) and serve the application on standard ports (80/443).

### Example with Nginx (subdomain approach)

```nginx
# Frontend
server {
    listen 80;
    server_name diagramahub.yourdomain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 80;
    server_name api.diagramahub.yourdomain.com;

    location / {
        proxy_pass http://localhost:5172;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> **Important:** If you use the subdomain approach, update `VITE_API_URL` in the frontend and `BACKEND_CORS_ORIGINS` in `backend/.env` to allow cross-origin requests between your domains.

### SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d diagramahub.yourdomain.com -d api.diagramahub.yourdomain.com
```

### Security Considerations

- **JWT_SECRET**: Use a strong random string of at least 32 characters.
- **AI_ENCRYPTION_KEY**: Generate a Fernet key; it encrypts AI API keys, integrations and MFA secrets. Back it up with the database.
- **MongoDB**: If using local MongoDB, ensure port 27017 is **NOT** exposed to the public internet (use a firewall).
- **CORS**: Configure `BACKEND_CORS_ORIGINS` only with the necessary origins.
- **Backups**: Regularly backup your `mongodb_data` volume.

---

## Troubleshooting

### MongoDB Connection Failed

```bash
# Check if MongoDB container is running
docker-compose ps mongodb

# View MongoDB logs
docker-compose logs mongodb

# Restart MongoDB
docker-compose restart mongodb
```

### Port Already in Use

```bash
# Find process using the port
lsof -i :5172
lsof -i :5173

# Kill the process
kill -9 <PID>
```

### Backend Won't Start

```bash
docker-compose logs backend
docker-compose build backend --no-cache
docker-compose restart backend
```

### Frontend Shows Blank Page

```bash
docker-compose logs frontend
docker-compose build frontend --no-cache
docker-compose restart frontend
```

---

## Cleanup

```bash
# Stop and remove containers, networks, and volumes
docker-compose down -v
```

⚠️ **Warning**: This will delete all data in the local MongoDB!

```bash
# Remove Docker images
docker rmi diagramahub-backend diagramahub-frontend
```
