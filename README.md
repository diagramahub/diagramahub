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
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       └── users/        # User authentication module
│   │   │           ├── routes.py
│   │   │           ├── schemas.py
│   │   │           ├── services.py
│   │   │           ├── repository.py
│   │   │           └── interfaces.py
│   │   ├── core/
│   │   │   ├── config.py         # Settings & configuration
│   │   │   └── security.py       # JWT & password hashing
│   │   └── main.py               # FastAPI app entry point
│   ├── Dockerfile
│   ├── pyproject.toml            # Poetry dependencies
│   └── .env.template
├── frontend/                     # React + Vite (coming next)
├── docker-compose.yml
├── LICENSE
└── README.md
```

---

## 🐳 Quickstart (with Docker)

> Requirements: Docker + Docker Compose

```bash
# 1. Clone the repo
git clone https://github.com/alexdzul/diagramahub.git
cd diagramahub

# 2. Create environment file from template
cp backend/.env.template backend/.env

# 3. Edit backend/.env and set your JWT_SECRET (required!)
# Example: JWT_SECRET=your-super-secret-key-change-this-min-32-chars
# Or generate one: python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# 4. Build and run with Docker Compose
docker-compose up --build

# 5. In another terminal, run tests to verify everything works
chmod +x test-api.sh
./test-api.sh
```

**Services:**
- Backend API: [http://localhost:5172](http://localhost:5172)
- API Documentation (Swagger): [http://localhost:5172/docs](http://localhost:5172/docs)
- API Documentation (ReDoc): [http://localhost:5172/redoc](http://localhost:5172/redoc)
- Frontend: [http://localhost:5173](http://localhost:5173)
- MongoDB: `localhost:27017`

---

## 📡 Backend API Endpoints

### User Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/users/register` | Register new user | No |
| POST | `/api/v1/users/login` | Login & get JWT token | No |
| GET | `/api/v1/users/me` | Get current user info | Yes |
| PUT | `/api/v1/users/change-password` | Change password (authenticated) | Yes |
| POST | `/api/v1/users/reset-password-request` | Request password reset token | No |
| POST | `/api/v1/users/reset-password-confirm` | Confirm password reset | No |

**Authentication:** Include JWT token in `Authorization: Bearer <token>` header

---

## 💻 Development Mode

### Backend (FastAPI + Poetry)

```bash
# Navigate to backend directory
cd backend

# Install Poetry (if not installed)
curl -sSL https://install.python-poetry.org | python3 -

# Install dependencies
poetry install

# Create .env file
cp .env.template .env
# Edit .env and set JWT_SECRET

# Run MongoDB (via Docker)
docker run -d -p 27017:27017 --name mongodb mongo:7.0

# Run backend with hot reload
poetry run uvicorn app.main:app --reload
```

### Frontend (React + Vite)

**Coming soon!** Frontend setup will be added in the next phase.

```bash
cd frontend
npm install
npm run dev
```

---

## 📝 Project Status

### ✅ Completado (Backend)

- ✅ Arquitectura modular con principios SOLID
- ✅ FastAPI con MongoDB + Beanie ODM
- ✅ Autenticación completa con JWT
- ✅ Sistema de registro de usuarios
- ✅ Login y logout
- ✅ Cambio de contraseña autenticado
- ✅ Sistema de reset de contraseña con tokens
- ✅ Validaciones robustas con Pydantic
- ✅ Hash seguro de contraseñas con BCrypt
- ✅ Docker y Docker Compose configurados
- ✅ Documentación interactiva (Swagger/ReDoc)
- ✅ Script de pruebas automatizadas
- ✅ Variables de entorno configurables
- ✅ CORS configurado
- ✅ Health checks

### ✅ Completado (Frontend)

- ✅ React 18 + TypeScript + Vite
- ✅ TailwindCSS para estilos
- ✅ React Router para navegación
- ✅ Context API para autenticación global
- ✅ Axios con interceptores automáticos
- ✅ Páginas de Login, Register y Dashboard
- ✅ Rutas protegidas con PrivateRoute
- ✅ Hot reload configurado

### ✅ Completado (Testing)

- ✅ Suite de tests con pytest
- ✅ Tests de integración para todos los endpoints
- ✅ Fixtures compartidos y reutilizables
- ✅ Coverage reports (HTML, terminal, XML)
- ✅ Test isolation con base de datos de prueba
- ✅ Faker para datos aleatorios
- ✅ Marcadores de tests (unit, integration, slow)

### 🚧 En Progreso

- ⏳ Frontend tests (Jest + React Testing Library)
- ⏳ CI/CD pipeline
- ⏳ Deployment guides

---

## 📦 Environment Variables

Configuration is managed through `backend/.env` file. Copy from template:

```bash
cp backend/.env.template backend/.env
```

**Required variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens (min 32 chars) | `your-super-secret-key-min-32-chars` |
| `MONGO_URI` | MongoDB connection string | `mongodb://mongodb:27017` |
| `DATABASE_NAME` | MongoDB database name | `diagramahub` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiration time | `30` |

See [backend/.env.template](backend/.env.template) for all variables.

---

## 🏗️ Architecture & Design Principles

### SOLID Principles

El backend está diseñado siguiendo los principios SOLID:

**Single Responsibility Principle (SRP)**
- Cada módulo tiene una responsabilidad única y bien definida
- `routes.py` → Manejo de HTTP requests
- `schemas.py` → Validación de datos
- `services.py` → Lógica de negocio
- `repository.py` → Acceso a datos

**Open/Closed Principle (OCP)**
- El código está abierto para extensión pero cerrado para modificación
- Uso de interfaces y abstracciones

**Liskov Substitution Principle (LSP)**
- Las implementaciones pueden ser sustituidas por sus interfaces

**Interface Segregation Principle (ISP)**
- Interfaces específicas (`IUserRepository`) en lugar de interfaces generales

**Dependency Inversion Principle (DIP)**
- Los servicios dependen de abstracciones, no de implementaciones concretas
- `UserService` depende de `IUserRepository`, no de `UserRepository`

### Modular Structure

```
api/v1/users/
├── interfaces.py   # Contratos (IUserRepository)
├── repository.py   # Implementación de acceso a datos
├── services.py     # Lógica de negocio
├── schemas.py      # Modelos y validaciones
└── routes.py       # Endpoints HTTP
```

Esta estructura permite:
- Fácil testing (mocking de repositorios)
- Escalabilidad (agregar nuevos módulos sin afectar existentes)
- Mantenibilidad (responsabilidades claras)
- Reusabilidad (servicios independientes)

---

## 🔒 Security Features

- **JWT Authentication**: Tokens seguros para autenticación stateless
- **Password Hashing**: BCrypt con salt automático
- **Password Validation**: Requisitos mínimos de seguridad
- **Token Expiration**: Tokens con tiempo de vida limitado
- **CORS Protection**: Orígenes configurables
- **Input Validation**: Pydantic valida todos los inputs
- **SQL Injection Prevention**: MongoDB + ODM previene inyecciones

---

## 🧪 Testing

### Pytest Test Suite (Recommended)

El proyecto incluye una suite completa de tests con **pytest**:

```bash
# Ejecutar todos los tests con coverage
docker exec diagramahub-backend poetry run pytest

# O usar el script helper
docker exec diagramahub-backend ./run-tests.sh

# Ejecutar solo tests de integración
docker exec diagramahub-backend poetry run pytest -m integration

# Ejecutar tests rápidos (sin coverage)
docker exec diagramahub-backend poetry run pytest -v --no-cov

# Ver reporte de coverage en HTML
docker exec diagramahub-backend poetry run pytest --cov=app --cov-report=html
# Abre: backend/htmlcov/index.html
```

**Test Coverage:**
- ✅ User registration (success, duplicates, validations)
- ✅ User login (success, wrong credentials, inactive users)
- ✅ Change password (authenticated, wrong current password)
- ✅ Password reset request (valid, invalid emails)
- ✅ Password reset confirmation (valid token, expired token)
- ✅ All edge cases and error scenarios

**Test Structure:**
```
backend/tests/
├── conftest.py                    # Shared fixtures
├── api/v1/users/
│   ├── test_auth.py              # Registration & Login tests
│   └── test_password_management.py # Password change & reset tests
```

### Legacy Shell Script Tests

```bash
# Script de pruebas básicas (bash)
./test-api.sh
```

### Manual Testing

Accede a la documentación interactiva:
- Swagger UI: http://localhost:5172/docs
- ReDoc: http://localhost:5172/redoc

---

## 📚 Documentation

- **[Setup Guide](SETUP.md)** - Guía detallada de instalación
- **[Backend README](backend/README.md)** - Documentación del backend
- **[API Docs (Swagger)](http://localhost:8000/docs)** - Documentación interactiva
- **[API Docs (ReDoc)](http://localhost:8000/redoc)** - Documentación alternativa

---

## 🤝 Contributing

¡Las contribuciones son bienvenidas! Por favor:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Development Guidelines

- Sigue los principios SOLID
- Escribe tests para nuevas funcionalidades
- Documenta tu código
- Usa type hints en Python
- Mantén la arquitectura modular

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
