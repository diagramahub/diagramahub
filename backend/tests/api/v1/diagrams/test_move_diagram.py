"""Integration tests for moving diagrams between projects."""

import pytest
from httpx import AsyncClient


@pytest.mark.integration
@pytest.mark.asyncio
async def test_move_diagram_moves_it_to_target_project_root(
    authenticated_client: AsyncClient,
) -> None:
    """A user can move a diagram between owned projects and clears its folder."""
    source_response = await authenticated_client.post(
        "/api/v1/projects",
        json={"name": "Source project", "emoji": "📁"},
    )
    assert source_response.status_code == 201
    source_project = source_response.json()

    target_response = await authenticated_client.post(
        "/api/v1/projects",
        json={"name": "Target project", "emoji": "🚀"},
    )
    assert target_response.status_code == 201
    target_project = target_response.json()

    folder_response = await authenticated_client.post(
        f"/api/v1/projects/{source_project['id']}/folders",
        json={"name": "Source folder", "color": "#3B82F6"},
    )
    assert folder_response.status_code == 201
    source_folder = folder_response.json()

    diagram_response = await authenticated_client.post(
        f"/api/v1/projects/{source_project['id']}/diagrams",
        json={
            "title": "Diagram to move",
            "content": "graph TD\n  A --> B",
            "diagram_type": "mermaid",
            "folder_id": source_folder["id"],
        },
    )
    assert diagram_response.status_code == 201
    diagram = diagram_response.json()

    response = await authenticated_client.post(
        f"/api/v1/diagrams/{diagram['id']}/move",
        json={"target_project_id": target_project["id"]},
    )

    assert response.status_code == 200
    moved_diagram = response.json()
    assert moved_diagram["project_id"] == target_project["id"]
    assert moved_diagram["folder_id"] is None

    source_with_diagrams = await authenticated_client.get(
        f"/api/v1/projects/{source_project['id']}"
    )
    assert source_with_diagrams.status_code == 200
    assert source_with_diagrams.json()["folders"][0]["diagrams"] == []

    target_with_diagrams = await authenticated_client.get(
        f"/api/v1/projects/{target_project['id']}"
    )
    assert target_with_diagrams.status_code == 200
    assert [item["id"] for item in target_with_diagrams.json()["diagrams"]] == [diagram["id"]]
