"""
Public diagrams and the plan limit.

A diagram published (and visible) in the Community doesn't count toward the
plan's ``max_diagrams`` unless the plan sets ``public_diagrams_count``. Making it
private again needs room in the plan; publishing needs code that draws
something, within the size cap, the daily publication cap and the plan's
``max_public_diagrams``.
"""

import io
import zipfile

import pytest
from httpx import AsyncClient

from app.api.v1.community import services as community_services
from app.api.v1.community.schemas import PublishedDiagramInDB
from app.api.v1.diagrams.schemas import MAX_DIAGRAM_CODE_LENGTH
from app.api.v1.subscriptions.schemas import PlanInDB
from app.api.v1.users.schemas import UserInDB, UserRole
from app.core.config import settings
from tests.utils import generate_test_password

pytestmark = pytest.mark.integration

COMMUNITY = "/api/v1/community"
FLOW = "graph TD\n  A-->B"


@pytest.fixture(autouse=True)
def _reset_publish_limiter():
    community_services.publish_limiter.reset()
    yield


async def _user(client: AsyncClient, name: str, admin: bool = False) -> dict:
    email = f"{name.lower().replace(' ', '.')}@example.com"
    password = generate_test_password("Pub")
    response = await client.post(
        "/api/v1/users/register", json={"email": email, "password": password, "full_name": name}
    )
    assert response.status_code == 201, response.text
    if admin:
        user = await UserInDB.find_one(UserInDB.email == email)
        user.role = UserRole.ADMIN
        await user.save()
    login = await client.post("/api/v1/users/login", json={"email": email, "password": password})
    return {
        "id": response.json()["id"],
        "headers": {"Authorization": f"Bearer {login.json()['access_token']}"},
    }


async def _project(client: AsyncClient, user: dict) -> str:
    project = await client.post(
        "/api/v1/projects", json={"name": "Mine", "emoji": "📁"}, headers=user["headers"]
    )
    assert project.status_code == 201, project.text
    return project.json()["id"]


async def _create(client: AsyncClient, user: dict, pid: str, **fields):
    body = {"title": "Flow", "content": FLOW, "diagram_type": "mermaid"}
    body.update(fields)
    return await client.post(f"/api/v1/projects/{pid}/diagrams", json=body, headers=user["headers"])


async def _publish(client: AsyncClient, user: dict, diagram_id: str):
    return await client.post(
        f"{COMMUNITY}/diagrams",
        json={"diagram_id": diagram_id, "category": "architecture", "tags": []},
        headers=user["headers"],
    )


async def _free_plan(**fields) -> None:
    plan = await PlanInDB.find_one(PlanInDB.code == "FREE")
    await plan.set(fields)


async def _hide(publication_id: str) -> None:
    publication = await PublishedDiagramInDB.get(publication_id)
    await publication.set({"hidden": True})


async def _usage(client: AsyncClient, user: dict) -> dict:
    response = await client.get("/api/v1/subscriptions/usage", headers=user["headers"])
    assert response.status_code == 200, response.text
    return response.json()["diagrams"]


@pytest.fixture
async def people(client: AsyncClient) -> dict:
    """The first user registered becomes the admin; the author is on FREE (2 diagrams)."""
    admin = await _user(client, "Ada Admin")
    author = await _user(client, "Ana Autora")
    await _free_plan(max_diagrams=2)
    author["project"] = await _project(client, author)
    return {"admin": admin, "author": author}


# --------------------------------------------------------------------------- #
#  Counting
# --------------------------------------------------------------------------- #


async def test_a_published_diagram_frees_its_slot(client: AsyncClient, people: dict) -> None:
    author = people["author"]
    first = (await _create(client, author, author["project"])).json()["id"]
    assert (await _create(client, author, author["project"])).status_code == 201
    full = await _create(client, author, author["project"])
    assert full.status_code == 403
    assert full.json()["detail"]["resource_type"] == "diagrams"
    assert full.json()["detail"]["public_counts"] is False

    assert (await _publish(client, author, first)).status_code == 201

    assert await _usage(client, author) == {
        "current": 1,
        "limit": 2,
        "public": 1,
        "public_counts": False,
        "public_limit": None,
    }
    assert (await _create(client, author, author["project"])).status_code == 201


async def test_a_hidden_publication_counts_as_private(client: AsyncClient, people: dict) -> None:
    author = people["author"]
    first = (await _create(client, author, author["project"])).json()["id"]
    publication = (await _publish(client, author, first)).json()
    await _hide(publication["id"])

    usage = await _usage(client, author)
    assert (usage["current"], usage["public"]) == (1, 0)


async def test_a_plan_can_count_public_diagrams(client: AsyncClient, people: dict) -> None:
    author = people["author"]
    await _free_plan(public_diagrams_count=True)
    first = (await _create(client, author, author["project"])).json()["id"]
    await _create(client, author, author["project"])
    assert (await _publish(client, author, first)).status_code == 201

    usage = await _usage(client, author)
    assert (usage["current"], usage["public"], usage["public_counts"]) == (2, 1, True)
    assert (await _create(client, author, author["project"])).status_code == 403


# --------------------------------------------------------------------------- #
#  Unpublishing needs room
# --------------------------------------------------------------------------- #


async def test_unpublishing_needs_room_for_one_more_private(
    client: AsyncClient, people: dict
) -> None:
    author = people["author"]
    first = (await _create(client, author, author["project"])).json()["id"]
    publication = (await _publish(client, author, first)).json()
    private = (await _create(client, author, author["project"])).json()["id"]
    await _create(client, author, author["project"])  # 2 private: full

    blocked = await client.delete(
        f"{COMMUNITY}/diagrams/{publication['id']}", headers=author["headers"]
    )
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == {
        "error": "resource_limit_exceeded",
        "resource_type": "private_diagrams",
        "current_usage": 2,
        "limit": 2,
        "message": "You have reached your private_diagrams limit (2/2)",
    }
    assert await PublishedDiagramInDB.get(publication["id"]) is not None

    # Deleting a private diagram makes room.
    await client.delete(f"/api/v1/diagrams/{private}", headers=author["headers"])
    allowed = await client.delete(
        f"{COMMUNITY}/diagrams/{publication['id']}", headers=author["headers"]
    )
    assert allowed.status_code == 204


async def test_a_hidden_or_orphan_publication_can_always_be_removed(
    client: AsyncClient, people: dict
) -> None:
    author = people["author"]
    first = (await _create(client, author, author["project"])).json()["id"]
    second = (await _create(client, author, author["project"])).json()["id"]
    hidden = (await _publish(client, author, first)).json()
    orphan = (await _publish(client, author, second)).json()
    await _create(client, author, author["project"])
    await _create(client, author, author["project"])  # 2 private: full
    await _hide(hidden["id"])
    # Hidden already counts as private: removing it changes nothing.
    assert (
        await client.delete(f"{COMMUNITY}/diagrams/{hidden['id']}", headers=author["headers"])
    ).status_code == 204
    # Its diagram deleted: the publication alone uses no slot.
    await client.delete(f"/api/v1/diagrams/{second}", headers=author["headers"])
    assert (
        await client.delete(f"{COMMUNITY}/diagrams/{orphan['id']}", headers=author["headers"])
    ).status_code == 204


async def test_an_admin_may_leave_the_owner_over_the_limit(
    client: AsyncClient, people: dict
) -> None:
    admin, author = people["admin"], people["author"]
    first = (await _create(client, author, author["project"])).json()["id"]
    publication = (await _publish(client, author, first)).json()
    await _create(client, author, author["project"])
    await _create(client, author, author["project"])

    removed = await client.delete(
        f"{COMMUNITY}/diagrams/{publication['id']}", headers=admin["headers"]
    )

    assert removed.status_code == 204
    assert (await _usage(client, author))["current"] == 3  # over the limit of 2
    blocked = await _create(client, author, author["project"])
    assert blocked.status_code == 403
    # Still free to edit what they have.
    edit = await client.put(
        f"/api/v1/diagrams/{first}",
        json={"content": "graph LR\n  X-->Y"},
        headers=author["headers"],
    )
    assert edit.status_code == 200


# --------------------------------------------------------------------------- #
#  Publishing
# --------------------------------------------------------------------------- #


async def test_publishing_respects_the_plans_public_limit(
    client: AsyncClient, people: dict
) -> None:
    author = people["author"]
    await _free_plan(max_public_diagrams=1)
    first = (await _create(client, author, author["project"])).json()["id"]
    second = (await _create(client, author, author["project"])).json()["id"]
    assert (await _publish(client, author, first)).status_code == 201

    over = await _publish(client, author, second)

    assert over.status_code == 403
    assert over.json()["detail"]["resource_type"] == "public_diagrams"
    assert (over.json()["detail"]["current_usage"], over.json()["detail"]["limit"]) == (1, 1)


@pytest.mark.parametrize(
    "content, error",
    [
        ("graph TD", "diagram_empty"),
        ("%% only a comment\n", "diagram_empty"),
        ("not a diagram\nat all", "diagram_invalid"),
    ],
)
async def test_publishing_needs_code_that_draws_something(
    client: AsyncClient, people: dict, content: str, error: str
) -> None:
    author = people["author"]
    diagram = (await _create(client, author, author["project"], content=content)).json()["id"]

    response = await _publish(client, author, diagram)

    assert response.status_code == 422
    assert response.json()["detail"]["error"] == error


async def test_publishing_has_a_daily_cap(
    client: AsyncClient, people: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    author = people["author"]
    monkeypatch.setattr(settings, "COMMUNITY_MAX_PUBLICATIONS_PER_DAY", 1)
    first = (await _create(client, author, author["project"])).json()["id"]
    second = (await _create(client, author, author["project"])).json()["id"]
    assert (await _publish(client, author, first)).status_code == 201

    capped = await _publish(client, author, second)

    assert capped.status_code == 429
    assert capped.json()["detail"] == {"error": "publish_daily_limit", "limit": 1}


# --------------------------------------------------------------------------- #
#  Code size cap
# --------------------------------------------------------------------------- #


async def test_text_diagrams_have_a_size_cap(client: AsyncClient, people: dict) -> None:
    author = people["author"]
    huge = "graph TD\n" + "  A-->B\n" * (MAX_DIAGRAM_CODE_LENGTH // 8 + 1)

    created = await _create(client, author, author["project"], content=huge)
    assert created.status_code == 422
    assert created.json()["detail"]["error"] == "diagram_too_large"

    diagram = (await _create(client, author, author["project"])).json()["id"]
    updated = await client.put(
        f"/api/v1/diagrams/{diagram}", json={"content": huge}, headers=author["headers"]
    )
    assert updated.status_code == 422


async def test_an_import_skips_oversized_diagrams(client: AsyncClient, people: dict) -> None:
    author = people["author"]
    huge = "graph TD\n" + "  A-->B\n" * (MAX_DIAGRAM_CODE_LENGTH // 8 + 1)
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as zf:
        zf.writestr("big.mmd", huge)
        zf.writestr("small.mmd", FLOW)

    preview = await client.post(
        f"/api/v1/projects/{author['project']}/import?dry_run=true",
        files={"files": ("export.zip", archive.getvalue(), "application/zip")},
        headers=author["headers"],
    )

    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert body["diagram_count"] == 1
    assert {"source": "big.mmd", "reason": "too_large"} in body["skipped"]


# --------------------------------------------------------------------------- #
#  Plans
# --------------------------------------------------------------------------- #


async def test_admins_set_the_public_rules_per_plan(client: AsyncClient, people: dict) -> None:
    admin = people["admin"]
    created = await client.post(
        "/api/v1/admin/plans",
        json={
            "name": "Team",
            "code": "TEAM",
            "price_usd": 0,
            "max_projects": 5,
            "max_diagrams": 30,
            "max_public_diagrams": 100,
        },
        headers=admin["headers"],
    )
    assert created.status_code == 201, created.text
    plan = created.json()
    assert (plan["public_diagrams_count"], plan["max_public_diagrams"]) == (False, 100)

    updated = await client.put(
        f"/api/v1/admin/plans/{plan['id']}",
        json={"public_diagrams_count": True, "max_public_diagrams": -1},
        headers=admin["headers"],
    )
    assert updated.status_code == 200, updated.text
    assert (updated.json()["public_diagrams_count"], updated.json()["max_public_diagrams"]) == (
        True,
        -1,
    )
