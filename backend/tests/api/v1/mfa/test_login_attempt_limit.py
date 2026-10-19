"""
Integration tests for the per-token attempt limit of the MFA login step.

The temporary MFA token is a stateless JWT, so the limit lives server side.
Regression: the limit read an ``attempt_count`` claim that was always 0, so a
token accepted wrong codes until it expired and only the per-IP throttle
stood in the way. The token is also single use: after a successful sign-in it
can't be replayed to mint another access token.
"""

import asyncio
from unittest.mock import patch

import pyotp
import pytest
from httpx import AsyncClient

from app.api.v1.mfa.schemas import MfaTokenAttempt
from app.api.v1.mfa.services import MAX_MFA_TOKEN_ATTEMPTS
from app.api.v1.users.audit_log import AuditLogEntry
from app.core.security import create_mfa_temp_token

WRONG_CODE = "000000"


async def _enable_totp(client: AsyncClient) -> str:
    """Enable TOTP for the authenticated user and return its secret."""
    setup = await client.post("/api/v1/mfa/setup-totp")
    assert setup.status_code == 200
    secret = setup.json()["secret_key"]
    enable = await client.post(
        "/api/v1/mfa/enable-totp",
        json={"code": pyotp.TOTP(secret).now(), "set_as_default": True},
    )
    assert enable.status_code == 200
    return secret


async def _verify(client: AsyncClient, mfa_token: str, code: str, **extra) -> int:
    """Post one MFA verification and return the status code."""
    response = await client.post(
        "/api/v1/mfa/verify",
        json={"mfa_token": mfa_token, "code": code, "method": "totp", **extra},
    )
    return response.status_code


@pytest.mark.integration
class TestMfaLoginAttemptLimit:
    """A temporary MFA token stops accepting codes after the limit."""

    @pytest.mark.asyncio
    async def test_token_is_rejected_after_max_failed_attempts(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """After the limit, even the correct code is refused for that token."""
        secret = await _enable_totp(authenticated_client)
        authenticated_client.headers.pop("Authorization", None)
        token = create_mfa_temp_token(registered_user["email"], "totp", ["totp"])

        for _ in range(MAX_MFA_TOKEN_ATTEMPTS):
            assert await _verify(authenticated_client, token, WRONG_CODE) == 401

        assert await _verify(authenticated_client, token, pyotp.TOTP(secret).now()) == 401

        entries = await AuditLogEntry.find(
            AuditLogEntry.event == "login_failed",
            AuditLogEntry.details == "mfa_max_attempts",
        ).to_list()
        assert len(entries) == 1

    @pytest.mark.asyncio
    async def test_correct_code_before_the_limit_succeeds(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """Wrong codes below the limit don't block a later correct code."""
        secret = await _enable_totp(authenticated_client)
        authenticated_client.headers.pop("Authorization", None)
        token = create_mfa_temp_token(registered_user["email"], "totp", ["totp"])

        for _ in range(MAX_MFA_TOKEN_ATTEMPTS - 1):
            assert await _verify(authenticated_client, token, WRONG_CODE) == 401

        response = await authenticated_client.post(
            "/api/v1/mfa/verify",
            json={"mfa_token": token, "code": pyotp.TOTP(secret).now(), "method": "totp"},
        )
        assert response.status_code == 200
        assert response.json()["access_token"]

    @pytest.mark.asyncio
    async def test_wrong_recovery_codes_count_towards_the_limit(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """Recovery codes share the same per-token budget."""
        secret = await _enable_totp(authenticated_client)
        authenticated_client.headers.pop("Authorization", None)
        token = create_mfa_temp_token(registered_user["email"], "totp", ["totp"])

        for _ in range(MAX_MFA_TOKEN_ATTEMPTS):
            status = await _verify(authenticated_client, token, "WRONGCODE1", is_recovery_code=True)
            assert status == 401

        assert await _verify(authenticated_client, token, pyotp.TOTP(secret).now()) == 401

    @pytest.mark.asyncio
    async def test_limit_is_per_token(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """A new login (new token) starts with a fresh budget; the token is not stored."""
        secret = await _enable_totp(authenticated_client)
        authenticated_client.headers.pop("Authorization", None)
        exhausted = create_mfa_temp_token(registered_user["email"], "totp", ["totp"])
        for _ in range(MAX_MFA_TOKEN_ATTEMPTS):
            await _verify(authenticated_client, exhausted, WRONG_CODE)

        records = await MfaTokenAttempt.find_all().to_list()
        assert len(records) == 1
        assert exhausted not in records[0].token_hash

        # JWTs issued in the same second with the same claims are identical,
        # so vary the claims to get a distinct token for the "new login".
        fresh = create_mfa_temp_token(registered_user["email"], "totp", ["totp", "email"])
        assert await _verify(authenticated_client, fresh, pyotp.TOTP(secret).now()) == 200

    @pytest.mark.asyncio
    async def test_token_cannot_be_reused_after_success(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """A token that completed a sign-in is rejected on any later use."""
        secret = await _enable_totp(authenticated_client)
        authenticated_client.headers.pop("Authorization", None)
        token = create_mfa_temp_token(registered_user["email"], "totp", ["totp"])

        assert await _verify(authenticated_client, token, pyotp.TOTP(secret).now()) == 200
        assert await _verify(authenticated_client, token, pyotp.TOTP(secret).now()) == 401

        record = await MfaTokenAttempt.find_one()
        assert record is not None and record.consumed is True

    @pytest.mark.asyncio
    async def test_concurrent_wrong_codes_cannot_exceed_the_limit(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        """A concurrent burst gets at most the limit of code checks.

        The code check is slowed down so every request is in flight at the
        same time: a check-then-record design lets all of them through.
        """
        secret = await _enable_totp(authenticated_client)
        authenticated_client.headers.pop("Authorization", None)
        token = create_mfa_temp_token(registered_user["email"], "totp", ["totp"])

        checked = 0

        async def slow_wrong_check(self, user_id: str, code: str, mfa_method: str) -> bool:
            nonlocal checked
            checked += 1
            await asyncio.sleep(0.05)
            return False

        burst = MAX_MFA_TOKEN_ATTEMPTS + 4
        with patch("app.api.v1.mfa.services.MfaService.verify_mfa_code", new=slow_wrong_check):
            statuses = await asyncio.gather(
                *(_verify(authenticated_client, token, WRONG_CODE) for _ in range(burst))
            )

        assert all(code == 401 for code in statuses)
        assert checked == MAX_MFA_TOKEN_ATTEMPTS
        # The correct code is refused too: the budget is spent.
        assert await _verify(authenticated_client, token, pyotp.TOTP(secret).now()) == 401

    def test_shipped_limit_is_pinned(self):
        """The documented limit is five wrong codes per token."""
        assert MAX_MFA_TOKEN_ATTEMPTS == 5

    def test_tokens_issued_in_the_same_second_are_distinct(self):
        """Two logins in the same second get different tokens, so their state doesn't collide."""
        first = create_mfa_temp_token("user@example.com", "totp", ["totp"])
        second = create_mfa_temp_token("user@example.com", "totp", ["totp"])
        assert first != second
