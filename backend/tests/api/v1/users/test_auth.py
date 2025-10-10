"""
Tests for user authentication endpoints (register and login).
"""
import pytest
from httpx import AsyncClient


@pytest.mark.integration
class TestUserRegistration:
    """Test suite for user registration endpoint."""

    @pytest.mark.asyncio
    async def test_register_user_success(self, client: AsyncClient, user_data: dict):
        """Test successful user registration with valid data."""
        response = await client.post("/api/v1/users/register", json=user_data)

        assert response.status_code == 201
        data = response.json()

        assert data["email"] == user_data["email"]
        assert data["full_name"] == user_data["full_name"]
        assert data["is_active"] is True
        assert "id" in data
        assert "created_at" in data
        assert "password" not in data  # Password should never be returned

    @pytest.mark.asyncio
    async def test_register_user_duplicate_email(
        self, client: AsyncClient, registered_user: dict
    ):
        """Test registration fails when email already exists."""
        response = await client.post(
            "/api/v1/users/register",
            json={
                "email": registered_user["email"],
                "password": "AnotherPass123",
                "full_name": "Another Name"
            }
        )

        assert response.status_code == 400
        assert "already" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_register_user_invalid_email(self, client: AsyncClient):
        """Test registration fails with invalid email format."""
        response = await client.post(
            "/api/v1/users/register",
            json={
                "email": "not-an-email",
                "password": "TestPass123",
                "full_name": "Test User"
            }
        )

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_register_user_weak_password(
        self, client: AsyncClient, invalid_user_data: dict
    ):
        """Test registration fails with weak password."""
        response = await client.post("/api/v1/users/register", json=invalid_user_data)

        assert response.status_code == 422
        data = response.json()
        assert "password" in str(data).lower()

    @pytest.mark.asyncio
    async def test_register_user_missing_email(self, client: AsyncClient):
        """Test registration fails when email is missing."""
        response = await client.post(
            "/api/v1/users/register",
            json={"password": "TestPass123"}
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_user_missing_password(self, client: AsyncClient):
        """Test registration fails when password is missing."""
        response = await client.post(
            "/api/v1/users/register",
            json={"email": "test@example.com"}
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_user_without_full_name(self, client: AsyncClient):
        """Test registration succeeds without full_name (optional field)."""
        response = await client.post(
            "/api/v1/users/register",
            json={
                "email": "test@example.com",
                "password": "TestPass123"
            }
        )

        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["full_name"] is None


@pytest.mark.integration
class TestUserLogin:
    """Test suite for user login endpoint."""

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, registered_user: dict):
        """Test successful login with valid credentials."""
        response = await client.post(
            "/api/v1/users/login",
            json={
                "email": registered_user["email"],
                "password": registered_user["password"]
            }
        )

        assert response.status_code == 200
        data = response.json()

        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 0

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, registered_user: dict):
        """Test login fails with incorrect password."""
        response = await client.post(
            "/api/v1/users/login",
            json={
                "email": registered_user["email"],
                "password": "WrongPassword123"
            }
        )

        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client: AsyncClient):
        """Test login fails with non-existent email."""
        response = await client.post(
            "/api/v1/users/login",
            json={
                "email": "nonexistent@example.com",
                "password": "TestPass123"
            }
        )

        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_login_invalid_email_format(self, client: AsyncClient):
        """Test login fails with invalid email format."""
        response = await client.post(
            "/api/v1/users/login",
            json={
                "email": "not-an-email",
                "password": "TestPass123"
            }
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_missing_email(self, client: AsyncClient):
        """Test login fails when email is missing."""
        response = await client.post(
            "/api/v1/users/login",
            json={"password": "TestPass123"}
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_missing_password(self, client: AsyncClient):
        """Test login fails when password is missing."""
        response = await client.post(
            "/api/v1/users/login",
            json={"email": "test@example.com"}
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_inactive_user(self, client: AsyncClient, user_data: dict, test_db):
        """Test login fails for inactive user."""
        # First register the user
        register_response = await client.post("/api/v1/users/register", json=user_data)
        assert register_response.status_code == 201

        # Deactivate the user directly in database
        from app.api.v1.users.schemas import UserInDB
        user = await UserInDB.find_one(UserInDB.email == user_data["email"])
        user.is_active = False
        await user.save()

        # Try to login with inactive user
        response = await client.post(
            "/api/v1/users/login",
            json={
                "email": user_data["email"],
                "password": user_data["password"]
            }
        )

        assert response.status_code == 400
        assert "inactive" in response.json()["detail"].lower()
