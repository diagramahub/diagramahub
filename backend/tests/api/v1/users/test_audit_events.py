"""
Integration tests for the audit log entries wired up in this release.

Covers password_reset_requested and account_deleted. The MFA enable/disable
events live next to their routes in ``tests/api/v1/mfa/test_audit_events.py``.
"""
from unittest.mock import AsyncMock, patch

import pytest
from faker import Faker
from httpx import AsyncClient

from app.api.v1.users.audit_log import AuditLogEntry
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
        "password": generate_test_password("Audit"),
        "full_name": fake.name(),
    }


@pytest.mark.integration
class TestPasswordResetRequestedAudit:
    """Requesting a password reset leaves a trail for SOC2-style review."""

    @pytest.mark.asyncio
    async def test_requesting_a_reset_is_recorded(
        self, client: AsyncClient, registered_user: dict
    ):
        with _mock_email_service():
            response = await client.post(
                "/api/v1/users/reset-password-request",
                json={"email": registered_user["email"]},
            )

        assert response.status_code == 200

        entries = await AuditLogEntry.find(
            AuditLogEntry.event == "password_reset_requested"
        ).to_list()
        assert len(entries) == 1
        assert entries[0].user_email == registered_user["email"]

    @pytest.mark.asyncio
    async def test_unknown_email_is_not_recorded(self, client: AsyncClient):
        """Anti-enumeration: nothing is written when the address does not exist."""
        with _mock_email_service():
            response = await client.post(
                "/api/v1/users/reset-password-request",
                json={"email": fake.email()},
            )

        assert response.status_code == 200
        assert await AuditLogEntry.find(
            AuditLogEntry.event == "password_reset_requested"
        ).count() == 0


@pytest.mark.integration
class TestAccountDeletedAudit:
    """Deleting an account records the event even though the user is gone."""

    @pytest.mark.asyncio
    async def test_deleting_an_account_is_recorded(self, client: AsyncClient):
        # The first registration becomes admin, and the only admin cannot be
        # deleted, so the account removed here is the second one.
        await client.post("/api/v1/users/register", json=_registration_payload())

        victim = _registration_payload()
        registered = await client.post("/api/v1/users/register", json=victim)
        assert registered.status_code == 201

        login = await client.post(
            "/api/v1/users/login",
            json={"email": victim["email"], "password": victim["password"]},
        )
        assert login.status_code == 200
        client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"

        response = await client.request(
            "DELETE",
            "/api/v1/users/me",
            json={"confirmation_phrase": "elimíname"},
        )
        assert response.status_code == 200

        entries = await AuditLogEntry.find(
            AuditLogEntry.event == "account_deleted"
        ).to_list()
        assert len(entries) == 1
        assert entries[0].user_email == victim["email"]
