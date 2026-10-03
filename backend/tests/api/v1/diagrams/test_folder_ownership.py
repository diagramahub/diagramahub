"""A diagram can only be filed under a folder of its own project (cross-project ids)."""

from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.api.v1.subscriptions.usage_limiter import UsageLimiter
from tests.utils.security import generate_test_password


async def _project_with_folder(client: AsyncClient, headers: dict | None = None) -> tuple[str, str]:
    project = (
        await client.post("/api/v1/projects", json={"name": "P", "emoji": "📁"}, headers=headers)
    ).json()
    folder = (
        await client.post(
            f"/api/v1/projects/{project['id']}/folders",
            json={"name": "Docs", "color": "#3B82F6"},
            headers=headers,
        )
    ).json()
    return project["id"], folder["id"]


async def _other_user_headers(client: AsyncClient) -> dict:
    other = {
        "email": "folder-owner@example.com",
        "password": generate_test_password(),
        "full_name": "Folder Owner",
    }
    assert (await client.post("/api/v1/users/register", json=other)).status_code == 201
    login = await client.post(
        "/api/v1/users/login", json={"email": other["email"], "password": other["password"]}
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.mark.integration
async def test_cannot_create_a_diagram_in_another_users_folder(
    authenticated_client: AsyncClient,
) -> None:
    my_project, _ = await _project_with_folder(authenticated_client)
    victim = await _other_user_headers(authenticated_client)
    victim_project, victim_folder = await _project_with_folder(authenticated_client, victim)

    response = await authenticated_client.post(
        f"/api/v1/projects/{my_project}/diagrams",
        json={"title": "injected", "diagram_type": "mermaid", "content": "graph TD", "folder_id": victim_folder},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Folder not found"
    victim_tree = (
        await authenticated_client.get(f"/api/v1/projects/{victim_project}", headers=victim)
    ).json()
    assert victim_tree["folders"][0]["diagrams"] == []


@pytest.mark.integration
async def test_cannot_move_a_diagram_into_another_users_folder(
    authenticated_client: AsyncClient,
) -> None:
    my_project, _ = await _project_with_folder(authenticated_client)
    diagram = (
        await authenticated_client.post(
            f"/api/v1/projects/{my_project}/diagrams",
            json={"title": "mine", "diagram_type": "mermaid", "content": "graph TD"},
        )
    ).json()
    victim = await _other_user_headers(authenticated_client)
    _, victim_folder = await _project_with_folder(authenticated_client, victim)

    response = await authenticated_client.put(
        f"/api/v1/diagrams/{diagram['id']}", json={"folder_id": victim_folder}
    )

    assert response.status_code == 404
    stored = (await authenticated_client.get(f"/api/v1/diagrams/{diagram['id']}")).json()
    assert stored["folder_id"] is None


@pytest.mark.integration
async def test_folder_of_another_project_of_the_same_user_is_rejected(
    authenticated_client: AsyncClient,
) -> None:
    project_a, _ = await _project_with_folder(authenticated_client)
    _, folder_b = await _project_with_folder(authenticated_client)

    response = await authenticated_client.post(
        f"/api/v1/projects/{project_a}/diagrams",
        json={"title": "x", "diagram_type": "mermaid", "content": "graph TD", "folder_id": folder_b},
    )

    assert response.status_code == 404


@pytest.mark.integration
async def test_own_folder_still_works_and_root_is_allowed(authenticated_client: AsyncClient) -> None:
    project, folder = await _project_with_folder(authenticated_client)

    in_folder = await authenticated_client.post(
        f"/api/v1/projects/{project}/diagrams",
        json={"title": "a", "diagram_type": "mermaid", "content": "graph TD", "folder_id": folder},
    )
    moved_to_root = await authenticated_client.put(
        f"/api/v1/diagrams/{in_folder.json()['id']}", json={"folder_id": None}
    )

    assert in_folder.status_code == 201 and in_folder.json()["folder_id"] == folder
    assert moved_to_root.status_code == 200


@pytest.mark.integration
async def test_folder_queries_ignore_diagrams_of_other_projects(
    authenticated_client: AsyncClient,
) -> None:
    """Legacy data: a diagram already pointing at a foreign folder stays out of it."""
    from app.api.v1.diagrams.schemas import DiagramInDB

    project, folder = await _project_with_folder(authenticated_client)
    other_project, _ = await _project_with_folder(authenticated_client)
    await DiagramInDB(
        title="stray", content="graph TD", diagram_type="mermaid",
        project_id=other_project, folder_id=folder,
    ).insert()

    tree = (await authenticated_client.get(f"/api/v1/projects/{project}")).json()
    folder_view = (await authenticated_client.get(f"/api/v1/folders/{folder}")).json()
    deleted = await authenticated_client.delete(f"/api/v1/folders/{folder}?delete_diagrams=true")

    assert tree["folders"][0]["diagrams"] == []
    assert folder_view["diagrams"] == []
    assert deleted.status_code == 200
    assert await DiagramInDB.find(DiagramInDB.title == "stray").count() == 1


@pytest.mark.integration
async def test_duplicate_respects_the_plan_diagram_limit(authenticated_client: AsyncClient) -> None:
    project, _ = await _project_with_folder(authenticated_client)
    diagram = (
        await authenticated_client.post(
            f"/api/v1/projects/{project}/diagrams",
            json={"title": "a", "diagram_type": "mermaid", "content": "graph TD"},
        )
    ).json()

    async def at_limit(self, user_id):  # noqa: ANN001
        return {"allowed": False, "current_usage": 10, "limit": 10, "plan_name": "FREE"}

    with patch.object(UsageLimiter, "check_diagram_limit", at_limit):
        response = await authenticated_client.post(
            f"/api/v1/diagrams/{diagram['id']}/duplicate", json={"title": "copy"}
        )

    assert response.status_code == 403
    assert response.json()["detail"]["error"] == "resource_limit_exceeded"
    tree = (await authenticated_client.get(f"/api/v1/projects/{project}")).json()
    assert [d["title"] for d in tree["diagrams"]] == ["a"]


@pytest.mark.integration
async def test_repair_script_moves_misfiled_diagrams_to_their_project_root(test_db) -> None:  # noqa: ANN001
    """scripts/fix_misfiled_diagrams.py: dry run reports, --apply fixes, rerun is a no-op."""
    from bson import ObjectId

    from scripts.fix_misfiled_diagrams import repair_misfiled_diagrams

    folder_a, folder_b = ObjectId(), ObjectId()
    await test_db["folders"].insert_many(
        [{"_id": folder_a, "project_id": "pa", "name": "A"}, {"_id": folder_b, "project_id": "pb", "name": "B"}]
    )
    ok, foreign, dangling, root = ObjectId(), ObjectId(), ObjectId(), ObjectId()
    await test_db["diagrams"].insert_many(
        [
            {"_id": ok, "project_id": "pa", "folder_id": str(folder_a), "title": "ok"},
            {"_id": foreign, "project_id": "pa", "folder_id": str(folder_b), "title": "foreign"},
            {"_id": dangling, "project_id": "pa", "folder_id": str(ObjectId()), "title": "dangling"},
            {"_id": root, "project_id": "pa", "folder_id": None, "title": "root"},
        ]
    )

    dry = await repair_misfiled_diagrams(test_db, apply=False)
    assert (dry["checked"], dry["foreign_folder"], dry["missing_folder"], dry["fixed"]) == (3, 1, 1, 0)
    assert (await test_db["diagrams"].find_one({"_id": foreign}))["folder_id"] == str(folder_b)

    applied = await repair_misfiled_diagrams(test_db, apply=True)
    assert applied["fixed"] == 2
    assert (await test_db["diagrams"].find_one({"_id": foreign}))["folder_id"] is None
    assert (await test_db["diagrams"].find_one({"_id": dangling}))["folder_id"] is None
    assert (await test_db["diagrams"].find_one({"_id": ok}))["folder_id"] == str(folder_a)

    again = await repair_misfiled_diagrams(test_db, apply=True)
    assert (again["foreign_folder"], again["missing_folder"], again["fixed"]) == (0, 0, 0)
