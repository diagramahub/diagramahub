"""
Login rate limiter and account lockout protection.

- IP-based rate limiting: max N login attempts per IP per window.
- Account lockout: after M consecutive failed attempts for a given email,
  the account is temporarily locked for a configurable duration.

Uses in-memory storage (resets on restart). For multi-instance deployments,
replace with Redis-backed storage.
"""
import time
from dataclasses import dataclass, field


@dataclass
class AccountLockoutEntry:
    """Track failed login attempts for an email."""
    failed_count: int = 0
    locked_until: float = 0.0
    last_attempt: float = 0.0


class LoginRateLimiter:
    """IP-based rate limiter with sliding window for login endpoints."""

    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        """
        Args:
            max_requests: Maximum login attempts per IP per window.
            window_seconds: Sliding window duration in seconds.
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = {}

    def is_allowed(self, ip: str) -> tuple[bool, int]:
        """Check if the IP can make another login attempt.

        Returns:
            Tuple of (allowed, retry_after_seconds).
        """
        now = time.monotonic()
        cutoff = now - self.window_seconds

        if ip in self._requests:
            self._requests[ip] = [t for t in self._requests[ip] if t > cutoff]
        else:
            self._requests[ip] = []

        if len(self._requests[ip]) >= self.max_requests:
            oldest = self._requests[ip][0]
            retry_after = int(oldest + self.window_seconds - now) + 1
            return False, max(retry_after, 1)

        self._requests[ip].append(now)
        return True, 0


class AccountLockoutManager:
    """Track failed login attempts per email and lock accounts temporarily."""

    def __init__(
        self,
        max_failed_attempts: int = 5,
        lockout_duration_seconds: int = 900,  # 15 minutes
    ):
        """
        Args:
            max_failed_attempts: Lock after this many consecutive failures.
            lockout_duration_seconds: How long the account stays locked.
        """
        self.max_failed_attempts = max_failed_attempts
        self.lockout_duration = lockout_duration_seconds
        self._accounts: dict[str, AccountLockoutEntry] = {}

    def is_locked(self, email: str) -> tuple[bool, int]:
        """Check if an account is currently locked.

        Returns:
            Tuple of (is_locked, remaining_seconds).
        """
        entry = self._accounts.get(email)
        if not entry:
            return False, 0

        now = time.time()
        if entry.locked_until > now:
            remaining = int(entry.locked_until - now) + 1
            return True, remaining

        return False, 0

    def record_failed_attempt(self, email: str) -> tuple[bool, int]:
        """Record a failed login attempt. Returns lockout status.

        Returns:
            Tuple of (now_locked, lockout_seconds).
        """
        email_lower = email.lower()
        now = time.time()

        if email_lower not in self._accounts:
            self._accounts[email_lower] = AccountLockoutEntry()

        entry = self._accounts[email_lower]

        # If previously locked but lock expired, reset
        if entry.locked_until > 0 and entry.locked_until <= now:
            entry.failed_count = 0
            entry.locked_until = 0.0

        entry.failed_count += 1
        entry.last_attempt = now

        if entry.failed_count >= self.max_failed_attempts:
            entry.locked_until = now + self.lockout_duration
            return True, self.lockout_duration

        return False, 0

    def record_successful_login(self, email: str) -> None:
        """Reset failed attempt counter on successful login."""
        email_lower = email.lower()
        if email_lower in self._accounts:
            del self._accounts[email_lower]

    def get_remaining_attempts(self, email: str) -> int:
        """Get how many attempts remain before lockout."""
        entry = self._accounts.get(email.lower())
        if not entry:
            return self.max_failed_attempts
        return max(0, self.max_failed_attempts - entry.failed_count)


# Singleton instances
login_rate_limiter = LoginRateLimiter(max_requests=10, window_seconds=60)
account_lockout = AccountLockoutManager(max_failed_attempts=5, lockout_duration_seconds=900)
