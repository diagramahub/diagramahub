"""
Rate limiting and account lockout protection for the users module.

- IP-based rate limiting: login, registration and password reset requests.
- Account lockout: after M consecutive failed attempts for a given email,
  the account is temporarily locked for a configurable duration.

The sliding-window implementation lives in ``app/core/rate_limit.py`` and is
in-memory (resets on restart). A multi-instance deployment needs Redis.
"""
import time
from dataclasses import dataclass

from app.core.rate_limit import SlidingWindowRateLimiter


@dataclass
class AccountLockoutEntry:
    """Track failed login attempts for an email."""
    failed_count: int = 0
    locked_until: float = 0.0
    last_attempt: float = 0.0


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
login_rate_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=60)
account_lockout = AccountLockoutManager(max_failed_attempts=5, lockout_duration_seconds=900)

# Registration is open on a fresh install, so bound bulk account creation per IP.
# 20/hour leaves room for onboarding a team behind one address.
register_rate_limiter = SlidingWindowRateLimiter(max_requests=20, window_seconds=3600)

# Password reset requests send email, so bound them per IP to prevent using the
# endpoint as an email bomb.
password_reset_rate_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=3600)
