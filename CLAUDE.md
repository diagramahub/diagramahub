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

### SOLID Principles Implementation

The backend follows strict SOLID principles with clear separation of concerns:

**Module Structure** (`backend/app/api/v1/users/`):
- `interfaces.py` - Abstract base classes defining contracts (e.g., `IUserRepository`)
- `repository.py` - Concrete implementations of data access layer
- `services.py` - Business logic layer (depends on interfaces, not implementations)
- `schemas.py` - Pydantic models for validation and serialization
- `routes.py` - FastAPI route handlers (HTTP layer)

**Key Principle: Dependency Inversion**
- Services depend on abstractions (`IUserRepository`), not concrete implementations
- This enables easy mocking for tests and swapping implementations
- Example: `UserService` receives `IUserRepository` via dependency injection

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

**Backend module** (e.g., diagrams):
1. Create `backend/app/api/v1/diagrams/` directory
2. Add `interfaces.py` with abstract repository
3. Implement `repository.py` with concrete data access
4. Add `services.py` with business logic
5. Define `schemas.py` with Pydantic models
6. Create `routes.py` with FastAPI endpoints
7. **Write tests** in `backend/tests/api/v1/diagrams/`
8. Register router in `backend/app/main.py`
9. Add Beanie document model to lifespan initialization

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
