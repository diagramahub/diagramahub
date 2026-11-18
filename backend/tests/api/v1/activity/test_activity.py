"""Dashboard heatmap: different diagrams worked on per day, in the user's time zone."""

from datetime import datetime

import pytest
from httpx import AsyncClient

from app.api.v1.activity.repository import ActivityRepository
from app.api.v1.activity.schemas import DiagramActivityInDB
from app.api.v1.activity.services import ActivityService, resolve_timezone, streaks
from app.api.v1.diagrams.repository import DiagramRepository
from app.api.v1.diagrams.schemas import DiagramInDB
from app.api.v1.projects.repository import ProjectRepository
from app.api.v1.projects.schemas import ProjectInDB

URL = "/api/v1/activity/heatmap"


@pytest.mark.unit
@pytest.mark.parametrize(
    "active, expected",
    [
        ([], (0, 0)),
        ([True, True, False, True, True, True], (3, 3)),
        # Nothing yet today: the streak still counts until the day is over.
        ([True, True, True, False], (3, 3)),
        ([True, False, False], (0, 1)),
        ([True, True, True, False, True], (1, 3)),
    ],
)
def test_streaks(active: list[bool], expected: tuple[int, int]) -> None:
    assert streaks(active) == expected


@pytest.mark.unit
def test_unknown_time_zone_falls_back_to_utc() -> None:
    assert resolve_timezone("Mars/Olympus")[1] == "UTC"
    assert resolve_timezone(None)[1] == "UTC"
    assert resolve_timezone("America/Mexico_City")[1] == "America/Mexico_City"


async def _me(client: AsyncClient) -> str:
    return (await client.get("/api/v1/users/me")).json()["id"]


async def _project(client: AsyncClient) -> str:
    response = await client.post("/api/v1/projects", json={"name": "P", "emoji": "📁"})
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def _create(client: AsyncClient, project_id: str, title: str) -> str:
    response = await client.post(
        f"/api/v1/projects/{project_id}/diagrams",
        json={"title": title, "content": "graph TD\n  A-->B", "diagram_type": "mermaid"},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


@pytest.mark.integration
async def test_each_diagram_counts_once_per_day(authenticated_client: AsyncClient) -> None:
    project_id = await _project(authenticated_client)
    first = await _create(authenticated_client, project_id, "One")
    await _create(authenticated_client, project_id, "Two")
    for code in ("graph TD\n  A-->C", "graph TD\n  A-->D"):
        await authenticated_client.put(f"/api/v1/diagrams/{first}", json={"content": code})

    body = (await authenticated_client.get(URL, params={"days": 7})).json()

    assert len(body["days"]) == 7
    assert body["days"][-1]["count"] == 2
    assert body["total"] == 2 and body["active_days"] == 1
    assert body["current_streak"] == 1 and body["timezone"] == "UTC"


@pytest.mark.integration
async def test_viewing_a_diagram_is_not_activity(authenticated_client: AsyncClient) -> None:
    project_id = await _project(authenticated_client)
    diagram_id = await _create(authenticated_client, project_id, "One")
    await DiagramActivityInDB.find_all().delete()

    await authenticated_client.put(
        f"/api/v1/diagrams/{diagram_id}", json={"viewport_zoom": 2.0, "viewport_x": 10}
    )

    assert await DiagramActivityInDB.find_all().count() == 0


@pytest.mark.integration
async def test_days_follow_the_users_time_zone(authenticated_client: AsyncClient) -> None:
    user_id = await _me(authenticated_client)
    project_id = await _project(authenticated_client)
    # 03:00 UTC on Nov 18 is still Nov 17 in Mexico City (UTC-6).
    await ActivityRepository().record(user_id, "d1", datetime(2026, 11, 18, 3, 30))
    await ActivityRepository().record(user_id, "d2", datetime(2026, 11, 18, 15, 0))
    service = ActivityService(
        ActivityRepository(),
        ProjectRepository(),
        DiagramRepository(),
        now=lambda: datetime(2026, 11, 18, 20, 0),
    )
    assert project_id

    local = await service.heatmap(user_id, 7, "America/Mexico_City")
    utc = await service.heatmap(user_id, 7, None)

    assert [(d.date, d.count) for d in local.days[-2:]] == [("2026-11-17", 1), ("2026-11-18", 1)]
    assert utc.days[-1].count == 2


@pytest.mark.integration
async def test_history_before_recording_comes_from_the_diagrams(
    authenticated_client: AsyncClient,
) -> None:
    user_id = await _me(authenticated_client)
    mine = await ProjectInDB(name="Mine", emoji="📁", user_id=user_id).insert()
    theirs = await ProjectInDB(name="Theirs", emoji="🚫", user_id="someone-else").insert()
    for project, title in ((mine, "old"), (theirs, "not mine")):
        await DiagramInDB(
            title=title,
            content="graph TD",
            diagram_type="mermaid",
            project_id=str(project.id),
            created_at=datetime(2026, 11, 10, 12, 0),
            updated_at=datetime(2026, 11, 16, 12, 0),
        ).insert()
    service = ActivityService(
        ActivityRepository(),
        ProjectRepository(),
        DiagramRepository(),
        now=lambda: datetime(2026, 11, 18, 12, 0),
    )

    heatmap = await service.heatmap(user_id, 14, None)
    counts = {d.date: d.count for d in heatmap.days if d.count}

    assert counts == {"2026-11-10": 1, "2026-11-16": 1}
    assert heatmap.total == 1 and heatmap.longest_streak == 1 and heatmap.current_streak == 0


@pytest.mark.integration
async def test_range_is_validated(authenticated_client: AsyncClient) -> None:
    assert (await authenticated_client.get(URL, params={"days": 500})).status_code == 422
    assert (await authenticated_client.get(URL, params={"days": 3})).status_code == 422
