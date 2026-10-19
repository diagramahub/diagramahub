"""
Rate limiting of the public shared-link endpoints.

They use the shared sliding-window limiter (which sweeps idle IPs, so memory
stays bounded) and answer 429 with ``Retry-After`` once the budget is spent.
"""

import pytest

from app.api.v1.shared_links.public_routes import get_rate_limiter
from app.core.rate_limit import SlidingWindowRateLimiter


@pytest.mark.unit
def test_uses_shared_sliding_window_limiter():
    """The public routes use the core limiter with 60 requests per minute."""
    limiter = get_rate_limiter()
    assert isinstance(limiter, SlidingWindowRateLimiter)
    assert limiter.max_requests == 60
    assert limiter.window_seconds == 60


@pytest.mark.integration
async def test_returns_429_with_retry_after(client, monkeypatch):
    """Once the per-IP budget is spent the endpoint answers 429 + Retry-After."""
    monkeypatch.setattr(get_rate_limiter(), "max_requests", 2)

    for _ in range(2):
        response = await client.get("/api/v1/shared/unknown-token/info")
        assert response.status_code != 429

    response = await client.get("/api/v1/shared/unknown-token/info")

    assert response.status_code == 429
    assert int(response.headers["Retry-After"]) >= 1
