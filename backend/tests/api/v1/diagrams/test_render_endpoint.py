"""
Unit tests for the POST /api/v1/diagrams/render endpoint.

Tests cover:
- Happy path: valid request returns SVG with correct content-type
- Validation: empty source rejected (422 from Pydantic min_length)
- Validation: unsupported diagram_type returns 400 with supported types list
- Error mapping: KrokiRenderError → HTTP 502
- Error mapping: KrokiTimeoutError → HTTP 504
- Public access: no authentication required
"""
import pytest
from unittest.mock import AsyncMock

from httpx import AsyncClient

from app.main import app
from app.api.v1.diagrams.kroki_client import (
    KrokiClient,
    KrokiRenderError,
    KrokiTimeoutError,
)
from app.api.v1.diagrams.routes import get_kroki_client


RENDER_URL = "/api/v1/diagrams/render"

SAMPLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><text>Hello</text></svg>'


@pytest.mark.unit
class TestRenderDiagramEndpoint:
    """Tests for the render_diagram endpoint."""

    @pytest.mark.asyncio
    async def test_render_valid_plantuml_returns_svg(self, client: AsyncClient):
        """Valid PlantUML request returns SVG with image/svg+xml content-type."""
        mock_client = AsyncMock()
        mock_client.render.return_value = SAMPLE_SVG

        app.dependency_overrides[get_kroki_client] = lambda: mock_client
        try:
            response = await client.post(
                RENDER_URL,
                json={
                    "source": "@startuml\nA -> B\n@enduml",
                    "diagram_type": "plantuml",
                },
            )
            assert response.status_code == 200
            assert "image/svg+xml" in response.headers["content-type"]
            assert response.text == SAMPLE_SVG
        finally:
            app.dependency_overrides.pop(get_kroki_client, None)

    @pytest.mark.asyncio
    async def test_render_valid_d2_returns_svg(self, client: AsyncClient):
        """Valid D2 request returns SVG."""
        mock_client = AsyncMock()
        mock_client.render.return_value = SAMPLE_SVG

        app.dependency_overrides[get_kroki_client] = lambda: mock_client
        try:
            response = await client.post(
                RENDER_URL,
                json={"source": "x -> y", "diagram_type": "d2"},
            )
            assert response.status_code == 200
            assert "image/svg+xml" in response.headers["content-type"]
        finally:
            app.dependency_overrides.pop(get_kroki_client, None)

    @pytest.mark.asyncio
    async def test_render_empty_source_returns_422(self, client: AsyncClient):
        """Empty source string is rejected by Pydantic validation (min_length=1)."""
        response = await client.post(
            RENDER_URL,
            json={"source": "", "diagram_type": "plantuml"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_render_missing_source_returns_422(self, client: AsyncClient):
        """Missing source field is rejected by Pydantic validation."""
        response = await client.post(
            RENDER_URL,
            json={"diagram_type": "plantuml"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_render_unsupported_type_returns_400(self, client: AsyncClient):
        """Unsupported diagram_type returns 400 with list of supported types."""
        response = await client.post(
            RENDER_URL,
            json={"source": "some code", "diagram_type": "unsupported_type"},
        )
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "unsupported_type" in detail
        assert "Tipos soportados:" in detail
        assert "plantuml" in detail
        assert "d2" in detail

    @pytest.mark.asyncio
    async def test_render_kroki_error_returns_502(self, client: AsyncClient):
        """KrokiRenderError maps to HTTP 502."""
        mock_client = AsyncMock()
        mock_client.render.side_effect = KrokiRenderError(
            status_code=400, detail="Syntax error in diagram"
        )

        app.dependency_overrides[get_kroki_client] = lambda: mock_client
        try:
            response = await client.post(
                RENDER_URL,
                json={"source": "bad code", "diagram_type": "plantuml"},
            )
            assert response.status_code == 502
            detail = response.json()["detail"]
            assert "400" in detail
            assert "Syntax error in diagram" in detail
        finally:
            app.dependency_overrides.pop(get_kroki_client, None)

    @pytest.mark.asyncio
    async def test_render_kroki_timeout_returns_504(self, client: AsyncClient):
        """KrokiTimeoutError maps to HTTP 504."""
        mock_client = AsyncMock()
        mock_client.render.side_effect = KrokiTimeoutError("Connection timed out")

        app.dependency_overrides[get_kroki_client] = lambda: mock_client
        try:
            response = await client.post(
                RENDER_URL,
                json={"source": "some code", "diagram_type": "plantuml"},
            )
            assert response.status_code == 504
            assert "no respondió a tiempo" in response.json()["detail"]
        finally:
            app.dependency_overrides.pop(get_kroki_client, None)

    @pytest.mark.asyncio
    async def test_render_no_auth_required(self, client: AsyncClient):
        """Endpoint is accessible without authentication."""
        mock_client = AsyncMock()
        mock_client.render.return_value = SAMPLE_SVG

        app.dependency_overrides[get_kroki_client] = lambda: mock_client
        try:
            response = await client.post(
                RENDER_URL,
                json={"source": "A -> B", "diagram_type": "plantuml"},
            )
            # Should NOT be 401/403
            assert response.status_code == 200
        finally:
            app.dependency_overrides.pop(get_kroki_client, None)

    @pytest.mark.asyncio
    async def test_render_all_supported_types_accepted(self, client: AsyncClient):
        """All types in SUPPORTED_DIAGRAM_TYPES are accepted."""
        mock_client = AsyncMock()
        mock_client.render.return_value = SAMPLE_SVG

        app.dependency_overrides[get_kroki_client] = lambda: mock_client
        try:
            for dtype in KrokiClient.SUPPORTED_DIAGRAM_TYPES:
                response = await client.post(
                    RENDER_URL,
                    json={"source": "test", "diagram_type": dtype},
                )
                assert response.status_code == 200, (
                    f"Type '{dtype}' should be accepted but got {response.status_code}"
                )
        finally:
            app.dependency_overrides.pop(get_kroki_client, None)
