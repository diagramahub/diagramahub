"""Integration tests for GET /diagrams/recent (dashboard "Recent")."""

from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient

from app.api.v1.diagrams.schemas import DiagramInDB
from app.api.v1.projects.schemas import ProjectInDB

BASE = datetime(2026, 1, 1, 12, 0, 0)


async def _project(user_id: str, name: str, emoji: str) -> str:
    project = await ProjectInDB(name=name, emoji=emoji, user_id=user_id).insert()
    return str(project.id)


async def _diagram(project_id: str, title: str, minutes: int) -> str:
    diagram = await DiagramInDB(
        title=title,
        content="graph TD\n  A-->B" * 50,  # non-trivial content the endpoint must not need
        diagram_type="mermaid",
        project_id=project_id,
        created_at=BASE,
        updated_at=BASE + timedelta(minutes=minutes),
    ).insert()
    return str(diagram.id)


@pytest.mark.integration
async def test_recent_returns_top_four_across_projects_newest_first(
    authenticated_client: AsyncClient,
) -> None:
    me = (await authenticated_client.get("/api/v1/users/me")).json()
    alpha = await _project(me["id"], "Alpha", "🅰️")
    beta = await _project(me["id"], "Beta", "🅱️")
    await _diagram(alpha, "a-oldest", 1)
    newest = await _diagram(beta, "b-newest", 60)
    await _diagram(alpha, "a-third", 30)
    await _diagram(beta, "b-fourth", 20)
    await _diagram(alpha, "a-second", 45)
    await _diagram(beta, "b-fifth", 10)

    response = await authenticated_client.get("/api/v1/diagrams/recent")

    assert response.status_code == 200
    body = response.json()
    assert [d["title"] for d in body] == ["b-newest", "a-second", "a-third", "b-fourth"]
    first = body[0]
    assert first["id"] == newest
    assert first["project_id"] == beta
    assert first["project_name"] == "Beta"
    assert first["project_emoji"] == "🅱️"
    assert first["diagram_type"] == "mermaid"
    assert first["updated_at"].startswith("2026-01-01T13:00")
    assert "content" not in first


@pytest.mark.integration
async def test_recent_never_includes_other_users_diagrams(
    authenticated_client: AsyncClient,
) -> None:
    me = (await authenticated_client.get("/api/v1/users/me")).json()
    mine = await _project(me["id"], "Mine", "📁")
    theirs = await _project("someone-else", "Theirs", "🚫")
    await _diagram(mine, "my-diagram", 1)
    await _diagram(theirs, "their-newer-diagram", 999)

    body = (await authenticated_client.get("/api/v1/diagrams/recent")).json()

    assert [d["title"] for d in body] == ["my-diagram"]


@pytest.mark.integration
async def test_recent_is_empty_without_projects(authenticated_client: AsyncClient) -> None:
    response = await authenticated_client.get("/api/v1/diagrams/recent")
    assert response.status_code == 200
    assert response.json() == []
