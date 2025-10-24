# Local Full Stack Deployment

Complete DiagramHub installation with all services running locally in Docker.

## Services Included

- **MongoDB 7.0** - Database (Docker container)
- **Backend** - FastAPI application
- **Frontend** - React + Vite application

## Prerequisites

- Docker Engine 20.10+
- Docker Compose V2

## Quick Start

1. **Configure environment variables:**

   Create `backend/.env` in the project root:
   ```bash
   MONGO_URI=mongodb://mongodb:27017
   DATABASE_NAME=diagramahub
   JWT_SECRET=<generate-secure-secret>
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   API_V1_PREFIX=/api/v1
   ```

   Generate a secure JWT secret:
   ```bash
   openssl rand -base64 32
   ```

2. **Start services:**
   ```bash
   cd deploy/local-full
   docker-compose up -d
   ```

3. **Verify services are running:**
   ```bash
   docker-compose ps
   ```

4. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:5172
   - API Docs: http://localhost:5172/docs
   - MongoDB: localhost:27017

## Data Persistence

MongoDB data is persisted in a Docker volume:

```bash
# View volumes
docker volume ls | grep mongodb

# Backup data
docker run --rm -v diagramahub_mongodb_data:/data -v $(pwd):/backup \
  mongo:7.0 tar czf /backup/mongodb-backup.tar.gz /data

# Restore data
docker run --rm -v diagramahub_mongodb_data:/data -v $(pwd):/backup \
  mongo:7.0 tar xzf /backup/mongodb-backup.tar.gz -C /
```

## Common Operations

```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f mongodb

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v

# Rebuild and restart
docker-compose up -d --build
```

## MongoDB Access

### From Host Machine

```bash
# Using mongosh
mongosh mongodb://localhost:27017/diagramahub

# Using MongoDB Compass
# Connection string: mongodb://localhost:27017
```

### From Backend Container

The backend automatically connects to MongoDB using the service name:
```
MONGO_URI=mongodb://mongodb:27017
```

## Troubleshooting

### MongoDB container won't start

Check logs:
```bash
docker-compose logs mongodb
```

Common issues:
- Port 27017 already in use
- Insufficient disk space
- Corrupted volume data

### Backend can't connect to MongoDB

1. Ensure MongoDB is running:
   ```bash
   docker-compose ps mongodb
   ```

2. Check backend logs:
   ```bash
   docker-compose logs backend
   ```

3. Verify `MONGO_URI` in `backend/.env`:
   ```
   MONGO_URI=mongodb://mongodb:27017
   ```

### Port conflicts

If default ports are in use, modify `docker-compose.yml`:

```yaml
services:
  mongodb:
    ports:
      - "27018:27017"  # Changed from 27017
  backend:
    ports:
      - "5174:5172"    # Changed from 5172
  frontend:
    ports:
      - "5175:5173"    # Changed from 5173
```

## Development Workflow

This configuration includes hot reload for both frontend and backend:

- **Frontend changes**: Automatically reflected (Vite HMR)
- **Backend changes**: Automatically reloaded (uvicorn --reload)
- **Test changes**: Available immediately (mounted volume)

### Run backend tests

```bash
docker exec diagramahub-backend poetry run pytest
```

### Access backend shell

```bash
docker exec -it diagramahub-backend bash
```

### Access MongoDB shell

```bash
docker exec -it diagramahub-mongodb mongosh diagramahub
```

## Production Considerations

⚠️ **This configuration is optimized for development.**

For production deployment:
- Use external managed MongoDB (Atlas, AWS DocumentDB)
- Enable MongoDB authentication
- Use production WSGI server
- Enable HTTPS
- Set up proper backup strategy
- Use environment-specific secrets

See `../external-mongodb/` for production-ready configuration.
