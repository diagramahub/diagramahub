"""
Tests for password management endpoints (change password and reset password).
"""
import pytest
from httpx import AsyncClient


@pytest.mark.integration
class TestChangePassword:
    """Test suite for change password endpoint (authenticated)."""

    @pytest.mark.asyncio
    async def test_change_password_success(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """Test successful password change with valid current password."""
        new_password = "NewTestPass456"

        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={
                "current_password": registered_user["password"],
                "new_password": new_password
            }
        )

        assert response.status_code == 200
        assert "successfully" in response.json()["message"].lower()

        # Verify we can login with new password
        login_response = await authenticated_client.post(
            "/api/v1/users/login",
            json={
                "email": registered_user["email"],
                "password": new_password
            }
        )
        assert login_response.status_code == 200

    @pytest.mark.asyncio
    async def test_change_password_wrong_current_password(
        self, authenticated_client: AsyncClient
    ):
        """Test password change fails with incorrect current password."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={
                "current_password": "WrongPassword123",
                "new_password": "NewTestPass456"
            }
        )

        assert response.status_code == 400
        assert "incorrect" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_change_password_weak_new_password(
        self, authenticated_client: AsyncClient
    ):
        """Test password change fails with weak new password."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={
                "current_password": "TestPass123",
                "new_password": "weak"
            }
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_change_password_without_auth(self, client: AsyncClient):
        """Test password change fails without authentication."""
        response = await client.put(
            "/api/v1/users/change-password",
            json={
                "current_password": "TestPass123",
                "new_password": "NewTestPass456"
            }
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_change_password_same_as_current(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """Test password change with same password as current."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={
                "current_password": registered_user["password"],
                "new_password": registered_user["password"]
            }
        )

        # This should succeed (no business rule against it)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_change_password_missing_fields(self, authenticated_client: AsyncClient):
        """Test password change fails with missing required fields."""
        # Missing new_password
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={"current_password": "TestPass123"}
        )
        assert response.status_code == 422

        # Missing current_password
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={"new_password": "NewTestPass456"}
        )
        assert response.status_code == 422


@pytest.mark.integration
class TestPasswordReset:
    """Test suite for password reset request and confirmation endpoints."""

    @pytest.mark.asyncio
    async def test_password_reset_request_success(
        self, client: AsyncClient, registered_user: dict
    ):
        """Test successful password reset request."""
        response = await client.post(
            "/api/v1/users/reset-password-request",
            json={"email": registered_user["email"]}
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "token" in data  # For testing purposes
        assert len(data["token"]) > 0

    @pytest.mark.asyncio
    async def test_password_reset_request_nonexistent_email(self, client: AsyncClient):
        """Test password reset request with non-existent email."""
        response = await client.post(
            "/api/v1/users/reset-password-request",
            json={"email": "nonexistent@example.com"}
        )

        # Should return 200 for security (don't reveal if email exists)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_password_reset_request_invalid_email(self, client: AsyncClient):
        """Test password reset request with invalid email format."""
        response = await client.post(
            "/api/v1/users/reset-password-request",
            json={"email": "not-an-email"}
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_password_reset_request_missing_email(self, client: AsyncClient):
        """Test password reset request without email."""
        response = await client.post(
            "/api/v1/users/reset-password-request",
            json={}
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_password_reset_confirm_success(
        self, client: AsyncClient, registered_user: dict
    ):
        """Test successful password reset confirmation."""
        # First, request password reset
        reset_request = await client.post(
            "/api/v1/users/reset-password-request",
            json={"email": registered_user["email"]}
        )
        assert reset_request.status_code == 200
        reset_token = reset_request.json()["token"]

        # Now confirm with the token
        new_password = "NewResetPass789"
        response = await client.post(
            "/api/v1/users/reset-password-confirm",
            json={
                "email": registered_user["email"],
                "token": reset_token,
                "new_password": new_password
            }
        )

        assert response.status_code == 200
        assert "successfully" in response.json()["message"].lower()

        # Verify we can login with new password
        login_response = await client.post(
            "/api/v1/users/login",
            json={
                "email": registered_user["email"],
                "password": new_password
            }
        )
        assert login_response.status_code == 200

    @pytest.mark.asyncio
    async def test_password_reset_confirm_invalid_token(
        self, client: AsyncClient, registered_user: dict
    ):
        """Test password reset fails with invalid token."""
        response = await client.post(
            "/api/v1/users/reset-password-confirm",
            json={
                "email": registered_user["email"],
                "token": "invalid-token-123",
                "new_password": "NewResetPass789"
            }
        )

        assert response.status_code == 400
        assert "invalid" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_password_reset_confirm_expired_token(
        self, client: AsyncClient, registered_user: dict, test_db
    ):
        """Test password reset fails with expired token."""
        import time
        from app.api.v1.users.schemas import UserInDB

        # Create a reset token that's already expired
        user = await UserInDB.find_one(UserInDB.email == registered_user["email"])
        user.reset_token = "expired-token"
        user.reset_token_expires = time.time() - 3600  # 1 hour ago
        await user.save()

        response = await client.post(
            "/api/v1/users/reset-password-confirm",
            json={
                "email": registered_user["email"],
                "token": "expired-token",
                "new_password": "NewResetPass789"
            }
        )

        assert response.status_code == 400
        assert "expired" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_password_reset_confirm_weak_password(
        self, client: AsyncClient, registered_user: dict
    ):
        """Test password reset fails with weak new password."""
        # Request reset token
        reset_request = await client.post(
            "/api/v1/users/reset-password-request",
            json={"email": registered_user["email"]}
        )
        reset_token = reset_request.json()["token"]

        # Try to confirm with weak password
        response = await client.post(
            "/api/v1/users/reset-password-confirm",
            json={
                "email": registered_user["email"],
                "token": reset_token,
                "new_password": "weak"
            }
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_password_reset_confirm_nonexistent_email(
        self, client: AsyncClient, reset_token: str
    ):
        """Test password reset confirmation with non-existent email."""
        response = await client.post(
            "/api/v1/users/reset-password-confirm",
            json={
                "email": "nonexistent@example.com",
                "token": reset_token,
                "new_password": "NewResetPass789"
            }
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_password_reset_confirm_missing_fields(self, client: AsyncClient):
        """Test password reset confirmation fails with missing fields."""
        # Missing token
        response = await client.post(
            "/api/v1/users/reset-password-confirm",
            json={
                "email": "test@example.com",
                "new_password": "NewResetPass789"
            }
        )
        assert response.status_code == 422

        # Missing email
        response = await client.post(
            "/api/v1/users/reset-password-confirm",
            json={
                "token": "some-token",
                "new_password": "NewResetPass789"
            }
        )
        assert response.status_code == 422

        # Missing new_password
        response = await client.post(
            "/api/v1/users/reset-password-confirm",
            json={
                "email": "test@example.com",
                "token": "some-token"
            }
        )
        assert response.status_code == 422
