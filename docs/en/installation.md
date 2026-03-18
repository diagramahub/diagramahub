# Installation Guide

Welcome to the DiagramaHub installation guide. We have prepared tools to facilitate the deployment of the application for both local development environments and production setups.

Our recommended and primary tool is the `install.sh` installer, an interactive script that takes care of installing prerequisites, cloning the repository, and configuring the project for you.

## Analyzing the Automatic Installer (`install.sh`)

The `install.sh` file is designed to offer a smooth, terminal-based experience (a "Next, Next" style wizard). When run interactively, it performs the following:

1. **OS Detection:** Automatically detects if you are on macOS, Ubuntu/Debian, or CentOS/RHEL.
2. **Checks and Installation:** Verifies if you have `git`, `docker`, and `docker-compose` installed. If not, it offers to install them automatically.
3. **Cloning:** Downloads the GitHub repository and places it in `$HOME/diagramahub`.
4. **Security and Variables:** Cryptographically generates the `JWT_SECRET` and builds the backend `.env` file so you don't have to do it manually.

At the end of the process, the installer will allow you to choose between two main deployment modes.

---

### Environment 1: Development / Local Environment (Local Full Stack) 🐳

This level is recommended if you want to **explore the application**, **test new versions**, or **perform fast local development**.

**Key aspects:**
* Manages a **MongoDB** database in an associated Docker container.
* Deploys the Backend (FastAPI).
* Deploys the Frontend (Vite/React).
* All data is saved in a persistent Docker volume. No external tools are required.

**What happens internally?**
The installer links the main orchestrator to `deploy/local-full/docker-compose.yml`, which has all 3 services declared.

---

### Environment 2: Production (External MongoDB) 🌐

This environment is designed for **Production** setups. The best practice in Kubernetes or the cloud is to separate the database layer from the stateless application containers.

**Key aspects:**
* **It does not initialize the MongoDB container.**
* The script will prompt you for your connection string and external URI (e.g., MongoDB Atlas, Amazon DocumentDB, or a self-hosted DB).
* It only spins up the Backend and the Frontend in Docker, which communicate with your cloud database.
* Ideal because it offloads the backing up and recovery management of your main database to a managed service out of Docker.

**What happens internally?**
The installer links the main orchestrator to `deploy/external-mongodb/docker-compose.yml`, where only the API and Client are defined.

---

## Running the "One Line Installer"

If you wish to use the quick installation, open a terminal on the server where you want to install and run one of the following commands:

```bash
# Option 1 (Via curl)
bash <(curl -fsSL https://raw.githubusercontent.com/diagramahub/diagramahub/main/install.sh)

# Option 2 (Via wget)
wget -qO- https://raw.githubusercontent.com/diagramahub/diagramahub/main/install.sh | bash
```

### Useful Post-Installation Commands

If you successfully used the installer, you will be located in the `$HOME/diagramahub` folder. From there, you can run native Docker Compose commands:

* **View general logs:** `docker-compose logs -f`
* **View logs per service:** `docker-compose logs -f backend` or `frontend`
* **Stop the container farm:** `docker-compose down`
* **Update to the latest version:** 
  ```bash
  git pull
  docker-compose build
  docker-compose up -d
  ```

---

## Fully Manual Installation (For Developers)

If you are a core developer who wants to contribute code to the backend/frontend and requires running the tools outside of Docker on your own local port:

1. **Base Structure:**
   * Run a `git clone` of the official repository.
2. **Backend (Python / FastAPI):**
   * Navigate to `backend/`.
   * We manage dependencies with `Poetry` or standard pip.
   * Create a copy of the example `.env.example` file and name it `.env`. Configure your secrets and local Mongo URI there.
   * Start the hot-reloading process according to the FastAPI ASGI motor (e.g., `uvicorn main:app --reload` or `fastapi dev`).
3. **Frontend (NodeJS / React):**
   * Navigate to `frontend/` and run `npm install`, `yarn`, or `bun install` according to your environment.
   * Adjust the variables if the default development API port changed.
   * Start the server with `npm run dev` and view the web portion.
