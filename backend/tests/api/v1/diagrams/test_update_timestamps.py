"""updated_at reflects edits, not viewing: viewport/UI-preference saves keep it."""

import pytest
from httpx import AsyncClient


async def _diagram(client: AsyncClient) -> dict:
    project = (await client.post("/api/v1/projects", json={"name": "P", "emoji": "📁"})).json()
    response = await client.post(
        f"/api/v1/projects/{project['id']}/diagrams",
        json={"title": "D", "content": "graph TD\n  A-->B", "diagram_type": "mermaid"},
    )
    assert response.status_code == 201
    # Re-read so timestamps carry MongoDB's millisecond precision.
    return (await client.get(f"/api/v1/diagrams/{response.json()['id']}")).json()


@pytest.mark.integration
async def test_viewport_and_preferences_update_keeps_updated_at(
    authenticated_client: AsyncClient,
) -> None:
    """Panning/zooming or resizing panels is not an edit (dashboard Recent order)."""
    diagram = await _diagram(authenticated_client)

    response = await authenticated_client.put(
        f"/api/v1/diagrams/{diagram['id']}",
        json={
            "viewport_zoom": 1.5,
            "viewport_x": -120,
            "viewport_y": 40,
            "user_preferences": {"chat_panel_width": 480},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["viewport_zoom"] == 1.5
    assert body["user_preferences"]["chat_panel_width"] == 480
    assert body["updated_at"] == diagram["updated_at"]


@pytest.mark.integration
async def test_content_update_bumps_updated_at(authenticated_client: AsyncClient) -> None:
    """A real edit (even alongside viewport fields) still moves updated_at."""
    diagram = await _diagram(authenticated_client)

    response = await authenticated_client.put(
        f"/api/v1/diagrams/{diagram['id']}",
        json={"content": "graph TD\n  A-->C", "viewport_zoom": 2},
    )

    assert response.status_code == 200
    assert response.json()["updated_at"] > diagram["updated_at"]


@pytest.mark.integration
async def test_full_autosave_payload_without_real_changes_keeps_updated_at(
    authenticated_client: AsyncClient,
) -> None:
    """The editor always sends the full payload; unchanged content must not bump."""
    diagram = await _diagram(authenticated_client)

    response = await authenticated_client.put(
        f"/api/v1/diagrams/{diagram['id']}",
        json={
            "title": diagram["title"],
            "content": diagram["content"],
            "description": diagram["description"],
            "config": diagram["config"],
            "folder_id": diagram["folder_id"],
            "user_preferences": {"description_pinned": True},
            "viewport_zoom": 0.8,
        },
    )

    assert response.status_code == 200
    assert response.json()["user_preferences"]["description_pinned"] is True
    assert response.json()["updated_at"] == diagram["updated_at"]
