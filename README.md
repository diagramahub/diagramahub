# ✏️ Diagramahub

**Diagramahub** is an open source platform for building, organizing, and exporting diagrams using plain text.

It combines the power of structured markup with a beautiful, intuitive interface — ideal for developers, teams, and technical writers who want to diagram fast and stay in flow.

---

## 🚀 Tech Stack

| Layer       | Tech               |
|-------------|--------------------|
| Frontend    | React + Tailwind CSS |
| Backend     | FastAPI (Python)   |
| Database    | MongoDB            |
| Infrastructure | Docker Compose |

---

## 🧪 Live Preview (Coming soon)

You'll be able to try Diagramahub live on [diagramahub.com](https://diagramahub.com) very soon.

---

## ⚙️ Features

✅ Create diagrams using plain text (Mermaid, PlantUML, etc.)  
✅ Organize diagrams by tags, folders or projects  
✅ Export as PNG, SVG or Markdown  
✅ Easy to deploy: Docker-ready  
✅ Self-host or extend freely  
✅ Apache 2.0 licensed

> Future roadmap includes:
> - Real-time collaboration
> - Sharing and permissions
> - Cloud version with auth and persistence

---

## 🧱 Project Structure

```
diagramahub/
├── backend/        # FastAPI app
├── frontend/       # React app
├── docker/         # Init scripts or DB config
├── .env.template   # Default environment variables
├── docker-compose.yml
├── LICENSE
└── README.md
```

---

## 🐳 Quickstart (with Docker)

> Requirements: Docker + Docker Compose

```bash
# 1. Clone the repo
git clone https://github.com/diagramahub/diagramahub.git
cd diagramahub

# 2. Create environment file
cp .env.template .env

# 3. Build and run
docker-compose up --build
```

- Frontend: http://localhost:3000  
- Backend API: http://localhost:8000/docs  
- MongoDB: Accessible at port 27017 (see .env)

---

## 💻 Development Mode

If you'd like to work on frontend or backend separately:

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

### Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Make sure MongoDB is running, or use Docker for DB only.

---

## 📦 Environment Variables

All configuration is handled via a `.env` file. See `.env.template` for all available variables.

Includes:

- MongoDB credentials and URI
- CORS settings
- JWT secrets
- Frontend API base URL
- Environment mode

---

## 📜 License

This project is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).  
You are free to use, modify and distribute the software, even commercially, as long as you comply with the terms.

---

## 🙌 Contributing

We welcome contributions!  
To get started:

1. Fork the repo
2. Create a branch (`feature/my-feature`)
3. Commit your changes
4. Open a PR

Read our [contribution guidelines](CONTRIBUTING.md) _(coming soon)_.

---

## 🔮 About the Cloud Version

Diagramahub is built to be self-hosted **but will also offer a managed cloud version soon**.  
If you're interested in early access or updates, follow us at [diagramahub.com](https://diagramahub.com).

---

## 🧠 Made with care by [@alexdzul](https://github.com/alexdzul) and contributors
