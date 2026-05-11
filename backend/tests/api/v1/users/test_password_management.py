"""
Tests for password management endpoints (change password and reset password).
"""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.api.v1.users.schemas import UserInDB


@pytest.mark.integration
class TestChangePassword:
    """Test suite for change password endpoint (authenticated, simplified)."""

    @pytest.mark.asyncio
    async def test_change_password_success(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """Test successful password change with only new_password."""
        new_password = "NewTestPass456"

        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={"new_password": new_password}
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
    async def test_change_password_weak_new_password(
        self, authenticated_client: AsyncClient
    ):
        """Test password change fails with weak new password."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={"new_password": "weak"}
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_change_password_without_auth(self, client: AsyncClient):
        """Test password change fails without authentication."""
        response = await client.put(
            "/api/v1/users/change-password",
            json={"new_password": "NewTestPass456"}
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_change_password_same_as_current(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """Test password change with same password as current."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={"new_password": registered_user["password"]}
        )

        # This should succeed (no business rule against it)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_change_password_missing_new_password(self, authenticated_client: AsyncClient):
        """Test password change fails with missing new_password field."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_change_password_no_uppercase(self, authenticated_client: AsyncClient):
        """Test password change fails when new password has no uppercase letter."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={"new_password": "alllower1"}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_change_password_no_digit(self, authenticated_client: AsyncClient):
        """Test password change fails when new password has no digit."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={"new_password": "NoDigitHere"}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_change_password_no_lowercase(self, authenticated_client: AsyncClient):
        """Test password change fails when new password has no lowercase letter."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={"new_password": "ALLUPPER1"}
        )
        assert response.status_code == 422


def _mock_email_service():
    """Return a patch context that mocks EmailService so no real vendor is needed."""
    mock_instance = AsyncMock()
    mock_instance.get_default_email_vendor = AsyncMock()
    mock_instance.send_password_recovery_email = AsyncMock()
    return patch(
        "app.api.v1.users.services.EmailService",
        return_value=mock_instance,
    )


@pytest.mark.integration
class TestPasswordReset:
    """Test suite for password reset request and confirmation endpoints."""

    @pytest.mark.asyncio
    async def test_password_reset_request_success(
        self, client: AsyncClient, registered_user: dict
    ):
        """Test successful password reset request."""
        with _mock_email_service():
            response = await client.post(
                "/api/v1/users/reset-password-request",
                json={"email": registered_user["email"]}
            )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        # Token should NOT be in the response (removed for security)
        assert "token" not in data

    @pytest.mark.asyncio
    async def test_password_reset_request_nonexistent_email(self, client: AsyncClient):
        """Test password reset request with non-existent email."""
        with _mock_email_service():
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
    async def test_password_reset_request_no_email_vendor(self, client: AsyncClient, registered_user: dict):
        """Test password reset request returns 503 when no email vendor is configured."""
        # No mock — no vendor in test DB → should get 503
        response = await client.post(
            "/api/v1/users/reset-password-request",
            json={"email": registered_user["email"]}
        )

        assert response.status_code == 503

    @pytest.mark.asyncio
    async def test_password_reset_confirm_success(
        self, client: AsyncClient, registered_user: dict
    ):
        """Test successful password reset confirmation."""
        # Request password reset (mocked email)
        with _mock_email_service():
            reset_request = await client.post(
                "/api/v1/users/reset-password-request",
                json={"email": registered_user["email"]}
            )
        assert reset_request.status_code == 200

        # Retrieve the token from the database
        user = await UserInDB.find_one(UserInDB.email == registered_user["email"])
        reset_token = user.reset_token
        assert reset_token is not None

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
        # Request reset token (mocked email)
        with _mock_email_service():
            await client.post(
                "/api/v1/users/reset-password-request",
                json={"email": registered_user["email"]}
            )

        user = await UserInDB.find_one(UserInDB.email == registered_user["email"])
        reset_token = user.reset_token

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

    @pytest.mark.asyncio
    async def test_password_reset_invalidates_previous_token(
        self, client: AsyncClient, registered_user: dict
    ):
        """Test that requesting a new reset token invalidates the previous one."""
        with _mock_email_service():
            # First request
            await client.post(
                "/api/v1/users/reset-password-request",
                json={"email": registered_user["email"]}
            )

        user = await UserInDB.find_one(UserInDB.email == registered_user["email"])
        first_token = user.reset_token

        with _mock_email_service():
            # Second request — should invalidate the first token
            await client.post(
                "/api/v1/users/reset-password-request",
                json={"email": registered_user["email"]}
            )

        user = await UserInDB.find_one(UserInDB.email == registered_user["email"])
        second_token = user.reset_token

        assert first_token != second_token

        # The first token should no longer work
        response = await client.post(
            "/api/v1/users/reset-password-confirm",
            json={
                "email": registered_user["email"],
                "token": first_token,
                "new_password": "NewResetPass789"
            }
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_password_reset_email_send_failure(
        self, client: AsyncClient, registered_user: dict
    ):
        """Test that email send failure returns HTTP 500."""
        mock_instance = AsyncMock()
        mock_instance.get_default_email_vendor = AsyncMock()
        mock_instance.send_password_recovery_email = AsyncMock(
            side_effect=Exception("SMTP failure")
        )

        from fastapi import HTTPException

        mock_instance.send_password_recovery_email = AsyncMock(
            side_effect=HTTPException(status_code=500, detail="Error al enviar correo de recuperación")
        )

        with patch("app.api.v1.users.services.EmailService", return_value=mock_instance):
            response = await client.post(
                "/api/v1/users/reset-password-request",
                json={"email": registered_user["email"]}
            )

        assert response.status_code == 500
