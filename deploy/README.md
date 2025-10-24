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
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/
# OR for standard connection:
# MONGO_URI=mongodb://user:password@host:27017/
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
# MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/

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
- **API Documentation:** http://localhost:5172/docs
- **MongoDB (local-full only):** localhost:27017

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
