"""Favorite diagrams: star from the editor or lists, listed on the dashboard."""

from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient

from app.api.v1.diagrams.schemas import DiagramInDB
from app.api.v1.projects.schemas import ProjectInDB

pytestmark = pytest.mark.integration
BASE = datetime(2026, 1, 1, 12, 0, 0)


async def _diagram(project_id: str, title: str, minutes: int, favorite: bool = False) -> str:
    diagram = await DiagramInDB(
        title=title,
        content="graph TD\n  A-->B",
        diagram_type="mermaid",
        project_id=project_id,
        is_favorite=favorite,
        created_at=BASE,
        updated_at=BASE + timedelta(minutes=minutes),
    ).insert()
    return str(diagram.id)


async def _my_project(client: AsyncClient, name: str = "Mine") -> str:
    me = (await client.get("/api/v1/users/me")).json()
    return str((await ProjectInDB(name=name, emoji="⭐", user_id=me["id"]).insert()).id)


async def test_starring_does_not_count_as_an_edit(authenticated_client: AsyncClient) -> None:
    diagram_id = await _diagram(await _my_project(authenticated_client), "Flow", 5)

    starred = await authenticated_client.put(f"/api/v1/diagrams/{diagram_id}/favorite")
    diagram = (await authenticated_client.get(f"/api/v1/diagrams/{diagram_id}")).json()

    assert starred.status_code == 200 and starred.json() == {"id": diagram_id, "is_favorite": True}
    assert diagram["is_favorite"] is True
    assert diagram["updated_at"].startswith("2026-01-01T12:05")
    stored = await DiagramInDB.get(diagram_id)
    assert stored.favorited_at is not None

    unstarred = await authenticated_client.delete(f"/api/v1/diagrams/{diagram_id}/favorite")
    assert unstarred.json()["is_favorite"] is False
    assert (await DiagramInDB.get(diagram_id)).favorited_at is None


async def test_favorites_list_most_recently_edited_first(
    authenticated_client: AsyncClient,
) -> None:
    project_id = await _my_project(authenticated_client)
    await _diagram(project_id, "old-star", 1, favorite=True)
    await _diagram(project_id, "not-starred", 99)
    await _diagram(project_id, "new-star", 50, favorite=True)
    await _diagram(project_id, "mid-star", 20, favorite=True)
    theirs = str((await ProjectInDB(name="T", emoji="🚫", user_id="other").insert()).id)
    await _diagram(theirs, "their-star", 100, favorite=True)

    body = (await authenticated_client.get("/api/v1/diagrams/favorites?limit=2")).json()

    assert body["total"] == 3
    assert [d["title"] for d in body["items"]] == ["new-star", "mid-star"]
    assert body["items"][0]["project_name"] == "Mine"
    assert body["items"][0]["project_emoji"] == "⭐"
    assert "content" not in body["items"][0]


async def test_cannot_star_someone_elses_diagram(authenticated_client: AsyncClient) -> None:
    theirs = str((await ProjectInDB(name="T", emoji="🚫", user_id="other").insert()).id)
    diagram_id = await _diagram(theirs, "theirs", 1)

    response = await authenticated_client.put(f"/api/v1/diagrams/{diagram_id}/favorite")

    assert response.status_code == 403
    assert (await DiagramInDB.get(diagram_id)).is_favorite is False


async def test_a_copy_is_not_a_favorite(authenticated_client: AsyncClient) -> None:
    diagram_id = await _diagram(await _my_project(authenticated_client), "Flow", 1, favorite=True)

    copy = await authenticated_client.post(
        f"/api/v1/diagrams/{diagram_id}/duplicate", json={"title": "Flow (copy)"}
    )

    assert copy.status_code == 200, copy.text
    assert copy.json()["is_favorite"] is False


async def test_missing_diagram_is_404(authenticated_client: AsyncClient) -> None:
    response = await authenticated_client.put("/api/v1/diagrams/000000000000000000000000/favorite")
    assert response.status_code == 404
