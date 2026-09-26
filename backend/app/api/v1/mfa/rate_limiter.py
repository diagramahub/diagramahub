"""Rate limiting for MFA verification.

A six-digit code is guessable, so brute forcing the second factor has to be
expensive even for a caller who already holds a valid temporary MFA token.
"""
from app.core.rate_limit import SlidingWindowRateLimiter

# 10 verification attempts per IP per 5 minutes.
mfa_verify_rate_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=300)
