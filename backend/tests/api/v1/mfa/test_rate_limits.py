"""
Integration tests for rate limiting on MFA verification.

A six-digit code is guessable, so attempts must be bounded even for a caller
holding a valid temporary MFA token.
"""
import pytest
from httpx import AsyncClient

from app.api.v1.mfa.rate_limiter import mfa_verify_rate_limiter
from tests.utils import generate_test_token


@pytest.mark.integration
class TestMfaVerifyRateLimit:
    """POST /mfa/verify is bounded per client IP."""

    @pytest.mark.asyncio
    async def test_verify_attempts_are_throttled_per_ip(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ):
        """Attempts pass the limiter first, then answer 429 with Retry-After."""
        monkeypatch.setattr(mfa_verify_rate_limiter, "max_requests", 2)

        payload = {"mfa_token": generate_test_token("mfa"), "code": "123456"}

        first = await client.post("/api/v1/mfa/verify", json=payload)
        second = await client.post("/api/v1/mfa/verify", json=payload)
        third = await client.post("/api/v1/mfa/verify", json=payload)

        # The temporary token is invalid, so the first two fail on decoding.
        assert first.status_code == 401
        assert second.status_code == 401
        # The third never reaches the decoder: the IP budget is spent.
        assert third.status_code == 429
        assert int(third.headers["Retry-After"]) >= 1

    def test_shipped_limit_is_pinned(self):
        """The production budget must not drift silently."""
        assert mfa_verify_rate_limiter.max_requests == 10
        assert mfa_verify_rate_limiter.window_seconds == 300
