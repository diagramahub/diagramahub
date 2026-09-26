"""
Tests for password management endpoints (change password and reset password).
"""

from datetime import timedelta
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.api.v1.users.schemas import OAuthProviderEntry, UserInDB
from tests.utils import (
    generate_password_missing_digit,
    generate_password_missing_lowercase,
    generate_password_missing_uppercase,
    generate_test_password,
    generate_weak_password,
)


@pytest.mark.integration
class TestChangePassword:
    """Test suite for change password endpoint (authenticated, simplified)."""

    @pytest.mark.asyncio
    async def test_change_password_success(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """Test successful password change with the current password."""
        new_password = generate_test_password("ChangePassword")

        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={
                "current_password": registered_user["password"],
                "new_password": new_password,
            },
        )

        assert response.status_code == 200
        assert "successfully" in response.json()["message"].lower()

        # Verify we can login with new password
        login_response = await authenticated_client.post(
            "/api/v1/users/login",
            json={"email": registered_user["email"], "password": new_password},
        )
        assert login_response.status_code == 200

    @pytest.mark.asyncio
    async def test_change_password_weak_new_password(self, authenticated_client: AsyncClient):
        """Test password change fails with weak new password."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password", json={"new_password": generate_weak_password()}
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_change_password_without_auth(self, client: AsyncClient):
        """Test password change fails without authentication."""
        response = await client.put(
            "/api/v1/users/change-password",
            json={"new_password": generate_test_password("NoAuthChange")},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_change_password_same_as_current(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """Test password change with same password as current."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={
                "current_password": registered_user["password"],
                "new_password": registered_user["password"],
            },
        )

        # This should succeed (no business rule against it)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_change_password_missing_new_password(self, authenticated_client: AsyncClient):
        """Test password change fails with missing new_password field."""
        response = await authenticated_client.put("/api/v1/users/change-password", json={})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_change_password_no_uppercase(self, authenticated_client: AsyncClient):
        """Test password change fails when new password has no uppercase letter."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={"new_password": generate_password_missing_uppercase()},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_change_password_no_digit(self, authenticated_client: AsyncClient):
        """Test password change fails when new password has no digit."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={"new_password": generate_password_missing_digit()},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_change_password_no_lowercase(self, authenticated_client: AsyncClient):
        """Test password change fails when new password has no lowercase letter."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={"new_password": generate_password_missing_lowercase()},
        )
        assert response.status_code == 422


def _mock_email_service():
    """Return a patch context that mocks EmailService so no real vendor is needed."""
    mock_instance = AsyncMock()
    mock_instance.get_default_email_vendor = AsyncMock()
    mock_instance.send_password_recovery_email = AsyncMock()
    return patch(
        "app.api.v1.integrations.email_service.EmailService",
        return_value=mock_instance,
    )


@pytest.mark.integration
class TestPasswordReset:
    """Test suite for password reset request and confirmation endpoints."""

    @pytest.mark.asyncio
    async def test_password_reset_request_success(self, client: AsyncClient, registered_user: dict):
        """Test successful password reset request."""
        with _mock_email_service():
            response = await client.post(
                "/api/v1/users/reset-password-request", json={"email": registered_user["email"]}
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
                "/api/v1/users/reset-password-request", json={"email": "nonexistent@example.com"}
            )

        # Should return 200 for security (don't reveal if email exists)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_password_reset_request_invalid_email(self, client: AsyncClient):
        """Test password reset request with invalid email format."""
        response = await client.post(
            "/api/v1/users/reset-password-request", json={"email": "not-an-email"}
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_password_reset_request_missing_email(self, client: AsyncClient):
        """Test password reset request without email."""
        response = await client.post("/api/v1/users/reset-password-request", json={})

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_password_reset_request_no_email_vendor(
        self, client: AsyncClient, registered_user: dict
    ):
        """Test password reset request returns 503 when no email vendor is configured."""
        # No mock — no vendor in test DB → should get 503
        response = await client.post(
            "/api/v1/users/reset-password-request", json={"email": registered_user["email"]}
        )

        assert response.status_code == 503

    @pytest.mark.asyncio
    async def test_password_reset_confirm_success(self, client: AsyncClient, registered_user: dict):
        """Test successful password reset confirmation."""
        # Request password reset (mocked email)
        with _mock_email_service():
            reset_request = await client.post(
                "/api/v1/users/reset-password-request", json={"email": registered_user["email"]}
            )
        assert reset_request.status_code == 200

        # Retrieve the token from the database
        user = await UserInDB.find_one(UserInDB.email == registered_user["email"])
        reset_token = user.reset_token
        assert reset_token is not None

        # Now confirm with the token
        new_password = generate_test_password("ResetSuccess")
        response = await client.post(
            "/api/v1/users/reset-password-confirm",
            json={
                "email": registered_user["email"],
                "token": reset_token,
                "new_password": new_password,
            },
        )

        assert response.status_code == 200
        assert "successfully" in response.json()["message"].lower()

        # Verify we can login with new password
        login_response = await client.post(
            "/api/v1/users/login",
            json={"email": registered_user["email"], "password": new_password},
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
                "new_password": generate_test_password("InvalidTokenReset"),
            },
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
                "new_password": generate_test_password("ExpiredTokenReset"),
            },
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
                "/api/v1/users/reset-password-request", json={"email": registered_user["email"]}
            )

        user = await UserInDB.find_one(UserInDB.email == registered_user["email"])
        reset_token = user.reset_token

        # Try to confirm with weak password
        response = await client.post(
            "/api/v1/users/reset-password-confirm",
            json={
                "email": registered_user["email"],
                "token": reset_token,
                "new_password": generate_weak_password(),
            },
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
                "new_password": generate_test_password("MissingUserReset"),
            },
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
                "new_password": generate_test_password("MissingToken"),
            },
        )
        assert response.status_code == 422

        # Missing email
        response = await client.post(
            "/api/v1/users/reset-password-confirm",
            json={"token": "some-token", "new_password": generate_test_password("MissingEmail")},
        )
        assert response.status_code == 422

        # Missing new_password
        response = await client.post(
            "/api/v1/users/reset-password-confirm",
            json={"email": "test@example.com", "token": "some-token"},
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
                "/api/v1/users/reset-password-request", json={"email": registered_user["email"]}
            )

        user = await UserInDB.find_one(UserInDB.email == registered_user["email"])
        first_token = user.reset_token

        with _mock_email_service():
            # Second request — should invalidate the first token
            await client.post(
                "/api/v1/users/reset-password-request", json={"email": registered_user["email"]}
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
                "new_password": generate_test_password("StaleTokenReset"),
            },
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
            side_effect=HTTPException(
                status_code=500, detail="Error al enviar correo de recuperación"
            )
        )

        with patch(
            "app.api.v1.integrations.email_service.EmailService", return_value=mock_instance
        ):
            response = await client.post(
                "/api/v1/users/reset-password-request", json={"email": registered_user["email"]}
            )

        assert response.status_code == 500


@pytest.mark.integration
class TestChangePasswordConfirmation:
    """A bearer token alone must never be enough to set a password (C1)."""

    @pytest.mark.asyncio
    async def test_change_password_requires_current_password(
        self, authenticated_client: AsyncClient
    ):
        """Omitting current_password is rejected instead of silently succeeding."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={"new_password": generate_test_password("NoCurrent")},
        )

        assert response.status_code == 400
        assert "current password" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_change_password_rejects_wrong_current_password(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """A wrong current password is refused and the stored one is untouched."""
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={
                "current_password": generate_test_password("WrongCurrent"),
                "new_password": generate_test_password("ShouldNotApply"),
            },
        )

        assert response.status_code == 400
        assert "incorrect" in response.json()["detail"].lower()

        login = await authenticated_client.post(
            "/api/v1/users/login",
            json={"email": registered_user["email"], "password": registered_user["password"]},
        )
        assert login.status_code == 200


@pytest.mark.integration
class TestChangePasswordOAuthOnly:
    """OAuth-only accounts have no password to confirm, so the endpoint refuses them."""

    async def _make_oauth_only(self, email: str) -> UserInDB:
        """Turn a registered account into an OAuth-only one (placeholder hash)."""
        user = await UserInDB.find_one(UserInDB.email == email)
        user.oauth_providers = [
            OAuthProviderEntry(provider="google", provider_user_id="google-user-123")
        ]
        user.has_usable_password = False
        user.password_changed_at = None
        await user.save()
        return user

    @pytest.mark.asyncio
    async def test_oauth_only_account_cannot_change_password(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        await self._make_oauth_only(registered_user["email"])

        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={
                "current_password": generate_test_password("UnknownToOauthUser"),
                "new_password": generate_test_password("ShouldNotApply"),
            },
        )

        assert response.status_code == 403
        assert "linked provider" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_oauth_only_account_recovers_after_setting_a_password(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """After the reset flow stores a password, the account can change it again."""
        from app.api.v1.users.repository import UserRepository
        from app.core.security import get_password_hash

        user = await self._make_oauth_only(registered_user["email"])

        # Same path the reset flow uses — this also flips has_usable_password.
        recovered = generate_test_password("Recovered")
        await UserRepository().update_password(str(user.id), get_password_hash(recovered))

        # The password change invalidated the previous JWT, so log in again.
        login = await authenticated_client.post(
            "/api/v1/users/login",
            json={"email": registered_user["email"], "password": recovered},
        )
        assert login.status_code == 200
        authenticated_client.headers["Authorization"] = (
            f"Bearer {login.json()['access_token']}"
        )

        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={
                "current_password": recovered,
                "new_password": generate_test_password("Rotated"),
            },
        )

        assert response.status_code == 200


@pytest.mark.integration
class TestMePasswordSignals:
    """GET /users/me tells the UI whether the change-password form applies."""

    @pytest.mark.asyncio
    async def test_me_reports_password_capable_account(
        self, authenticated_client: AsyncClient
    ):
        response = await authenticated_client.get("/api/v1/users/me")

        assert response.status_code == 200
        data = response.json()
        assert data["can_change_password"] is True
        assert data["oauth_providers"] == []

    @pytest.mark.asyncio
    async def test_me_reports_oauth_only_account(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        user = await UserInDB.find_one(UserInDB.email == registered_user["email"])
        user.oauth_providers = [
            OAuthProviderEntry(provider="google", provider_user_id="google-user-456")
        ]
        user.has_usable_password = False
        user.password_changed_at = None
        await user.save()

        response = await authenticated_client.get("/api/v1/users/me")

        assert response.status_code == 200
        data = response.json()
        assert data["can_change_password"] is False
        assert data["oauth_providers"][0]["provider"] == "google"


@pytest.mark.integration
class TestLegacyLinkedAccounts:
    """Accounts created before 0.6.2 that linked a provider keep their password.

    Regression: those documents have no ``has_usable_password`` (it loads as the
    default True) and no ``password_changed_at``, so a predicate that inferred
    "OAuth-only" from the linked provider alone used to hide the password form
    and answer 403, forcing an unnecessary reset on a working password.
    """

    async def _make_legacy_linked(
        self, email: str, *, linked_at_creation: bool
    ) -> UserInDB:
        """Rebuild an account as a legacy document with a provider linked."""
        user = await UserInDB.find_one(UserInDB.email == email)
        # Legacy documents simply lack the field, so it loads as the default.
        assert user.has_usable_password is True

        user.oauth_providers = [
            OAuthProviderEntry(
                provider="google",
                provider_user_id="legacy-google-1",
                linked_at=(
                    user.created_at
                    if linked_at_creation
                    else user.created_at + timedelta(days=30)
                ),
            )
        ]
        user.password_changed_at = None
        await user.save()
        return user

    @pytest.mark.asyncio
    async def test_linked_password_account_keeps_the_form(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """The profile must not hide the form from a linked account."""
        await self._make_legacy_linked(registered_user["email"], linked_at_creation=False)

        response = await authenticated_client.get("/api/v1/users/me")

        assert response.status_code == 200
        assert response.json()["can_change_password"] is True

    @pytest.mark.asyncio
    async def test_linked_password_account_can_still_change_password(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """Its real password must be accepted, without a forced reset."""
        await self._make_legacy_linked(registered_user["email"], linked_at_creation=False)

        new_password = generate_test_password("LinkedLegacy")
        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={
                "current_password": registered_user["password"],
                "new_password": new_password,
            },
        )

        assert response.status_code == 200

        login = await authenticated_client.post(
            "/api/v1/users/login",
            json={"email": registered_user["email"], "password": new_password},
        )
        assert login.status_code == 200

    @pytest.mark.asyncio
    async def test_provider_linked_at_creation_still_reads_as_oauth_only(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """A legacy OAuth signup (provider linked at creation) stays OAuth-only."""
        await self._make_legacy_linked(registered_user["email"], linked_at_creation=True)

        me = await authenticated_client.get("/api/v1/users/me")
        assert me.status_code == 200
        assert me.json()["can_change_password"] is False

        response = await authenticated_client.put(
            "/api/v1/users/change-password",
            json={
                "current_password": generate_test_password("UnknownToOauth"),
                "new_password": generate_test_password("ShouldNotApply"),
            },
        )

        assert response.status_code == 403
