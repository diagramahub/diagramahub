"""
Unit tests for the shared sliding-window rate limiter.

This primitive backs the per-IP abuse protection used by login, registration,
password reset, MFA verification and public diagram rendering.
"""
import pytest

from app.core.rate_limit import SlidingWindowRateLimiter


@pytest.mark.unit
class TestSlidingWindowRateLimiter:
    """Window accounting, key isolation and reset behaviour."""

    def test_allows_requests_up_to_the_limit(self):
        """Requests within the budget are allowed and report no retry delay."""
        limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=60)

        for _ in range(3):
            allowed, retry_after = limiter.is_allowed("10.0.0.1")
            assert allowed is True
            assert retry_after == 0

    def test_blocks_once_the_budget_is_spent(self):
        """The request after the limit is refused with a positive retry delay."""
        limiter = SlidingWindowRateLimiter(max_requests=2, window_seconds=60)
        limiter.is_allowed("10.0.0.1")
        limiter.is_allowed("10.0.0.1")

        allowed, retry_after = limiter.is_allowed("10.0.0.1")

        assert allowed is False
        assert retry_after >= 1

    def test_keys_have_independent_budgets(self):
        """Exhausting one IP must not consume another IP's budget."""
        limiter = SlidingWindowRateLimiter(max_requests=1, window_seconds=60)
        assert limiter.is_allowed("10.0.0.1")[0] is True

        assert limiter.is_allowed("10.0.0.2")[0] is True
        assert limiter.is_allowed("10.0.0.1")[0] is False

    def test_entries_leave_the_window_when_they_expire(self):
        """A request older than the window frees its slot."""
        limiter = SlidingWindowRateLimiter(max_requests=1, window_seconds=60)
        assert limiter.is_allowed("10.0.0.1")[0] is True

        # Age the recorded timestamp instead of sleeping through the window.
        limiter._requests["10.0.0.1"] = [
            t - 61 for t in limiter._requests["10.0.0.1"]
        ]

        assert limiter.is_allowed("10.0.0.1")[0] is True

    def test_reset_clears_every_counter(self):
        """reset() restores a clean slate for every key."""
        limiter = SlidingWindowRateLimiter(max_requests=1, window_seconds=60)
        limiter.is_allowed("10.0.0.1")
        assert limiter.is_allowed("10.0.0.1")[0] is False

        limiter.reset()

        assert limiter.is_allowed("10.0.0.1")[0] is True


def test_idle_keys_are_dropped_once_their_window_has_passed(monkeypatch) -> None:  # noqa: ANN001
    """Keys seen once (e.g. rotating client IPs) must not accumulate forever."""
    from app.core import rate_limit

    clock = {"now": 1000.0}
    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: clock["now"])
    limiter = rate_limit.SlidingWindowRateLimiter(max_requests=3, window_seconds=60)

    for i in range(500):
        limiter.is_allowed(f"10.0.{i // 250}.{i % 250}")
    assert len(limiter._requests) == 500

    clock["now"] += 61  # every one of those keys is now idle
    limiter.is_allowed("10.9.9.9")

    assert list(limiter._requests) == ["10.9.9.9"]


def test_active_keys_keep_their_history_through_a_sweep(monkeypatch) -> None:  # noqa: ANN001
    from app.core import rate_limit

    clock = {"now": 1000.0}
    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: clock["now"])
    limiter = rate_limit.SlidingWindowRateLimiter(max_requests=2, window_seconds=60)

    limiter.is_allowed("busy")
    clock["now"] += 50
    limiter.is_allowed("busy")
    clock["now"] += 20  # sweep runs; "busy" still has one request inside the window

    assert limiter.is_allowed("busy") == (True, 0)
    assert limiter.is_allowed("busy")[0] is False
