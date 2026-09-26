"""
Integration tests for the MFA audit log entries.

Enabling and disabling a second factor are the account-security events a
reviewer looks for, so both must leave a trail with the method used.
"""
import pyotp
import pytest
from httpx import AsyncClient

from app.api.v1.users.audit_log import AuditLogEntry


@pytest.mark.integration
class TestMfaAuditEvents:
    """TOTP activation and deactivation write audit entries."""

    @pytest.mark.asyncio
    async def test_enabling_mfa_is_recorded(
        self, authenticated_client: AsyncClient
    ):
        """Completing TOTP activation writes mfa_enabled with the method."""
        setup = await authenticated_client.post("/api/v1/mfa/setup-totp")
        assert setup.status_code == 200
        secret = setup.json()["secret_key"]

        enable = await authenticated_client.post(
            "/api/v1/mfa/enable-totp",
            json={"code": pyotp.TOTP(secret).now(), "set_as_default": True},
        )
        assert enable.status_code == 200
        assert enable.json()["codes"]

        entries = await AuditLogEntry.find(
            AuditLogEntry.event == "mfa_enabled"
        ).to_list()
        assert len(entries) == 1
        assert entries[0].details == "method: totp"

    @pytest.mark.asyncio
    async def test_disabling_mfa_is_recorded(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """Removing a second factor writes mfa_disabled with the method."""
        setup = await authenticated_client.post("/api/v1/mfa/setup-totp")
        secret = setup.json()["secret_key"]
        enable = await authenticated_client.post(
            "/api/v1/mfa/enable-totp",
            json={"code": pyotp.TOTP(secret).now(), "set_as_default": True},
        )
        assert enable.status_code == 200

        disable = await authenticated_client.post(
            "/api/v1/mfa/disable",
            json={"password": registered_user["password"], "method": "totp"},
        )
        assert disable.status_code == 200

        entries = await AuditLogEntry.find(
            AuditLogEntry.event == "mfa_disabled"
        ).to_list()
        assert len(entries) == 1
        assert entries[0].details == "method: totp"
