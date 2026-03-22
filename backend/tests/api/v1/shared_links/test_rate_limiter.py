"""
Tests for InMemoryRateLimiter.
"""
import time
from unittest.mock import patch

import pytest

from app.api.v1.shared_links.rate_limiter import InMemoryRateLimiter


class TestInMemoryRateLimiter:
    """Unit tests for InMemoryRateLimiter."""

    def test_allows_requests_under_limit(self):
        limiter = InMemoryRateLimiter(max_requests=5, window_seconds=60)
        for _ in range(5):
            assert limiter.is_allowed("192.168.1.1") is True

    def test_blocks_requests_over_limit(self):
        limiter = InMemoryRateLimiter(max_requests=3, window_seconds=60)
        for _ in range(3):
            assert limiter.is_allowed("10.0.0.1") is True
        assert limiter.is_allowed("10.0.0.1") is False

    def test_different_ips_are_independent(self):
        limiter = InMemoryRateLimiter(max_requests=2, window_seconds=60)
        assert limiter.is_allowed("10.0.0.1") is True
        assert limiter.is_allowed("10.0.0.1") is True
        assert limiter.is_allowed("10.0.0.1") is False
        # Different IP should still be allowed
        assert limiter.is_allowed("10.0.0.2") is True

    def test_default_config(self):
        limiter = InMemoryRateLimiter()
        assert limiter.max_requests == 60
        assert limiter.window_seconds == 60

    def test_sliding_window_expires_old_requests(self):
        limiter = InMemoryRateLimiter(max_requests=2, window_seconds=1)
        assert limiter.is_allowed("10.0.0.1") is True
        assert limiter.is_allowed("10.0.0.1") is True
        assert limiter.is_allowed("10.0.0.1") is False
        # Wait for window to expire
        time.sleep(1.1)
        assert limiter.is_allowed("10.0.0.1") is True

    def test_cleanup_removes_expired_entries(self):
        limiter = InMemoryRateLimiter(max_requests=5, window_seconds=1)
        limiter.is_allowed("10.0.0.1")
        limiter.is_allowed("10.0.0.2")
        assert len(limiter.requests) == 2
        time.sleep(1.1)
        limiter.cleanup()
        assert len(limiter.requests) == 0

    def test_cleanup_keeps_active_entries(self):
        limiter = InMemoryRateLimiter(max_requests=5, window_seconds=60)
        limiter.is_allowed("10.0.0.1")
        limiter.cleanup()
        assert "10.0.0.1" in limiter.requests
        assert len(limiter.requests["10.0.0.1"]) == 1

    def test_first_request_from_new_ip_always_allowed(self):
        limiter = InMemoryRateLimiter(max_requests=1, window_seconds=60)
        assert limiter.is_allowed("new-ip") is True
