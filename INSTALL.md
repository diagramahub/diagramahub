# DiagramHub - Installation Guide

This guide will help you install and configure DiagramHub with your preferred MongoDB setup.

## 🚀 One-Line Installation (Fastest!)

**No prerequisites needed!** The installer will handle everything:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/diagramahub/diagramahub/main/install.sh)
```

Or using wget:

```bash
wget -qO- https://raw.githubusercontent.com/diagramahub/diagramahub/main/install.sh | bash
```

**Features:**
- ✅ **Zero dependencies** - Pure bash script, no Python required
- ✅ **Auto-installs Docker** - Detects your OS and installs Docker if needed
- ✅ **OS Detection** - Supports Ubuntu, Debian, CentOS, Fedora, RHEL, macOS
- ✅ **Interactive wizard** - Guides you through MongoDB setup (local or external)
- ✅ **MongoDB 8** - Deploys latest MongoDB with automatic patch updates
- ✅ **Automatic start** - Builds and starts DiagramHub for you
- ✅ **Fast installation** - Complete setup in 3-5 minutes

This is the **recommended method** for new installations.

**MongoDB Options:**
1. **Local MongoDB** - Deploys MongoDB 8 in Docker with automatic patch updates
2. **External MongoDB** - Connect to MongoDB Atlas or your own MongoDB server

---

## 📋 Prerequisites (Manual Installation)

If you prefer manual installation, ensure you have:

- **Docker** (20.10 or higher) - [Install Docker](https://docs.docker.com/get-docker/)
- **Docker Compose** (2.0 or higher) - Usually included with Docker Desktop

### Verify Prerequisites

```bash
docker --version
docker-compose --version
```

---

### 1. Choose Deployment Mode

DiagramHub provides pre-configured deployment folders in the `deploy/` directory:

- `deploy/local-full/`: Includes MongoDB 8, Backend, and Frontend.
- `deploy/external-mongodb/`: Includes only Backend and Frontend.

### 2. Configure Environment

Create `backend/.env` from the template:

```bash
# MongoDB Configuration
MONGO_URI=mongodb://mongodb:27017                    # For local Docker MongoDB
# MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/  # For external MongoDB
DATABASE_NAME=diagramahub

# JWT Configuration (generate with: python3 -c "import secrets; print(secrets.token_urlsafe(32))")
JWT_SECRET=your-secure-jwt-secret-here-min-32-chars
ACCESS_TOKEN_EXPIRE_MINUTES=30

# API Configuration
API_V1_PREFIX=/api/v1
```

### 2. Generate Secure JWT Secret

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output and use it as your `JWT_SECRET` in the `.env` file.

### 3. Setup Docker Compose

Instead of editing a single large file, link the configuration that matches your needs:

**For Local MongoDB:**
```bash
ln -sf deploy/local-full/docker-compose.yml docker-compose.yml
```

**For External MongoDB:**
```bash
# Ensure your MONGO_URI in backend/.env points to your external DB
ln -sf deploy/external-mongodb/docker-compose.yml docker-compose.yml
```

> [!NOTE]
> `docker-compose.yml` is ignored by Git to prevent your local deployment choices from interfering with updates.

## 🏃 Running DiagramHub

### Start All Services

```bash
# Build and start all containers
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Stop Services

```bash
docker-compose down
```

### Restart Services

```bash
docker-compose restart
```

## 🌐 Accessing the Application

Once started, you can access:

- **Frontend (React)**: http://localhost:5173
- **Backend API**: http://localhost:5172
- **API Documentation (Swagger)**: http://localhost:5172/docs
- **API Documentation (ReDoc)**: http://localhost:5172/redoc

### Default Ports

| Service  | Port | Description |
|----------|------|-------------|
| Frontend | 5173 | Vite dev server (React) |
| Backend  | 5172 | FastAPI application |
| MongoDB  | 27017 | MongoDB (local only) |

## 🧪 Testing the Installation

### 1. Check Services Status

```bash
docker-compose ps
```

All services should show "Up" status.

### 2. Test Backend API

```bash
curl http://localhost:5172/
```

You should see a JSON response with version info.

### 3. Access API Documentation

Open http://localhost:5172/docs in your browser.

### 4. Test Frontend

Open http://localhost:5173 in your browser. You should see the DiagramHub login page.

### 5. Create Your First User

1. Click "Register" on the login page
2. Fill in the form:
   - Email: your@email.com
   - Name: Your Name
   - Password: (min 8 chars, must include uppercase, lowercase, and number)
3. Click "Register"

## 🔍 Troubleshooting

### MongoDB Connection Failed

**Symptoms:**
- Backend fails to start
- Error: "Failed to connect to MongoDB"

**Solutions:**

1. **For Local MongoDB (Docker):**
   ```bash
   # Check if MongoDB container is running
   docker-compose ps mongodb

   # View MongoDB logs
   docker-compose logs mongodb

   # Restart MongoDB
   docker-compose restart mongodb
   ```

2. **For External MongoDB:**
   ```bash
   # Test connection manually
   python3 -c "from pymongo import MongoClient; client = MongoClient('YOUR_MONGO_URI'); print(client.server_info())"

   # Check your .env file
   cat backend/.env | grep MONGO_URI
   ```

3. **Check network connectivity:**
   ```bash
   # Ping MongoDB Atlas cluster
   ping cluster0.xxxxx.mongodb.net
   ```

### Port Already in Use

**Symptoms:**
- Error: "Port 5172 is already allocated"
- Error: "Port 5173 is already allocated"

**Solution:**

```bash
# Find process using port 5172
lsof -i :5172

# Kill the process
kill -9 <PID>

# Or change ports in docker-compose.yml
```

### Docker Permission Denied

**Symptoms:**
- Error: "permission denied while trying to connect to Docker daemon"

**Solution (Linux):**
```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and log back in
```

**Solution (macOS/Windows):**
- Ensure Docker Desktop is running

### Backend Won't Start

```bash
# Check backend logs
docker-compose logs backend

# Rebuild backend
docker-compose build backend

# Restart backend
docker-compose restart backend
```

### Frontend Shows Blank Page

```bash
# Check frontend logs
docker-compose logs frontend

# Rebuild frontend
docker-compose build frontend --no-cache

# Restart frontend
docker-compose restart frontend
```

## 🔄 Updating DiagramHub

To upgrade your installation to the latest version:

```bash
# 1. Pull latest changes from repository
git pull

# 2. Re-run installer to apply any new environment changes (recommended)
# OR manually rebuild:
docker-compose build
docker-compose up -d
```

> [!TIP]
> Your data in `mongodb_data` is persistent and will not be lost during an upgrade unless you manually delete the volume.

---

## 🚀 Production Deployment

For production environments, it is recommended to use a reverse proxy like **Nginx** or **Traefik** to handle SSL (HTTPS) and serve the application on standard ports (80/443).

### 1. Reverse Proxy with Nginx (Subdomain Approach)

For a professional setup, we recommend using a subdomain for the API (e.g., `api.diagramahub.com`) and the main domain for the Frontend.

Example Nginx configuration (`/etc/nginx/sites-available/diagramahub`):

```nginx
# 1. Frontend Configuration
server {
    listen 80;
    server_name diagramahub.yourdomain.com;

    location / {
        proxy_pass http://localhost:5173; # Frontend container
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# 2. Backend API Configuration
server {
    listen 80;
    server_name api.diagramahub.yourdomain.com;

    location / {
        proxy_pass http://localhost:5172; # Backend container
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> [!IMPORTANT]
> If you use the subdomain approach, ensure you update the `VITE_API_URL` environment variable in the frontend and the `BACKEND_CORS_ORIGINS` in the backend `.env` to allow cross-origin requests between your domains.

### 2. Enabling SSL (HTTPS)

We recommend using **Certbot** for free SSL certificates from Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d diagramahub.yourdomain.com
```

### 3. Security Considerations

- **JWT_SECRET**: Ensure your `JWT_SECRET` is a strong, random string (at least 32 chars).
- **MongoDB**: If using local MongoDB, ensure port `27017` is **NOT** exposed to the public internet (use a firewall like UFW).
- **Backups**: Regularly backup your `mongodb_data` volume.

---


## 🧹 Cleanup

### Remove All Containers and Data

```bash
# Stop and remove containers, networks, volumes
docker-compose down -v
```

⚠️ **Warning**: This will delete all data in the local MongoDB!

### Remove Docker Images

```bash
# Remove DiagramHub images
docker rmi diagramahub-backend diagramahub-frontend
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [MongoDB Atlas Setup](https://www.mongodb.com/docs/atlas/getting-started/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)

## 💬 Getting Help

If you encounter issues:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review logs: `docker-compose logs`
3. Open an issue on GitHub
4. Check existing issues for solutions

## 🎉 Next Steps

Now that DiagramHub is installed:

1. **Create your first project** in the dashboard
2. **Create your first diagram** (Mermaid or PlantUML)
3. **Configure AI integrations** (optional - BYOL)
4. **Explore features**: folders, export, collaboration

Happy diagramming! 🚀
