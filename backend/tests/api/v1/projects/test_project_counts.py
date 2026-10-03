"""Diagram counts come from the database (no documents loaded) and stay correct."""

import pytest
from httpx import AsyncClient

from app.api.v1.projects.routes import get_usage_limiter


async def _project_with(client: AsyncClient, name: str, types: list[str]) -> str:
    pid = (await client.post("/api/v1/projects", json={"name": name, "emoji": "📁"})).json()["id"]
    for i, diagram_type in enumerate(types):
        response = await client.post(
            f"/api/v1/projects/{pid}/diagrams",
            json={"title": f"d{i}", "diagram_type": diagram_type, "content": "graph TD"},
        )
        assert response.status_code == 201
    return pid


@pytest.mark.integration
async def test_project_list_counts_diagrams_per_type(authenticated_client: AsyncClient) -> None:
    with_diagrams = await _project_with(authenticated_client, "A", ["mermaid", "plantuml", "mermaid"])

    projects = {p["id"]: p for p in (await authenticated_client.get("/api/v1/projects")).json()}
    single = (await authenticated_client.get(f"/api/v1/projects/{with_diagrams}")).json()

    assert projects[with_diagrams]["diagram_count"] == 3
    assert projects[with_diagrams]["diagram_type_counts"] == {"mermaid": 2, "plantuml": 1}
    assert len(single["diagrams"]) == 3


@pytest.mark.integration
async def test_quota_usage_counts_all_projects_of_the_user(authenticated_client: AsyncClient) -> None:
    await _project_with(authenticated_client, "A", ["mermaid", "d2"])
    await _project_with(authenticated_client, "B", ["dbml"])
    me = (await authenticated_client.get("/api/v1/users/me")).json()

    check = await get_usage_limiter().check_diagram_limit(me["id"])

    assert check["current_usage"] == 3
