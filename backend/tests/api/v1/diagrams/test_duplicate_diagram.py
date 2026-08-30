"""Integration tests for duplicating diagrams."""

import pytest
from httpx import AsyncClient


@pytest.mark.integration
@pytest.mark.asyncio
async def test_duplicate_diagram_copies_it_in_same_project_and_folder(
    authenticated_client: AsyncClient,
) -> None:
    """A user can duplicate a diagram; the copy keeps content, type and folder."""
    project_response = await authenticated_client.post(
        "/api/v1/projects",
        json={"name": "Clone project", "emoji": "📁"},
    )
    assert project_response.status_code == 201
    project = project_response.json()

    folder_response = await authenticated_client.post(
        f"/api/v1/projects/{project['id']}/folders",
        json={"name": "Architecture", "color": "#3B82F6"},
    )
    assert folder_response.status_code == 201
    folder = folder_response.json()

    diagram_response = await authenticated_client.post(
        f"/api/v1/projects/{project['id']}/diagrams",
        json={
            "title": "System design",
            "content": "graph TD\n  A --> B",
            "diagram_type": "mermaid",
            "folder_id": folder["id"],
        },
    )
    assert diagram_response.status_code == 201
    diagram = diagram_response.json()

    response = await authenticated_client.post(
        f"/api/v1/diagrams/{diagram['id']}/duplicate",
        json={"title": "System design-copy"},
    )
    assert response.status_code == 200
    clone = response.json()

    assert clone["id"] != diagram["id"]
    assert clone["title"] == "System design-copy"
    assert clone["content"] == diagram["content"]
    assert clone["diagram_type"] == diagram["diagram_type"]
    assert clone["project_id"] == diagram["project_id"]
    assert clone["folder_id"] == diagram["folder_id"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_duplicate_diagram_not_found(authenticated_client: AsyncClient) -> None:
    """Duplicating a non-existent diagram returns 404."""
    response = await authenticated_client.post(
        "/api/v1/diagrams/000000000000000000000000/duplicate",
        json={"title": "copy"},
    )
    assert response.status_code == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_duplicate_diagram_requires_title(authenticated_client: AsyncClient) -> None:
    """Duplicating without a title returns 422."""
    project_response = await authenticated_client.post(
        "/api/v1/projects",
        json={"name": "Clone project 2", "emoji": "📁"},
    )
    assert project_response.status_code == 201
    project = project_response.json()

    diagram_response = await authenticated_client.post(
        f"/api/v1/projects/{project['id']}/diagrams",
        json={
            "title": "Diagram",
            "content": "graph TD\n  A",
            "diagram_type": "mermaid",
        },
    )
    assert diagram_response.status_code == 201
    diagram = diagram_response.json()

    response = await authenticated_client.post(
        f"/api/v1/diagrams/{diagram['id']}/duplicate",
        json={},
    )
    assert response.status_code == 422
