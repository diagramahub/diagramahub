# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Diagramahub is an open source platform for creating, organizing, and exporting diagrams using plain text (Mermaid, PlantUML, etc.). The project consists of:

- **Backend**: FastAPI + MongoDB with JWT authentication
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS v3
- **Infrastructure**: Docker Compose orchestration
- **Testing**: pytest with 100% coverage of authentication endpoints

## Common Commands

### Docker Development (Recommended)

```bash
# Start all services
docker-compose up --build

# Start in background
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Access containers
docker exec -it diagramahub-backend bash
docker exec -it diagramahub-mongodb mongosh
```

### Backend Development

```bash
cd backend

# Install dependencies (requires Poetry)
poetry install

# Run tests with pytest (100% coverage)
poetry run pytest
docker exec diagramahub-backend poetry run pytest

# Run tests without coverage (faster)
poetry run pytest --no-cov

# Run specific test markers
poetry run pytest -m integration
poetry run pytest -m unit

# Generate HTML coverage report
poetry run pytest --cov=app --cov-report=html
# Open: backend/htmlcov/index.html

# Run backend with hot reload
poetry run uvicorn app.main:app --reload --port 5172

# Code formatting
poetry run black app/
poetry run ruff check app/

# Type checking
poetry run mypy app/
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run dev server (hot reload enabled)
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Preview production build
npm run preview
```

### Testing Scripts

```bash
# Backend pytest suite (30 tests)
docker exec diagramahub-backend poetry run pytest

# Legacy shell script (basic API tests)
./test-api.sh

# Helper script for common test operations
docker exec diagramahub-backend ./run-tests.sh
```

## Architecture & Code Structure

### Backend Modular Structure (IMPORTANT)

**CRITICAL: Each CRUD entity MUST have its own dedicated module folder.**

The backend follows a strict modular architecture where **each entity (users, projects, diagrams, folders, etc.) lives in its own separate folder** under `backend/app/api/v1/`. This is mandatory for all new features.

**Current Module Structure:**
```
backend/app/api/v1/
├── users/          # User authentication and management
│   ├── __init__.py
│   ├── interfaces.py      # Abstract interfaces (IUserRepository)
│   ├── repository.py      # MongoDB implementation
│   ├── services.py        # Business logic
│   ├── schemas.py         # Pydantic models + Beanie Documents
│   └── routes.py          # FastAPI endpoints
│
├── projects/       # Project CRUD operations
│   ├── __init__.py
│   ├── interfaces.py      # IProjectRepository
│   ├── repository.py      # ProjectRepository
│   ├── services.py        # ProjectService
│   ├── schemas.py         # ProjectInDB, ProjectResponse, etc.
│   └── routes.py          # /projects endpoints
│
├── diagrams/       # Diagram CRUD operations
│   ├── __init__.py
│   ├── interfaces.py      # IDiagramRepository
│   ├── repository.py      # DiagramRepository
│   ├── services.py        # DiagramService
│   ├── schemas.py         # DiagramInDB, DiagramResponse, etc.
│   └── routes.py          # /diagrams endpoints
│
└── folders/        # Folder CRUD operations
    ├── __init__.py
    ├── interfaces.py      # IFolderRepository
    ├── repository.py      # FolderRepository
    ├── services.py        # FolderService
    ├── schemas.py         # FolderInDB, FolderResponse, etc.
    └── routes.py          # /folders endpoints
```

**Why This Structure?**
- ✅ **Separation of Concerns**: Each entity is completely independent
- ✅ **Scalability**: Easy to add new entities without touching existing code
- ✅ **Maintainability**: Changes to one entity don't affect others
- ✅ **Testability**: Each module can be tested in isolation
- ✅ **Team Collaboration**: Multiple developers can work on different modules simultaneously

### SOLID Principles Implementation

Each module follows strict SOLID principles with the same file structure:

**Standard Module Files (Required for every CRUD entity):**
- `interfaces.py` - Abstract base classes defining contracts (e.g., `IProjectRepository`)
  - Defines the interface/contract for data access
  - Uses ABC (Abstract Base Class) from Python
  - Example: `IProjectRepository` with methods like `create`, `get_by_id`, `update`, `delete`

- `repository.py` - Concrete implementations of data access layer
  - Implements the interface defined in `interfaces.py`
  - Handles all MongoDB operations using Beanie ODM
  - Example: `ProjectRepository(IProjectRepository)`

- `services.py` - Business logic layer (depends on interfaces, not implementations)
  - Contains all business rules and validations
  - Depends on interfaces (dependency injection)
  - Calls repositories to access data
  - Example: `ProjectService` receives `IProjectRepository` in `__init__`

- `schemas.py` - Pydantic models for validation and serialization
  - **Beanie Documents**: Models that map to MongoDB collections (extend `Document`)
  - **Request models**: For API input validation (e.g., `ProjectCreate`, `ProjectUpdate`)
  - **Response models**: For API output serialization (e.g., `ProjectResponse`)
  - Example structure:
    - `ProjectBase` - Shared fields
    - `ProjectCreate(ProjectBase)` - For POST requests
    - `ProjectUpdate` - For PUT/PATCH requests
    - `ProjectInDB(Document)` - Beanie model (MongoDB collection)
    - `ProjectResponse` - For API responses

- `routes.py` - FastAPI route handlers (HTTP layer)
  - Defines all HTTP endpoints for the entity
  - Uses FastAPI's `APIRouter`
  - Handles request/response parsing
  - Calls services for business logic
  - Example: `@router.post("/projects")`, `@router.get("/projects/{id}")`

**Key Principle: Dependency Inversion**
- Services depend on abstractions (`IProjectRepository`), not concrete implementations
- This enables easy mocking for tests and swapping implementations
- Example: `ProjectService` receives `IProjectRepository` via dependency injection
- Repositories are injected in route dependency functions

### Backend Architecture

**Database Layer** (`backend/app/api/v1/users/`):
- Uses Beanie ODM (MongoDB Object-Document Mapper)
- `UserInDB` is the Beanie Document model (extends `Document`)
- Repositories handle all MongoDB operations
- Connection initialized in `app/main.py` lifespan handler

**Authentication Flow**:
1. User registers → password hashed with BCrypt → stored in MongoDB
2. User logs in → credentials validated → JWT token generated
3. Protected routes → JWT validated via `get_current_user` dependency
4. Token stored in frontend `localStorage`, sent via `Authorization: Bearer` header

**Security** (`backend/app/core/security.py`):
- JWT tokens with configurable expiration (default: 30 minutes)
- BCrypt password hashing with automatic salting
- Password validation: minimum 8 chars, uppercase, lowercase, number
- Password reset with single-use tokens (1 hour expiration)

**Configuration** (`backend/app/core/config.py`):
- Pydantic Settings for environment variables
- All secrets loaded from `.env` file
- Never commit `.env` - use `.env.template` as reference
- **Required**: `JWT_SECRET` must be set (min 32 characters)

### Frontend Architecture

**State Management** (`frontend/src/contexts/AuthContext.tsx`):
- React Context API for global auth state
- Stores user info and JWT token
- Token persisted in `localStorage`
- Auto-logout on 401 responses

**API Service** (`frontend/src/services/api.ts`):
- Axios instance with interceptors
- Request interceptor: automatically adds JWT token
- Response interceptor: handles 401 errors (token expiration)
- All API calls centralized in `ApiService` class

**Routing** (`frontend/src/App.tsx`):
- React Router v7 for navigation
- `PrivateRoute` component protects authenticated routes
- Auto-redirect to `/login` when unauthenticated
- Routes: `/login`, `/register`, `/dashboard`

**Styling**:
- TailwindCSS v3 for utility-first styling
- Hot reload configured in Docker
- Responsive design patterns

### Testing Architecture

**Backend Tests** (`backend/tests/`):
- **Framework**: pytest + pytest-asyncio + pytest-cov
- **Test Database**: Isolated MongoDB test database (dropped after each test)
- **Fixtures**: Shared fixtures in `conftest.py` (client, authenticated_client, test_db)
- **Coverage**: 30 integration tests covering all authentication endpoints
- **Data Generation**: Faker library for random test data
- **Async Support**: Full async/await support with httpx AsyncClient

**Test Structure**:
```
backend/tests/
├── conftest.py                    # Shared fixtures
├── api/v1/users/
│   ├── test_auth.py              # Registration & Login (14 tests)
│   └── test_password_management.py # Password ops (16 tests)
```

**Test Coverage**:
- ✅ User registration (success, duplicates, validations)
- ✅ User login (success, wrong credentials, inactive users)
- ✅ Change password (authenticated, authorization)
- ✅ Password reset (request, confirm, token expiration)
- ✅ All edge cases and error scenarios

**Running Tests**:
```bash
# All tests with coverage
docker exec diagramahub-backend poetry run pytest

# Fast execution without coverage
docker exec diagramahub-backend poetry run pytest --no-cov

# Only integration tests
docker exec diagramahub-backend poetry run pytest -m integration

# Verbose output
docker exec diagramahub-backend poetry run pytest -v

# Stop on first failure
docker exec diagramahub-backend poetry run pytest -x

# HTML coverage report
docker exec diagramahub-backend poetry run pytest --cov-report=html
```

### Data Flow

```
Frontend (React) → API Service (Axios) → Backend Routes (FastAPI)
                                              ↓
                                          Services (Business Logic)
                                              ↓
                                          Repository (Data Access)
                                              ↓
                                          MongoDB (Beanie ODM)
```

### API Endpoints

All endpoints prefixed with `/api/v1`:

**Public**:
- `POST /users/register` - Create new user
- `POST /users/login` - Authenticate and get JWT
- `POST /users/reset-password-request` - Request password reset token
- `POST /users/reset-password-confirm` - Confirm password reset

**Protected** (requires JWT):
- `GET /users/me` - Get current user info
- `PUT /users/change-password` - Change password (authenticated)

**Health**:
- `GET /` - Root endpoint with version info
- `GET /health` - Health check

### Environment Configuration

**Backend** (`backend/.env`):
```bash
# Generate secure JWT secret
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Required variables
JWT_SECRET=<generated-secret>
MONGO_URI=mongodb://mongodb:27017
DATABASE_NAME=diagramahub
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**Frontend** (docker-compose.yml):
```bash
VITE_API_URL=http://localhost:5172
```

### Docker Services

- **mongodb** (port 27017): MongoDB 7.0 with persistent volume
- **backend** (port 5172): FastAPI with hot reload enabled
- **frontend** (port 5173): Vite dev server with hot reload

Network: All services on `diagramahub-network` bridge

**Hot Reload**:
- Backend: `backend/app/` mounted → changes auto-reload
- Frontend: `frontend/src/` mounted → Vite HMR active
- Tests: `backend/tests/` mounted → test changes reflected immediately

### Adding New Features

**IMPORTANT: Creating a New Backend Module (CRUD Entity)**

When adding a new entity (e.g., `comments`, `notifications`, `teams`), you MUST follow this exact structure:

**Step-by-Step Guide:**

1. **Create module directory**: `backend/app/api/v1/<entity_name>/`
   ```bash
   mkdir -p backend/app/api/v1/<entity_name>
   ```

2. **Create `__init__.py`**:
   ```python
   """<Entity> module."""
   ```

3. **Create `schemas.py`** (Pydantic models + Beanie Document):
   ```python
   """Pydantic models for <entity> module."""
   from datetime import datetime
   from typing import Optional, List
   from pydantic import BaseModel, Field
   from beanie import Document

   # Base model with shared fields
   class <Entity>Base(BaseModel):
       """Base <entity> model."""
       name: str = Field(..., min_length=1, max_length=100)
       # Add your fields here

   # For POST requests
   class <Entity>Create(<Entity>Base):
       """Model for creating a new <entity>."""
       pass

   # For PUT/PATCH requests
   class <Entity>Update(BaseModel):
       """Model for updating a <entity>."""
       name: Optional[str] = Field(None, min_length=1, max_length=100)
       # All fields optional

   # MongoDB document (Beanie model)
   class <Entity>InDB(Document):
       """<Entity> document stored in MongoDB."""
       name: str
       user_id: str  # Owner (if applicable)
       created_at: datetime = Field(default_factory=datetime.utcnow)
       updated_at: datetime = Field(default_factory=datetime.utcnow)

       class Settings:
           name = "<entity_plural>"  # MongoDB collection name
           indexes = ["user_id"]  # Add indexes as needed

   # For API responses
   class <Entity>Response(BaseModel):
       """Model for <entity> API responses."""
       id: str
       name: str
       user_id: str
       created_at: datetime
       updated_at: datetime

       class Config:
           from_attributes = True
   ```

4. **Create `interfaces.py`** (Abstract repository interface):
   ```python
   """Abstract interfaces for <entity> repository."""
   from abc import ABC, abstractmethod
   from typing import Optional
   from .schemas import <Entity>InDB, <Entity>Create, <Entity>Update

   class I<Entity>Repository(ABC):
       """Abstract interface for <entity> data access."""

       @abstractmethod
       async def create(self, data: <Entity>Create, user_id: str) -> <Entity>InDB:
           """Create a new <entity>."""
           pass

       @abstractmethod
       async def get_by_id(self, entity_id: str) -> Optional[<Entity>InDB]:
           """Get <entity> by ID."""
           pass

       @abstractmethod
       async def get_by_user_id(self, user_id: str) -> list[<Entity>InDB]:
           """Get all <entities> for a user."""
           pass

       @abstractmethod
       async def update(self, entity_id: str, data: <Entity>Update) -> Optional[<Entity>InDB]:
           """Update <entity>."""
           pass

       @abstractmethod
       async def delete(self, entity_id: str) -> bool:
           """Delete <entity>."""
           pass
   ```

5. **Create `repository.py`** (Concrete MongoDB implementation):
   ```python
   """Concrete implementation of <entity> repository."""
   from datetime import datetime
   from typing import Optional
   from beanie import PydanticObjectId
   from .interfaces import I<Entity>Repository
   from .schemas import <Entity>InDB, <Entity>Create, <Entity>Update

   class <Entity>Repository(I<Entity>Repository):
       """MongoDB implementation of <entity> repository using Beanie."""

       async def create(self, data: <Entity>Create, user_id: str) -> <Entity>InDB:
           """Create a new <entity>."""
           entity = <Entity>InDB(
               name=data.name,
               user_id=user_id,
               created_at=datetime.utcnow(),
               updated_at=datetime.utcnow()
           )
           await entity.insert()
           return entity

       async def get_by_id(self, entity_id: str) -> Optional[<Entity>InDB]:
           """Get <entity> by ID."""
           try:
               return await <Entity>InDB.get(PydanticObjectId(entity_id))
           except Exception:
               return None

       async def get_by_user_id(self, user_id: str) -> list[<Entity>InDB]:
           """Get all <entities> for a user."""
           entities = await <Entity>InDB.find(<Entity>InDB.user_id == user_id).to_list()
           return entities

       async def update(self, entity_id: str, data: <Entity>Update) -> Optional[<Entity>InDB]:
           """Update <entity>."""
           entity = await self.get_by_id(entity_id)
           if not entity:
               return None

           update_data = data.model_dump(exclude_unset=True)
           if update_data:
               update_data["updated_at"] = datetime.utcnow()
               await entity.set(update_data)

           return entity

       async def delete(self, entity_id: str) -> bool:
           """Delete <entity>."""
           entity = await self.get_by_id(entity_id)
           if not entity:
               return False

           await entity.delete()
           return True
   ```

6. **Create `services.py`** (Business logic):
   ```python
   """Business logic layer for <entities>."""
   from fastapi import HTTPException, status
   from .interfaces import I<Entity>Repository
   from .schemas import <Entity>Create, <Entity>Update, <Entity>Response

   class <Entity>Service:
       """Service for <entity> business logic."""

       def __init__(self, repository: I<Entity>Repository):
           self.repository = repository

       async def create_<entity>(self, data: <Entity>Create, user_id: str) -> <Entity>Response:
           """Create a new <entity>."""
           entity = await self.repository.create(data, user_id)
           return <Entity>Response(
               id=str(entity.id),
               name=entity.name,
               user_id=entity.user_id,
               created_at=entity.created_at,
               updated_at=entity.updated_at
           )

       async def get_<entity>(self, entity_id: str, user_id: str) -> <Entity>Response:
           """Get <entity> by ID with authorization."""
           entity = await self.repository.get_by_id(entity_id)
           if not entity:
               raise HTTPException(
                   status_code=status.HTTP_404_NOT_FOUND,
                   detail="<Entity> not found"
               )

           if entity.user_id != user_id:
               raise HTTPException(
                   status_code=status.HTTP_403_FORBIDDEN,
                   detail="You don't have access to this <entity>"
               )

           return <Entity>Response(
               id=str(entity.id),
               name=entity.name,
               user_id=entity.user_id,
               created_at=entity.created_at,
               updated_at=entity.updated_at
           )

       # Add more service methods (update, delete, list, etc.)
   ```

7. **Create `routes.py`** (FastAPI endpoints):
   ```python
   """FastAPI routes for <entities>."""
   from fastapi import APIRouter, Depends, status
   from app.api.v1.users.routes import get_current_user_email
   from app.api.v1.users.repository import UserRepository
   from .repository import <Entity>Repository
   from .services import <Entity>Service
   from .schemas import <Entity>Create, <Entity>Update, <Entity>Response

   router = APIRouter()

   # Dependency injection
   def get_<entity>_service() -> <Entity>Service:
       """Get <entity> service instance."""
       return <Entity>Service(repository=<Entity>Repository())

   async def get_current_user_id(current_user_email: str = Depends(get_current_user_email)) -> str:
       """Get current user ID from email."""
       user_repo = UserRepository()
       user = await user_repo.get_by_email(current_user_email)
       return str(user.id)

   @router.post("/<entities>", response_model=<Entity>Response, status_code=status.HTTP_201_CREATED)
   async def create_<entity>(
       data: <Entity>Create,
       user_id: str = Depends(get_current_user_id),
       service: <Entity>Service = Depends(get_<entity>_service)
   ):
       """Create a new <entity>."""
       return await service.create_<entity>(data, user_id)

   @router.get("/<entities>/{entity_id}", response_model=<Entity>Response)
   async def get_<entity>(
       entity_id: str,
       user_id: str = Depends(get_current_user_id),
       service: <Entity>Service = Depends(get_<entity>_service)
   ):
       """Get <entity> by ID."""
       return await service.get_<entity>(entity_id, user_id)

   # Add more endpoints (PUT, DELETE, etc.)
   ```

8. **Register in `backend/app/main.py`**:
   ```python
   # Add imports
   from app.api.v1.<entity_plural>.routes import router as <entity_plural>_router
   from app.api.v1.<entity_plural>.schemas import <Entity>InDB

   # Add to Beanie initialization
   await init_beanie(
       database=database,
       document_models=[UserInDB, ProjectInDB, <Entity>InDB],  # Add your model
   )

   # Register router
   app.include_router(<entity_plural>_router, prefix=settings.API_V1_PREFIX)
   ```

9. **Write tests** in `backend/tests/api/v1/<entity_plural>/`
   - Create test file for your endpoints
   - Test CRUD operations
   - Test authorization and edge cases

10. **Update API types in frontend** (`frontend/src/types/<entity>.ts`)

**Example: Creating a "comments" module**
- Folder: `backend/app/api/v1/comments/`
- Files: `__init__.py`, `interfaces.py`, `repository.py`, `services.py`, `schemas.py`, `routes.py`
- Models: `CommentBase`, `CommentCreate`, `CommentUpdate`, `CommentInDB`, `CommentResponse`
- Interface: `ICommentRepository`
- Implementation: `CommentRepository(ICommentRepository)`
- Service: `CommentService`
- Routes: `/api/v1/comments` endpoints

**DO NOT:**
- ❌ Put multiple entities in the same module
- ❌ Mix different entity logic in shared files
- ❌ Create monolithic repository files
- ❌ Skip the interface layer (always create `interfaces.py`)

**DO:**
- ✅ One entity = One module folder
- ✅ Follow the 5-file structure (interfaces, repository, services, schemas, routes)
- ✅ Use dependency injection (services depend on interfaces)
- ✅ Write tests for each new module
- ✅ Register router and Beanie model in `main.py`

**Frontend feature**:
1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Add API methods to `frontend/src/services/api.ts`
4. Update types in `frontend/src/types/`
5. Add to navigation if needed

**Writing Tests** (Backend):
1. Create test file: `test_<feature>.py` in appropriate directory
2. Import pytest and pytest_asyncio
3. Use `@pytest.mark.asyncio` for async tests
4. Use fixtures from `conftest.py` (client, authenticated_client, test_db)
5. Test success cases, error cases, edge cases, validations
6. Run tests: `docker exec diagramahub-backend poetry run pytest`

Example test:
```python
import pytest
from httpx import AsyncClient

@pytest.mark.integration
class TestMyFeature:
    @pytest.mark.asyncio
    async def test_my_endpoint_success(self, client: AsyncClient):
        response = await client.post("/api/v1/my-endpoint", json={"data": "value"})
        assert response.status_code == 200
        assert response.json()["result"] == "expected"
```

### Common Patterns

**Adding a protected endpoint**:
```python
from app.core.security import get_current_user
from app.api.v1.users.schemas import UserInDB

@router.get("/protected")
async def protected_route(current_user: UserInDB = Depends(get_current_user)):
    return {"user_id": str(current_user.id)}
```

**Creating a new service**:
```python
class MyService:
    def __init__(self, repository: IMyRepository):
        self.repository = repository

    async def do_something(self, data: MySchema):
        # Business logic here
        return await self.repository.create(data)
```

**Frontend authenticated request**:
```typescript
// Token automatically added by axios interceptor
const user = await apiService.getCurrentUser();
```

**Adding test fixtures**:
```python
@pytest_asyncio.fixture
async def my_fixture(client: AsyncClient) -> MyType:
    """Fixture description."""
    # Setup
    result = await create_test_data()
    yield result
    # Teardown (optional)
    await cleanup_test_data()
```

### Code Quality Standards

- **Type hints**: All Python functions must have type hints
- **Validation**: Use Pydantic models for all API inputs/outputs
- **Async/await**: Use async patterns consistently in backend
- **Error handling**: Use FastAPI HTTPException for API errors
- **Naming**: Snake_case (Python), camelCase (TypeScript)
- **Testing**: Write tests for all new endpoints (aim for 100% coverage)
- **Documentation**: Add docstrings to all functions and classes

### Troubleshooting

**Port conflicts**:
- Backend: 5172 (changed from default 8000)
- Frontend: 5173
- MongoDB: 27017

**TailwindCSS issues**:
- Using TailwindCSS v3 (not v4) for PostCSS compatibility
- Config: `frontend/tailwind.config.js`

**Test failures**:
- Ensure MongoDB is running: `docker-compose ps`
- Check test database cleanup: Tests use `diagramahub_test` database
- View logs: `docker-compose logs backend`

**Hot reload not working**:
- Check volume mounts in `docker-compose.yml`
- Restart containers: `docker-compose restart`

### Documentation

- **Swagger UI**: http://localhost:5172/docs (interactive)
- **ReDoc**: http://localhost:5172/redoc (alternative)
- **README.md**: Main project documentation
- **SETUP.md**: Detailed installation and troubleshooting guide
- **PROJECT_SUMMARY.md**: Implementation details and decisions
- **CLAUDE.md**: This file (for Claude Code AI)

### License

Apache 2.0 - See LICENSE file for details

---

## Tips for Claude Code

- Always run tests after making changes to backend code
- Use pytest fixtures to avoid code duplication in tests
- Follow SOLID principles when adding new features
- Check existing patterns before implementing new ones
- Update this file when adding significant new features or patterns
