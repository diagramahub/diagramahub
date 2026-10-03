"""Shared in-memory sliding-window rate limiter.

Modules that need per-IP abuse protection keep their own limiter instances
(``users/rate_limiter.py``, ``mfa/rate_limiter.py``, ``diagrams/rate_limiter.py``)
but share this implementation, so the window logic lives in one place.

Storage is in-process on purpose: a self-hosted Diagramahub runs a single
backend process. A multi-instance deployment would need a Redis-backed store,
otherwise every replica enforces its own counters.
"""
import time


class SlidingWindowRateLimiter:
    """Per-key sliding-window rate limiter (in-memory)."""

    def __init__(self, max_requests: int, window_seconds: int):
        """
        Args:
            max_requests: Maximum requests per key per window.
            window_seconds: Sliding window duration in seconds.
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = {}
        self._last_sweep = time.monotonic()

    def is_allowed(self, key: str) -> tuple[bool, int]:
        """Register a request for ``key`` and report whether it is allowed.

        Args:
            key: Bucket identifier, normally the client IP.

        Returns:
            Tuple of (allowed, retry_after_seconds).
        """
        now = time.monotonic()
        cutoff = now - self.window_seconds
        self._sweep(now, cutoff)

        if key in self._requests:
            self._requests[key] = [t for t in self._requests[key] if t > cutoff]
        else:
            self._requests[key] = []

        if len(self._requests[key]) >= self.max_requests:
            oldest = self._requests[key][0]
            retry_after = int(oldest + self.window_seconds - now) + 1
            return False, max(retry_after, 1)

        self._requests[key].append(now)
        return True, 0

    def _sweep(self, now: float, cutoff: float) -> None:
        """Drop keys with no request inside the window, at most once per window.

        Without it every key ever seen (e.g. each client IP) kept its entry
        forever, so memory grew without bound under rotating IPs. Amortised:
        one pass over the keys per ``window_seconds``.
        """
        if now - self._last_sweep < self.window_seconds:
            return
        self._last_sweep = now
        stale = [
            key for key, stamps in self._requests.items() if not stamps or stamps[-1] <= cutoff
        ]
        for key in stale:
            del self._requests[key]

    def reset(self) -> None:
        """Clear every counter. Used by tests to isolate rate-limit state."""
        self._requests.clear()
