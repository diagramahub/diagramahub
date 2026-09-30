"""Tests for the global request body size limit (413)."""

import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.request_limits import BodySizeLimitMiddleware

LIMIT = 1024


def _app() -> FastAPI:
    """Minimal app with the limit in front of an echo endpoint."""
    app = FastAPI()
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=LIMIT)

    @app.post("/echo")
    async def echo(request: Request) -> dict:
        return {"size": len(await request.body())}

    return app


async def _client(app: FastAPI) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.unit
async def test_body_within_limit_passes() -> None:
    async with await _client(_app()) as client:
        response = await client.post("/echo", content=b"x" * LIMIT)
    assert response.status_code == 200
    assert response.json() == {"size": LIMIT}


@pytest.mark.unit
async def test_declared_content_length_over_limit_is_rejected_before_reading() -> None:
    async with await _client(_app()) as client:
        response = await client.post("/echo", content=b"x" * (LIMIT + 1))
    assert response.status_code == 413
    assert "detail" in response.json()


@pytest.mark.unit
async def test_chunked_body_over_limit_is_rejected_while_streaming() -> None:
    """Without Content-Length the middleware still counts the received bytes."""

    async def chunks():
        for _ in range(4):
            yield b"x" * (LIMIT // 2)

    async with await _client(_app()) as client:
        response = await client.post("/echo", content=chunks())
    assert response.status_code == 413


@pytest.mark.unit
async def test_invalid_content_length_is_a_400() -> None:
    async with await _client(_app()) as client:
        response = await client.post("/echo", content=b"{}", headers={"content-length": "abc"})
    assert response.status_code == 400


@pytest.mark.integration
async def test_real_app_rejects_oversized_body_with_cors_headers(client: AsyncClient) -> None:
    """Wired into the real app: 413 keeps CORS headers so the browser can read it."""
    origin = settings.cors_origins[0]
    response = await client.post(
        "/api/v1/users/login",
        content=b"x" * (settings.MAX_REQUEST_BODY_BYTES + 1),
        headers={"Content-Type": "application/json", "Origin": origin},
    )
    assert response.status_code == 413
    assert response.headers.get("access-control-allow-origin") == origin
