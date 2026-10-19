"""Client IP resolution shared by rate limiters, lockout and audit logging.

The backend never parses ``X-Forwarded-For`` itself. uvicorn's proxy-headers
middleware (enabled in ``start.sh`` for uvicorn and gunicorn) rewrites
``request.client`` with the forwarded address, but only when the TCP peer is
listed in ``FORWARDED_ALLOW_IPS``. Any other peer keeps its own address, so a
client cannot spoof its IP by sending the header directly.
"""

from fastapi import Request

UNKNOWN_CLIENT_IP = "unknown"


def get_client_ip(request: Request) -> str:
    """Return the client IP for ``request``.

    Args:
        request: Incoming request.

    Returns:
        The client address resolved by uvicorn (the real client when the request
        came through a trusted proxy), or ``"unknown"`` when there is none.
    """
    return request.client.host if request.client else UNKNOWN_CLIENT_IP
