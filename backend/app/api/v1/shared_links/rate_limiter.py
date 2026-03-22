"""
In-memory rate limiter with sliding window per IP.
Injected as a FastAPI dependency in public shared link routes.
"""
import time


class InMemoryRateLimiter:
    """Rate limiter basado en ventana deslizante por IP."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = {}

    def is_allowed(self, ip: str) -> bool:
        """Verifica si la IP puede hacer otra solicitud."""
        now = time.monotonic()
        cutoff = now - self.window_seconds

        if ip in self.requests:
            # Filter out expired timestamps
            self.requests[ip] = [t for t in self.requests[ip] if t > cutoff]
        else:
            self.requests[ip] = []

        if len(self.requests[ip]) >= self.max_requests:
            return False

        self.requests[ip].append(now)
        return True

    def cleanup(self):
        """Limpia entradas expiradas."""
        now = time.monotonic()
        cutoff = now - self.window_seconds
        expired_ips = []

        for ip, timestamps in self.requests.items():
            self.requests[ip] = [t for t in timestamps if t > cutoff]
            if not self.requests[ip]:
                expired_ips.append(ip)

        for ip in expired_ips:
            del self.requests[ip]
