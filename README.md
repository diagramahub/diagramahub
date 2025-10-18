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

### Core Features
✅ Create diagrams using plain text (Mermaid, PlantUML, etc.)
✅ Organize diagrams by project, folders and **tags**
✅ Export as PNG, SVG, **Markdown**
✅ Easy to deploy: Docker-ready
✅ Self-host or extend freely
✅ Apache 2.0 licensed

### User Profile & Customization
✅ **Profile Picture with Base64 Storage** - Upload and manage your profile picture (stored as Base64 in MongoDB)
✅ **Timezone Selection** - Choose from 21 global timezones for personalized date/time display
✅ **Real-time Clock** - Live clock in the diagram editor showing time in your selected timezone
✅ **Password Management** - Change password with secure validation
✅ **User Settings** - Manage personal information and preferences

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
├── frontend/                     # React + Vite + TypeScript
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

### User Authentication & Profile

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/users/register` | Register new user | No |
| POST | `/api/v1/users/login` | Login & get JWT token | No |
| GET | `/api/v1/users/me` | Get current user info | Yes |
| PUT | `/api/v1/users/me` | Update user profile (name, picture, timezone) | Yes |
| PUT | `/api/v1/users/change-password` | Change password (authenticated) | Yes |
| POST | `/api/v1/users/reset-password-request` | Request password reset token | No |
| POST | `/api/v1/users/reset-password-confirm` | Confirm password reset | No |

**Authentication:** Include JWT token in `Authorization: Bearer <token>` header

**Profile Update Fields:**
- `full_name` (string, optional) - User's full name
- `profile_picture` (string, optional) - Base64 encoded image (max 2MB)
- `timezone` (string, optional) - IANA timezone identifier (e.g., "America/Mexico_City")

---

### Diagram Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/projects/{project_id}/diagrams` | Create a new diagram | Yes |
| GET | `/api/v1/diagrams/{diagram_id}` | Get diagram by ID | Yes |
| PUT | `/api/v1/diagrams/{diagram_id}` | Update a diagram | Yes |
| DELETE | `/api/v1/diagrams/{diagram_id}` | Delete a diagram | Yes |
| GET | `/api/v1/diagrams/{diagram_id}/export/markdown` | Export diagram as Markdown | Yes |
| GET | `/api/v1/diagrams/search/tags?tags=tag1,tag2&project_id={project_id}` | Search diagrams by tags | Yes |

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

```bash
cd frontend
npm install
npm run dev
```

---

## 📝 Project Status

### ✅ Completed (Backend)

- ✅ Modular architecture with SOLID principles
- ✅ FastAPI with MongoDB + Beanie ODM
- ✅ Complete JWT authentication
- ✅ User registration system
- ✅ Login and logout
- ✅ User profile management (full name, picture, timezone)
- ✅ Profile picture storage with Base64 in MongoDB
- ✅ Timezone preference storage (21 global timezones)
- ✅ Authenticated password change
- ✅ Password reset system with tokens
- ✅ Robust validations with Pydantic
- ✅ Secure password hashing with BCrypt
- ✅ Docker and Docker Compose configured
- ✅ Interactive documentation (Swagger/ReDoc)
- ✅ Automated testing script
- ✅ Configurable environment variables
- ✅ CORS configured
- ✅ Health checks

### ✅ Completed (Frontend)

- ✅ React 18 + TypeScript + Vite
- ✅ TailwindCSS for styling
- ✅ React Router for navigation
- ✅ Context API for global authentication
- ✅ Axios with automatic interceptors
- ✅ Login, Register and Dashboard pages
- ✅ User profile page with edit functionality
- ✅ Profile picture upload with preview and validation
- ✅ Timezone selector with 21 global options
- ✅ Real-time clock in diagram editor (timezone-aware)
- ✅ Password change functionality
- ✅ Settings page (coming soon preview)
- ✅ Dropdown user menu with navigation
- ✅ Protected routes with PrivateRoute
- ✅ Hot reload configured

### ✅ Completed (Testing)

- ✅ Test suite with pytest
- ✅ Integration tests for all endpoints
- ✅ Shared and reusable fixtures
- ✅ Coverage reports (HTML, terminal, XML)
- ✅ Test isolation with test database
- ✅ Faker for random data
- ✅ Test markers (unit, integration, slow)

### 🚧 In Progress

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

The backend is designed following SOLID principles:

**Single Responsibility Principle (SRP)**
- Each module has a single, well-defined responsibility
- `interfaces.py` → Contracts (interfaces)
- `routes.py` → HTTP request handling
- `schemas.py` → Data validation
- `services.py` → Business logic
- `repository.py` → Data access

**Open/Closed Principle (OCP)**
- Code is open for extension but closed for modification
- Use of interfaces and abstractions

**Liskov Substitution Principle (LSP)**
- Implementations can be substituted for their interfaces

**Interface Segregation Principle (ISP)**
- Specific interfaces (`IUserRepository`) instead of general interfaces

**Dependency Inversion Principle (DIP)**
- Services depend on abstractions, not concrete implementations
- `UserService` depends on `IUserRepository`, not `UserRepository`

### Interfaces.py as SRP Example

The `interfaces.py` file is a perfect example of the **Single Responsibility Principle** in action:

```python
class IDiagramRepository(ABC):
    """Abstract interface for diagram data access."""

    @abstractmethod
    async def create(self, diagram_data: DiagramCreate, project_id: str) -> DiagramInDB:
        """Create a new diagram."""
        pass

    @abstractmethod
    async def get_by_id(self, diagram_id: str) -> Optional[DiagramInDB]:
        """Get diagram by ID."""
        pass

    # ... other methods
```

**Why this demonstrates SRP:**
- **Single Purpose**: The interface defines *only* the contract for data access operations
- **No Implementation**: Contains no business logic, validation, or data transformation
- **Clear Boundaries**: Separates "what" (interface contract) from "how" (implementation details)
- **Testability**: Allows easy mocking and testing of dependent services
- **Flexibility**: Enables multiple implementations (MongoDB, PostgreSQL, in-memory) without changing dependent code

This separation ensures that:
- **Repository implementations** focus solely on data persistence
- **Services** focus solely on business logic
- **Routes** focus solely on HTTP request/response handling
- **Schemas** focus solely on data validation and serialization

### Modular Structure

```
api/v1/users/
├── interfaces.py   # Contracts (IUserRepository)
├── repository.py   # Data access implementation
├── services.py     # Business logic
├── schemas.py      # Models and validations
└── routes.py       # HTTP endpoints
```

This structure allows:
- Easy testing (repository mocking)
- Scalability (add new modules without affecting existing ones)
- Maintainability (clear responsibilities)
- Reusability (independent services)

---

## 🔒 Security Features

- **JWT Authentication**: Secure tokens for stateless authentication
- **Password Hashing**: BCrypt with automatic salt
- **Password Validation**: Minimum security requirements
- **Token Expiration**: Tokens with limited lifetime
- **CORS Protection**: Configurable origins
- **Input Validation**: Pydantic validates all inputs
- **SQL Injection Prevention**: MongoDB + ODM prevents injections

---

## 🧪 Testing

### Pytest Test Suite (Recommended)

The project includes a complete test suite with **pytest**:

```bash
# Run all tests with coverage
docker exec diagramahub-backend poetry run pytest

# Or use the script helper
docker exec diagramahub-backend ./run-tests.sh

# Run only integration tests
docker exec diagramahub-backend poetry run pytest -m integration

# Run fast tests (without coverage)
docker exec diagramahub-backend poetry run pytest -v --no-cov

# View coverage report in HTML
docker exec diagramahub-backend poetry run pytest --cov=app --cov-report=html
# Open: backend/htmlcov/index.html
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
# Basic test script (bash)
./test-api.sh
```

### Manual Testing

Access the interactive documentation:
- Swagger UI: http://localhost:5172/docs
- ReDoc: http://localhost:5172/redoc

---

## 👤 User Profile & Customization

DiagramaHub includes a comprehensive user profile system with personalization options:

### Profile Picture Management

**Upload and Display Profile Pictures**
- Upload images in JPG, PNG, or GIF format (max 2MB)
- Images are automatically converted to Base64 and stored in MongoDB
- No external cloud storage required - complete data ownership
- Profile picture appears in:
  - User menu (navbar)
  - Profile page
  - Diagram editor toolbar

**How to Upload:**
1. Navigate to "Mi Perfil" from the user menu
2. Click "Editar" (Edit)
3. Click "Subir foto" (Upload photo)
4. Select an image file (automatically validates size and format)
5. Preview appears instantly
6. Click "Guardar Cambios" (Save Changes)

**Technical Details:**
- **Storage Method:** Base64 encoding directly in MongoDB
- **Advantages:**
  - No external cloud storage dependencies (AWS S3, Cloudinary, etc.)
  - Simple deployment - one database, no extra services
  - Atomic updates - picture and user data saved together
  - No broken image links - data always available
  - Complete data ownership and privacy
- **Considerations:**
  - 2MB limit per image (recommended for optimal performance)
  - Base64 increases storage by ~33% vs raw binary
  - Suitable for profile pictures; for large-scale image hosting, consider cloud storage migration

### Timezone Selection

**Choose Your Timezone**
- Select from 21 global timezones covering all major regions
- Real-time clock in diagram editor respects your timezone
- Automatic date/time formatting for your locale

**Available Timezones:**

**Americas:**
- 🇲🇽 Ciudad de México (GMT-6)
- 🇲🇽 Cancún (GMT-5)
- 🇲🇽 Tijuana (GMT-8)
- 🇺🇸 Nueva York (GMT-5)
- 🇺🇸 Chicago (GMT-6)
- 🇺🇸 Denver (GMT-7)
- 🇺🇸 Los Ángeles (GMT-8)
- 🇨🇴 Bogotá (GMT-5)
- 🇵🇪 Lima (GMT-5)
- 🇨🇱 Santiago (GMT-3)
- 🇦🇷 Buenos Aires (GMT-3)
- 🇧🇷 São Paulo (GMT-3)

**Europe:**
- 🇪🇸 Madrid (GMT+1)
- 🇬🇧 Londres (GMT+0)
- 🇫🇷 París (GMT+1)
- 🇩🇪 Berlín (GMT+1)

**Asia:**
- 🇯🇵 Tokio (GMT+9)
- 🇨🇳 Shanghái (GMT+8)
- 🇦🇪 Dubái (GMT+4)

**Oceania:**
- 🇦🇺 Sídney (GMT+11)

**Universal:**
- 🌍 UTC (Coordinated Universal Time)

**How to Set Timezone:**
1. Go to "Mi Perfil" from the user menu
2. Click "Editar" (Edit)
3. Select your timezone from the dropdown
4. Click "Guardar Cambios" (Save Changes)
5. The diagram editor will now display time in your selected timezone

### Real-time Clock in Diagram Editor

The diagram editor features a live clock that:
- Updates every second
- Displays time in your selected timezone
- Shows both time (HH:MM:SS) and date (DD MMM YYYY)
- Appears in the bottom toolbar of the editor
- Format: `🕐 14:23:45 • 17 oct 2025`

### Password Management

**Change Password (Authenticated)**
- Requires current password for verification
- New password must meet security requirements:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one digit
- Real-time validation feedback

**Password Reset (Unauthenticated)**
- Request reset token via email
- Token expires after 1 hour
- Secure token-based verification
- Same password requirements apply

### Profile Information Display

Your profile page shows:
- Profile picture (or initials if no picture)
- Full name
- Email address (cannot be changed)
- Selected timezone
- Member since date
- Quick access to edit all information

---

## 📚 Documentation

- **[Setup Guide](SETUP.md)** - Detailed installation guide
- **[Backend README](backend/README.md)** - Backend documentation
- **[API Docs (Swagger)](http://localhost:8000/docs)** - Interactive documentation
- **[API Docs (ReDoc)](http://localhost:8000/redoc)** - Alternative documentation

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a branch for your feature (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow SOLID principles
- Write tests for new functionalities
- Document your code
- Use type hints in Python
- Maintain modular architecture

---

## 🙌 Acknowledgments

We'd like to thank all the amazing open-source libraries and tools that make Diagramahub possible:

### Backend Libraries
- **[FastAPI](https://fastapi.tiangolo.com/)** - Modern, fast web framework for building APIs with Python 3.7+
- **[Uvicorn](https://www.uvicorn.org/)** - Lightning-fast ASGI server
- **[Beanie](https://beanie-odm.dev/)** - Python ODM for MongoDB
- **[Motor](https://motor.readthedocs.io/)** - Non-blocking MongoDB driver for Python
- **[Pydantic](https://pydantic-docs.helpmanual.io/)** - Data validation and settings management using Python type annotations
- **[Python-JOSE](https://python-jose.readthedocs.io/)** - JSON Web Token implementation in Python
- **[Passlib](https://passlib.readthedocs.io/)** - Password hashing library
- **[BCrypt](https://pypi.org/project/bcrypt/)** - Modern password hashing for your software
- **[Email-Validator](https://pypi.org/project/email-validator/)** - Robust email address syntax and deliverability validation

### Backend Development Tools
- **[Poetry](https://python-poetry.org/)** - Dependency management and packaging
- **[Pytest](https://pytest.org/)** - Simple and powerful testing framework
- **[Black](https://black.readthedocs.io/)** - The uncompromising Python code formatter
- **[Ruff](https://beta.ruff.rs/)** - An extremely fast Python linter
- **[MyPy](https://mypy-lang.org/)** - Optional static typing for Python

### Frontend Libraries
- **[React](https://reactjs.org/)** - A JavaScript library for building user interfaces
- **[Vite](https://vitejs.dev/)** - Next generation frontend tooling
- **[TypeScript](https://www.typescriptlang.org/)** - Typed superset of JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[React Router](https://reactrouter.com/)** - Declarative routing for React
- **[Axios](https://axios-http.com/)** - Promise based HTTP client
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)** - The code editor that powers VS Code
- **[Mermaid](https://mermaid-js.github.io/)** - Generation of diagram and flowchart from text
- **[PlantUML Encoder](https://plantuml.com/)** - Text-to-diagram tool
- **[EasyMDE](https://github.com/Ionaru/easy-markdown-editor)** - Simple, beautiful and embeddable JavaScript Markdown editor
- **[React Markdown](https://github.com/remarkjs/react-markdown)** - React component for rendering markdown
- **[HTML2Canvas](https://html2canvas.hertzen.com/)** - Screenshots with JavaScript
- **[jsPDF](https://parallax.github.io/jsPDF/)** - Client-side JavaScript PDF generation

### Frontend Development Tools
- **[ESLint](https://eslint.org/)** - Tool for identifying and reporting patterns in ECMAScript/JavaScript code
- **[PostCSS](https://postcss.org/)** - Tool for transforming CSS with JavaScript
- **[Autoprefixer](https://autoprefixer.github.io/)** - PostCSS plugin to parse CSS and add vendor prefixes

### Infrastructure
- **[Docker](https://www.docker.com/)** - Platform for developing, shipping, and running applications
- **[MongoDB](https://www.mongodb.com/)** - Document database

---

## 📜 License

This project is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).  
You are free to use, modify and distribute the software, even commercially, as long as you comply with the terms.

---

## 🙌 Contributing

We welcome contributions!  
To get started:

## 🔮 About the Cloud Version

Diagramahub is built to be self-hosted **but will also offer a managed cloud version soon**.  
If you're interested in early access or updates, follow us at [diagramahub.com](https://diagramahub.com).

---

## 🧠 Made with care by [@alexdzul](https://github.com/alexdzul) and contributors
