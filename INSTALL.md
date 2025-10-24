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
- ✅ **Interactive wizard** - Guides you through MongoDB setup
- ✅ **Connection testing** - Verifies MongoDB before proceeding
- ✅ **Automatic start** - Builds and starts DiagramHub for you

This is the **recommended method** for new installations.

---

## 📋 Prerequisites (Manual Installation)

If you prefer manual installation, ensure you have:

- **Docker** (20.10 or higher) - [Install Docker](https://docs.docker.com/get-docker/)
- **Docker Compose** (2.0 or higher) - Usually included with Docker Desktop
- **Python 3.8+** (for the Python installer only)

### Verify Prerequisites

```bash
docker --version
docker-compose --version
python3 --version
```

## ⚡ Interactive Installation (Alternative)

The easiest way to install DiagramHub is using the interactive installation script:

```bash
python3 install.py
```

The script will guide you through:
1. ✅ Checking prerequisites (Docker, Docker Compose)
2. 🗄️ Choosing MongoDB setup (Local or External)
3. 🔐 Configuring JWT security
4. 📝 Creating environment files
5. ✨ Testing database connection

### Installation Options

#### Option 1: Local MongoDB (Docker) - Recommended for Development

```bash
# Run the installer
python3 install.py

# Choose option 1 when prompted
# The script will:
# - Configure MongoDB to run in Docker
# - Generate secure JWT secret
# - Create backend/.env file
```

**Advantages:**
- ✅ Zero configuration required
- ✅ Everything runs in Docker
- ✅ Easy to reset/cleanup
- ✅ Isolated from your system

#### Option 2: External MongoDB - Recommended for Production

```bash
# Run the installer
python3 install.py

# Choose option 2 when prompted
# Provide your MongoDB connection string (examples below)
```

**MongoDB URI Examples:**

**MongoDB Atlas (Cloud):**
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

**Self-hosted MongoDB:**
```
mongodb://username:password@your-server.com:27017/
```

**Local MongoDB (custom installation):**
```
mongodb://localhost:27017/
```

**Advantages:**
- ✅ Production-ready
- ✅ Scalable (MongoDB Atlas auto-scaling)
- ✅ Backups included (Atlas)
- ✅ Better performance for production

## 🔧 Manual Installation

If you prefer to configure manually instead of using the installation script:

### 1. Create Backend Environment File

Create `backend/.env`:

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

### 3. (Optional) Configure External MongoDB

If using external MongoDB, create `docker-compose.override.yml`:

```yaml
version: '3.8'

services:
  mongodb:
    # Disable local MongoDB when using external service
    profiles:
      - disabled
```

This tells Docker Compose to skip starting the local MongoDB container.

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

```bash
# Pull latest changes
git pull

# Rebuild containers
docker-compose build

# Restart services
docker-compose up -d
```

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
