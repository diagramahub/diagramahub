"""
Tests for client IP resolution behind a reverse proxy.

``get_client_ip`` relies on uvicorn's proxy-headers middleware (enabled in
``start.sh`` with ``--forwarded-allow-ips``): ``X-Forwarded-For`` must only be
honoured when the TCP peer is a trusted proxy, so clients cannot spoof the IP
used by rate limits, lockout and the audit log.
"""

from types import SimpleNamespace

import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.core.client_ip import UNKNOWN_CLIENT_IP, get_client_ip

TRUSTED_PROXY = "172.18.0.1"


def _app(trusted_hosts: str) -> ProxyHeadersMiddleware:
    """Build a tiny app that echoes ``get_client_ip`` behind the proxy middleware."""
    app = FastAPI()

    @app.get("/ip")
    async def ip(request: Request) -> dict[str, str]:
        return {"ip": get_client_ip(request)}

    return ProxyHeadersMiddleware(app, trusted_hosts=trusted_hosts)


async def _get_ip(app: ProxyHeadersMiddleware, peer: str, headers: dict[str, str]) -> str:
    """Request ``/ip`` as if the TCP connection came from ``peer``."""
    transport = ASGITransport(app=app, client=(peer, 50000))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/ip", headers=headers)
    return response.json()["ip"]


@pytest.mark.unit
class TestGetClientIp:
    """Direct resolution from ``request.client``."""

    def test_returns_peer_address(self):
        """Without a proxy the TCP peer is the client."""
        request = SimpleNamespace(client=SimpleNamespace(host="203.0.113.7"))
        assert get_client_ip(request) == "203.0.113.7"

    def test_unknown_without_client(self):
        """Requests without connection info get a stable placeholder."""
        assert get_client_ip(SimpleNamespace(client=None)) == UNKNOWN_CLIENT_IP


@pytest.mark.unit
class TestBehindProxy:
    """``X-Forwarded-For`` is trusted only from configured proxies."""

    async def test_trusted_proxy_forwards_client_ip(self):
        """A trusted proxy's forwarded address becomes the client IP."""
        ip = await _get_ip(_app(TRUSTED_PROXY), TRUSTED_PROXY, {"X-Forwarded-For": "198.51.100.20"})
        assert ip == "198.51.100.20"

    async def test_cidr_network_is_trusted(self):
        """``FORWARDED_ALLOW_IPS`` accepts networks such as a Docker bridge."""
        ip = await _get_ip(
            _app("172.16.0.0/12"), TRUSTED_PROXY, {"X-Forwarded-For": "198.51.100.20"}
        )
        assert ip == "198.51.100.20"

    async def test_untrusted_peer_cannot_spoof(self):
        """A direct client sending the header keeps its own address."""
        ip = await _get_ip(_app(TRUSTED_PROXY), "203.0.113.7", {"X-Forwarded-For": "198.51.100.20"})
        assert ip == "203.0.113.7"

    async def test_default_trusts_only_localhost(self):
        """With the default setting a proxy on another host is not trusted."""
        ip = await _get_ip(
            _app("127.0.0.1,::1"), TRUSTED_PROXY, {"X-Forwarded-For": "198.51.100.20"}
        )
        assert ip == TRUSTED_PROXY
