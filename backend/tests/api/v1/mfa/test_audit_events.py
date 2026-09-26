"""
Integration tests for the MFA audit log entries.

Enabling and disabling a second factor are the account-security events a
reviewer looks for, so both must leave a trail with the method used.
"""
import pyotp
import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch

from app.api.v1.users.audit_log import AuditLogEntry
from app.api.v1.users.schemas import RecoveryCodeEntry, UserInDB


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


@pytest.mark.integration
class TestSecondMethodAuditTrail:
    """Adding a second MFA method must be audited even without new codes.

    Regression: the audit write sat after the early return taken when the
    service issues no recovery codes, so activating a second method left no
    entry despite the repository invariant.
    """

    @pytest.mark.asyncio
    async def test_adding_totp_when_codes_already_exist_is_recorded(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """Unused recovery codes already present (another method enabled)."""
        user = await UserInDB.find_one(UserInDB.email == registered_user["email"])
        user.recovery_codes = [RecoveryCodeEntry(hash="seeded-unused-code", used=False)]
        await user.save()

        setup = await authenticated_client.post("/api/v1/mfa/setup-totp")
        secret = setup.json()["secret_key"]
        enable = await authenticated_client.post(
            "/api/v1/mfa/enable-totp",
            json={"code": pyotp.TOTP(secret).now(), "set_as_default": True},
        )

        assert enable.status_code == 200
        # No new codes are issued for a second method...
        assert enable.json()["codes"] is None
        # ...but the activation is still recorded.
        entries = await AuditLogEntry.find(
            AuditLogEntry.event == "mfa_enabled"
        ).to_list()
        assert len(entries) == 1
        assert entries[0].details == "method: totp"

    @pytest.mark.asyncio
    async def test_adding_email_mfa_after_totp_is_recorded(
        self, authenticated_client: AsyncClient
    ):
        """The email activation route shares the ordering rule."""
        setup = await authenticated_client.post("/api/v1/mfa/setup-totp")
        secret = setup.json()["secret_key"]
        first = await authenticated_client.post(
            "/api/v1/mfa/enable-totp",
            json={"code": pyotp.TOTP(secret).now(), "set_as_default": True},
        )
        assert first.status_code == 200
        assert first.json()["codes"]  # the first method issues the codes

        with patch(
            "app.api.v1.mfa.routes._send_mfa_email", new=AsyncMock()
        ) as send_email:
            start = await authenticated_client.post("/api/v1/mfa/enable-email")
        assert start.status_code == 200
        emailed_code = send_email.await_args.args[1]

        activated = await authenticated_client.post(
            "/api/v1/mfa/verify-email-activation", json={"code": emailed_code}
        )

        assert activated.status_code == 200
        assert activated.json()["codes"] is None
        entries = await AuditLogEntry.find(
            AuditLogEntry.event == "mfa_enabled",
            AuditLogEntry.details == "method: email",
        ).to_list()
        assert len(entries) == 1
