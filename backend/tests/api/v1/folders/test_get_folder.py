"""Integration tests for reading a folder with its diagrams."""

import pytest
from httpx import AsyncClient


async def _create_project_with_folder(client: AsyncClient) -> tuple[dict, dict]:
    """Create a project and a folder inside it, returning both payloads."""
    project_response = await client.post(
        "/api/v1/projects", json={"name": "Folder project", "emoji": "📁"}
    )
    assert project_response.status_code == 201
    project = project_response.json()

    folder_response = await client.post(
        f"/api/v1/projects/{project['id']}/folders",
        json={"name": "Docs", "color": "#10B981"},
    )
    assert folder_response.status_code == 201
    return project, folder_response.json()


@pytest.mark.integration
async def test_get_folder_with_diagrams_returns_full_diagram_payload(
    authenticated_client: AsyncClient,
) -> None:
    """Regression: a non-empty folder returned 500 because nested diagrams lacked ``config``."""
    project, folder = await _create_project_with_folder(authenticated_client)
    diagram_response = await authenticated_client.post(
        f"/api/v1/projects/{project['id']}/diagrams",
        json={
            "title": "In folder",
            "content": "graph TD\n  A --> B",
            "diagram_type": "mermaid",
            "folder_id": folder["id"],
        },
    )
    assert diagram_response.status_code == 201
    created = diagram_response.json()

    response = await authenticated_client.get(f"/api/v1/folders/{folder['id']}")

    assert response.status_code == 200
    diagrams = response.json()["diagrams"]
    assert [d["id"] for d in diagrams] == [created["id"]]
    # Same shape as the diagram endpoint and the project tree.
    assert diagrams[0]["config"] == created["config"]
    assert diagrams[0]["user_preferences"] == created["user_preferences"]
    assert diagrams[0]["folder_id"] == folder["id"]


@pytest.mark.integration
async def test_get_empty_folder_returns_no_diagrams(authenticated_client: AsyncClient) -> None:
    """An empty folder still answers 200 with an empty list."""
    _, folder = await _create_project_with_folder(authenticated_client)

    response = await authenticated_client.get(f"/api/v1/folders/{folder['id']}")

    assert response.status_code == 200
    assert response.json()["diagrams"] == []
