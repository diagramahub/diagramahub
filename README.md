# ✏️ Diagramahub

**Diagramahub** is an open source platform for building, organizing, and exporting diagrams using plain text. 

It combines the power of structured markup (Mermaid, PlantUML) with a beautiful interface — ideal for developers and teams who want to diagram fast and stay in flow.

---

## ✨ Key Features

- 📝 **Text-to-Diagram**: Support for Mermaid and PlantUML.
- 📂 **Organization**: Organize by projects, folders, and tags.
- 🖼️ **Flexible Export**: PNG, SVG, and Markdown.
- 🌍 **Multi-language**: Native Spanish and English support.
- 👤 **Personalization**: Profile management, timezones, and real-time clock.
- 🔒 **Security**: JWT Auth, BCrypt hashing, and session management.
- 🐳 **Docker Ready**: Self-host anywhere in minutes.

---

## 🚀 Quickstart

### 1. Automatic Install (Recommended)
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/diagramahub/diagramahub/main/install.sh)
```

### 2. Manual Install
```bash
git clone https://github.com/alexdzul/diagramahub.git
cd diagramahub

# Config environment & choosing mode (Full stack or External Mongo)
cp backend/.env.example backend/.env
ln -sf deploy/local-full/docker-compose.yml docker-compose.yml

# Start
docker-compose up -d --build
```

---

## 📖 Documentation & Guides

For detailed information, please refer to:

- 🛠️ **[Installation & Update Guide](INSTALL.md)** - Detailed setup, **Production (Nginx/Proxy)**, and upgrades.
- 📖 **[Backend Documentation](backend/README.md)** - API structure and local development.
- 📖 **[Frontend Documentation](frontend/README.md)** - UI components and i18n.
- 🧪 **API Docs**: [Swagger UI](http://localhost:5172/docs) | [ReDoc](http://localhost:5172/redoc)

---

## 🏗️ Architecture

Built with a modular approach following **SOLID** principles:
- **Backend**: FastAPI + MongoDB (Beanie ODM)
- **Frontend**: React + TypeScript + Tailwind CSS
- **Design**: Clean Architecture with repository pattern interfaces.

---

## 🙌 Contributing

We welcome contributions! Please check our development guidelines in the [Contributing section](INSTALL.md#additional-resources).

---

## 📜 License

Licensed under the [Apache License 2.0](LICENSE).

---

## 🧠 Made with care by [@alexdzul](https://github.com/alexdzul) and contributors
