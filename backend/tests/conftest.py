"""
Shared pytest fixtures and configuration for all tests.
"""
import asyncio
from typing import AsyncGenerator, Generator
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from faker import Faker

from app.main import app
from app.core.config import settings
from app.api.v1.users.schemas import UserInDB as User

# Initialize Faker
fake = Faker()

# Test database configuration
TEST_DATABASE_NAME = f"{settings.DATABASE_NAME}_test"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def test_db() -> AsyncGenerator:
    """
    Create a test database and initialize Beanie.
    Drops the database after each test to ensure isolation.
    """
    # Create MongoDB client
    client = AsyncIOMotorClient(settings.MONGO_URI)

    # Initialize Beanie with test database
    await init_beanie(
        database=client[TEST_DATABASE_NAME],
        document_models=[User]
    )

    yield client[TEST_DATABASE_NAME]

    # Cleanup: Drop test database after each test
    await client.drop_database(TEST_DATABASE_NAME)
    client.close()


@pytest_asyncio.fixture(scope="function")
async def client(test_db) -> AsyncGenerator[AsyncClient, None]:
    """
    Create an async HTTP client for testing FastAPI endpoints.
    Uses TestClient under the hood but with async support.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def user_data() -> dict:
    """Generate random valid user data for registration."""
    return {
        "email": fake.email(),
        "password": "TestPass123",
        "full_name": fake.name()
    }


@pytest.fixture
def invalid_user_data() -> dict:
    """Generate invalid user data (weak password)."""
    return {
        "email": fake.email(),
        "password": "weak",
        "full_name": fake.name()
    }


@pytest_asyncio.fixture
async def registered_user(client: AsyncClient, user_data: dict) -> dict:
    """
    Create and return a registered user with their credentials.
    Returns dict with email, password, and user response data.
    """
    response = await client.post("/api/v1/users/register", json=user_data)
    assert response.status_code == 201

    return {
        "email": user_data["email"],
        "password": user_data["password"],
        "user": response.json()
    }


@pytest_asyncio.fixture
async def authenticated_client(client: AsyncClient, registered_user: dict) -> AsyncClient:
    """
    Create an authenticated HTTP client with a valid JWT token.
    """
    # Login to get token
    login_response = await client.post(
        "/api/v1/users/login",
        json={
            "email": registered_user["email"],
            "password": registered_user["password"]
        }
    )
    assert login_response.status_code == 200

    token = login_response.json()["access_token"]

    # Add authorization header to client
    client.headers["Authorization"] = f"Bearer {token}"

    return client


@pytest.fixture
def reset_token() -> str:
    """Generate a mock password reset token."""
    return fake.sha256()
