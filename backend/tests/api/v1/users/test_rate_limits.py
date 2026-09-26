"""
Integration tests for per-IP rate limiting on registration and password reset.

Both routes consult module-level limiter singletons, so these tests shrink the
configured budget with monkeypatch instead of firing the production number of
requests. The shipped numbers are pinned separately.
"""
from unittest.mock import AsyncMock, patch

import pytest
from faker import Faker
from httpx import AsyncClient

from app.api.v1.users.rate_limiter import (
    password_reset_rate_limiter,
    register_rate_limiter,
)
from tests.utils import generate_test_password

fake = Faker()


def _mock_email_service():
    """Patch EmailService so no real vendor is required."""
    mock_instance = AsyncMock()
    mock_instance.get_default_email_vendor = AsyncMock()
    mock_instance.send_password_recovery_email = AsyncMock()
    return patch(
        "app.api.v1.integrations.email_service.EmailService",
        return_value=mock_instance,
    )


def _registration_payload() -> dict:
    """Build a valid registration payload with a fresh email."""
    return {
        "email": fake.email(),
        "password": generate_test_password("RateLimit"),
        "full_name": fake.name(),
    }


@pytest.mark.integration
class TestRegistrationRateLimit:
    """POST /users/register is bounded per client IP."""

    @pytest.mark.asyncio
    async def test_registrations_are_throttled_per_ip(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ):
        """Beyond the budget the endpoint answers 429 with a Retry-After header."""
        monkeypatch.setattr(register_rate_limiter, "max_requests", 2)

        first = await client.post("/api/v1/users/register", json=_registration_payload())
        second = await client.post("/api/v1/users/register", json=_registration_payload())
        third = await client.post("/api/v1/users/register", json=_registration_payload())

        assert first.status_code == 201
        assert second.status_code == 201
        assert third.status_code == 429
        assert int(third.headers["Retry-After"]) >= 1

    def test_shipped_limit_is_pinned(self):
        """The production budget must not drift silently."""
        assert register_rate_limiter.max_requests == 20
        assert register_rate_limiter.window_seconds == 3600


@pytest.mark.integration
class TestPasswordResetRateLimit:
    """POST /users/reset-password-request is bounded per client IP."""

    @pytest.mark.asyncio
    async def test_reset_requests_are_throttled_per_ip(
        self,
        client: AsyncClient,
        registered_user: dict,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """The endpoint cannot be used repeatedly as an email bomb."""
        monkeypatch.setattr(password_reset_rate_limiter, "max_requests", 1)

        with _mock_email_service():
            first = await client.post(
                "/api/v1/users/reset-password-request",
                json={"email": registered_user["email"]},
            )
            second = await client.post(
                "/api/v1/users/reset-password-request",
                json={"email": registered_user["email"]},
            )

        assert first.status_code == 200
        assert second.status_code == 429
        assert int(second.headers["Retry-After"]) >= 1

    def test_shipped_limit_is_pinned(self):
        """The production budget must not drift silently."""
        assert password_reset_rate_limiter.max_requests == 10
        assert password_reset_rate_limiter.window_seconds == 3600
