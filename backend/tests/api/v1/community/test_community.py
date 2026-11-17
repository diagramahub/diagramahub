"""
Community portal: publish, browse, stars, forks, comments, reports and moderation.
"""

import pytest
from httpx import AsyncClient

from app.api.v1.community import services as community_services
from app.api.v1.community.repository import CommunityRepository
from app.api.v1.community.schemas import CommunityForkInDB, PublishedDiagramInDB
from app.api.v1.users.audit_log import AuditLogEntry
from app.api.v1.users.schemas import UserInDB, UserRole
from tests.utils import generate_test_password

pytestmark = pytest.mark.integration

BASE = "/api/v1/community"


@pytest.fixture(autouse=True)
def _reset_community_limits():
    for limiter in (
        community_services.publish_limiter,
        community_services.comment_limiter,
        community_services.report_limiter,
    ):
        limiter.reset()
    yield


async def _user(client: AsyncClient, name: str, admin: bool = False) -> dict:
    email = f"{name.lower().replace(' ', '.')}@example.com"
    password = generate_test_password("Comm")
    response = await client.post(
        "/api/v1/users/register", json={"email": email, "password": password, "full_name": name}
    )
    assert response.status_code == 201, response.text
    if admin:
        user = await UserInDB.find_one(UserInDB.email == email)
        user.role = UserRole.ADMIN
        await user.save()
    login = await client.post("/api/v1/users/login", json={"email": email, "password": password})
    token = login.json()["access_token"]
    return {"id": response.json()["id"], "headers": {"Authorization": f"Bearer {token}"}}


async def _diagram(client: AsyncClient, user: dict, **fields) -> tuple[str, str]:
    # One project per user: the FREE plan allows a single project.
    if "project_id" not in user:
        project = await client.post(
            "/api/v1/projects", json={"name": "Mine", "emoji": "📁"}, headers=user["headers"]
        )
        user["project_id"] = project.json()["id"]
    pid = user["project_id"]
    body = {"title": "Checkout", "content": "graph TD\n  A-->B", "diagram_type": "mermaid"}
    body.update(fields)
    diagram = await client.post(
        f"/api/v1/projects/{pid}/diagrams", json=body, headers=user["headers"]
    )
    assert diagram.status_code == 201, diagram.text
    return pid, diagram.json()["id"]


async def _publish(client: AsyncClient, user: dict, diagram_id: str, **fields) -> dict:
    body = {"diagram_id": diagram_id, "category": "architecture", "tags": ["#Pagos ", "e commerce"]}
    body.update(fields)
    response = await client.post(f"{BASE}/diagrams", json=body, headers=user["headers"])
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
async def people(client: AsyncClient) -> dict:
    """The first user registered is the admin (installation)."""
    admin = await _user(client, "Ada Admin")
    return {
        "admin": admin,
        "author": await _user(client, "Ana Autora"),
        "visitor": await _user(client, "Vic Visitante"),
    }


async def test_publish_and_browse(client: AsyncClient, people: dict) -> None:
    author, visitor = people["author"], people["visitor"]
    _, diagram_id = await _diagram(client, author, description="Flujo de pago")

    published = await _publish(client, author, diagram_id)

    assert published["owner_name"] == "Ana Autora"
    assert published["tags"] == ["pagos", "e-commerce"]
    assert published["description"] == "Flujo de pago"
    assert published["is_owner"] is True and published["source_diagram_id"] == diagram_id
    page = (await client.get(f"{BASE}/diagrams", headers=visitor["headers"])).json()
    assert [i["title"] for i in page["items"]] == ["Checkout"]
    detail = (
        await client.get(f"{BASE}/diagrams/{published['id']}", headers=visitor["headers"])
    ).json()
    assert detail["is_owner"] is False and detail["source_diagram_id"] is None
    assert detail["views_count"] == 1
    assert "@" not in detail["owner_name"]
    entries = await AuditLogEntry.find(AuditLogEntry.event == "community_published").to_list()
    assert len(entries) == 1


async def test_only_the_owner_publishes_and_only_once(client: AsyncClient, people: dict) -> None:
    author, visitor = people["author"], people["visitor"]
    _, diagram_id = await _diagram(client, author)

    stranger = await client.post(
        f"{BASE}/diagrams",
        json={"diagram_id": diagram_id, "category": "uml"},
        headers=visitor["headers"],
    )
    await _publish(client, author, diagram_id)
    twice = await client.post(
        f"{BASE}/diagrams",
        json={"diagram_id": diagram_id, "category": "uml"},
        headers=author["headers"],
    )

    assert stranger.status_code == 404
    assert twice.status_code == 409


async def test_sketches_cannot_be_published(client: AsyncClient, people: dict) -> None:
    author = people["author"]
    _, diagram_id = await _diagram(
        client, author, diagram_type="freehand", content='{"version":1,"elements":[]}'
    )

    response = await client.post(
        f"{BASE}/diagrams",
        json={"diagram_id": diagram_id, "category": "uml"},
        headers=author["headers"],
    )

    assert response.status_code == 422


async def test_filters_tabs_and_search(client: AsyncClient, people: dict) -> None:
    author, visitor = people["author"], people["visitor"]
    _, d1 = await _diagram(client, author, title="Kafka pipeline")
    _, d2 = await _diagram(
        client, author, title="Schema", diagram_type="dbml", content="Table t { id int }"
    )
    p1 = await _publish(client, author, d1, category="devops", tags=["kafka"])
    await _publish(client, author, d2, category="databases")
    await client.put(f"{BASE}/diagrams/{p1['id']}/star", headers=visitor["headers"])

    def titles(page: dict) -> list[str]:
        return [i["title"] for i in page["items"]]

    def get(**params):
        return client.get(f"{BASE}/diagrams", params=params, headers=visitor["headers"])

    assert titles((await get(category="databases")).json()) == ["Schema"]
    assert titles((await get(type="mermaid")).json()) == ["Kafka pipeline"]
    assert titles((await get(q="KAFKA")).json()) == ["Kafka pipeline"]
    assert titles((await get(q="ana autora", sort="recent")).json()) == ["Schema", "Kafka pipeline"]
    starred = (await get(tab="starred")).json()
    assert titles(starred) == ["Kafka pipeline"] and starred["items"][0]["starred_by_me"]
    assert (await get(tab="mine")).json()["total"] == 0


async def test_stars_are_idempotent(client: AsyncClient, people: dict) -> None:
    author, visitor = people["author"], people["visitor"]
    _, diagram_id = await _diagram(client, author)
    pub = await _publish(client, author, diagram_id)
    url = f"{BASE}/diagrams/{pub['id']}/star"

    first = (await client.put(url, headers=visitor["headers"])).json()
    again = (await client.put(url, headers=visitor["headers"])).json()
    removed = (await client.delete(url, headers=visitor["headers"])).json()
    removed_again = (await client.delete(url, headers=visitor["headers"])).json()

    assert (first["stars_count"], again["stars_count"]) == (1, 1)
    assert (removed["stars_count"], removed_again["stars_count"]) == (0, 0)
    stored = await PublishedDiagramInDB.find_one()
    assert stored.stars_count == 0


async def test_fork_copies_into_the_users_project_with_attribution(
    client: AsyncClient, people: dict
) -> None:
    author, visitor = people["author"], people["visitor"]
    _, diagram_id = await _diagram(client, author, content="graph LR\n  X-->Y")
    pub = await _publish(client, author, diagram_id)
    project = await client.post(
        "/api/v1/projects", json={"name": "Visitor", "emoji": "🧪"}, headers=visitor["headers"]
    )

    response = await client.post(
        f"{BASE}/diagrams/{pub['id']}/fork",
        json={"project_id": project.json()["id"], "title": "My copy"},
        headers=visitor["headers"],
    )

    assert response.status_code == 201, response.text
    fork = (
        await client.get(
            f"/api/v1/diagrams/{response.json()['diagram_id']}", headers=visitor["headers"]
        )
    ).json()
    assert fork["title"] == "My copy" and fork["content"] == "graph LR\n  X-->Y"
    assert "Fork of “Checkout” by Ana Autora (CC BY 4.0)" in fork["description"]
    assert (await PublishedDiagramInDB.find_one()).forks_count == 1
    record = await CommunityForkInDB.find_one()
    assert (record.publication_id, record.publication_owner_id) == (pub["id"], author["id"])
    assert (record.user_id, record.diagram_id) == (visitor["id"], fork["id"])


async def test_everything_published_is_public_and_forkable(
    client: AsyncClient, people: dict
) -> None:
    author, visitor = people["author"], people["visitor"]
    _, diagram_id = await _diagram(client, author)
    # Old clients may still send a license or turn forks off: both are ignored.
    pub = await _publish(
        client, author, diagram_id, license="all-rights-reserved", allow_forks=False
    )
    author_project, _ = await _diagram(client, author, title="Author's other")
    visitor_project, _ = await _diagram(client, visitor)

    forked = await client.post(
        f"{BASE}/diagrams/{pub['id']}/fork",
        json={"project_id": visitor_project},
        headers=visitor["headers"],
    )
    foreign_project = await client.post(
        f"{BASE}/diagrams/{pub['id']}/fork",
        json={"project_id": author_project},
        headers=visitor["headers"],
    )

    assert pub["license"] == "cc-by-4.0" and "allow_forks" not in pub
    assert forked.status_code == 201, forked.text
    assert foreign_project.status_code == 403


async def test_a_published_fork_credits_its_original(client: AsyncClient, people: dict) -> None:
    author, visitor = people["author"], people["visitor"]
    _, diagram_id = await _diagram(client, author)
    original = await _publish(client, author, diagram_id)
    visitor_project, _ = await _diagram(client, visitor)
    fork = await client.post(
        f"{BASE}/diagrams/{original['id']}/fork",
        json={"project_id": visitor_project, "title": "Checkout v2"},
        headers=visitor["headers"],
    )
    republished = await _publish(client, visitor, fork.json()["diagram_id"])

    await client.delete(f"{BASE}/diagrams/{original['id']}", headers=author["headers"])
    after_removal = (
        await client.get(f"{BASE}/diagrams/{republished['id']}", headers=author["headers"])
    ).json()
    await CommunityRepository().delete_user_data(author["id"])

    assert original["forked_from"] is None
    assert republished["forked_from"] == {
        "publication_id": original["id"],
        "title": "Checkout",
        "owner_name": "Ana Autora",
    }
    assert after_removal["forked_from"] == {
        "publication_id": None,
        "title": "Checkout",
        "owner_name": "Ana Autora",
    }
    assert await CommunityForkInDB.count() == 0


async def test_comments_replies_and_deletion(client: AsyncClient, people: dict) -> None:
    author, visitor, admin = people["author"], people["visitor"], people["admin"]
    _, diagram_id = await _diagram(client, author)
    pub = await _publish(client, author, diagram_id)
    url = f"{BASE}/diagrams/{pub['id']}/comments"

    top = (await client.post(url, json={"text": "Nice!"}, headers=visitor["headers"])).json()
    reply = (
        await client.post(
            url, json={"text": "Thanks", "parent_id": top["id"]}, headers=author["headers"]
        )
    ).json()
    nested = (
        await client.post(
            url, json={"text": "Deep", "parent_id": reply["id"]}, headers=visitor["headers"]
        )
    ).json()
    listed = (await client.get(url, headers=visitor["headers"])).json()

    assert reply["parent_id"] == top["id"] and reply["is_publication_owner"] is True
    assert nested["parent_id"] == top["id"]  # replies stay one level deep
    assert [c["text"] for c in listed] == ["Nice!", "Thanks", "Deep"]
    assert [c["can_delete"] for c in listed] == [True, False, True]
    # The publication's owner can delete any comment; it takes its replies with it.
    deleted = await client.delete(f"{url}/{top['id']}", headers=author["headers"])
    assert deleted.status_code == 204
    assert (await client.get(url, headers=admin["headers"])).json() == []
    assert (await PublishedDiagramInDB.find_one()).comments_count == 0


async def test_comments_can_be_turned_off(client: AsyncClient, people: dict) -> None:
    author, visitor = people["author"], people["visitor"]
    _, diagram_id = await _diagram(client, author)
    pub = await _publish(client, author, diagram_id, allow_comments=False)

    response = await client.post(
        f"{BASE}/diagrams/{pub['id']}/comments", json={"text": "Hi"}, headers=visitor["headers"]
    )

    assert response.status_code == 403


async def test_reports_hide_a_publication_until_an_admin_restores_it(
    client: AsyncClient, people: dict
) -> None:
    author, admin = people["author"], people["admin"]
    _, diagram_id = await _diagram(client, author)
    pub = await _publish(client, author, diagram_id)
    reporters = [await _user(client, f"Reporter {i}") for i in range(3)]

    for reporter in reporters:
        r = await client.post(
            f"{BASE}/reports",
            json={"target_type": "diagram", "target_id": pub["id"], "reason": "spam"},
            headers=reporter["headers"],
        )
        assert r.status_code == 204

    hidden_for_others = await client.get(
        f"{BASE}/diagrams/{pub['id']}", headers=reporters[0]["headers"]
    )
    visible_to_owner = await client.get(f"{BASE}/diagrams/{pub['id']}", headers=author["headers"])
    reports = (await client.get(f"{BASE}/admin/reports", headers=admin["headers"])).json()
    restored = await client.put(
        f"{BASE}/admin/diagrams/{pub['id']}", json={"hidden": False}, headers=admin["headers"]
    )

    assert hidden_for_others.status_code == 404
    assert visible_to_owner.json()["hidden"] is True
    assert len(reports) == 3 and reports[0]["publication_title"] == "Checkout"
    assert restored.status_code == 200 and restored.json()["hidden"] is False
    assert (await client.get(f"{BASE}/admin/reports", headers=admin["headers"])).json() == []
    assert (
        await client.get(f"{BASE}/diagrams/{pub['id']}", headers=reporters[0]["headers"])
    ).status_code == 200


async def test_admin_features_and_only_admins_moderate(client: AsyncClient, people: dict) -> None:
    author, visitor, admin = people["author"], people["visitor"], people["admin"]
    _, diagram_id = await _diagram(client, author)
    pub = await _publish(client, author, diagram_id)

    forbidden = await client.put(
        f"{BASE}/admin/diagrams/{pub['id']}", json={"featured": True}, headers=visitor["headers"]
    )
    featured = await client.put(
        f"{BASE}/admin/diagrams/{pub['id']}", json={"featured": True}, headers=admin["headers"]
    )
    tab = (
        await client.get(f"{BASE}/diagrams", params={"tab": "featured"}, headers=visitor["headers"])
    ).json()

    assert forbidden.status_code == 403
    assert featured.json()["featured"] is True
    assert [i["id"] for i in tab["items"]] == [pub["id"]]


async def test_publications_always_follow_their_diagram(client: AsyncClient, people: dict) -> None:
    author, visitor = people["author"], people["visitor"]
    _, diagram_id = await _diagram(client, author, description="v1")
    # Old clients may still send their own description or auto_update: ignored.
    pub = await _publish(client, author, diagram_id, description="other", auto_update=False)
    await client.put(f"{BASE}/diagrams/{pub['id']}/star", headers=visitor["headers"])

    await client.put(
        f"/api/v1/diagrams/{diagram_id}",
        json={"title": "Checkout v2", "content": "graph TD\n  New-->Code", "description": "v2"},
        headers=author["headers"],
    )
    # The grid is up to date without anyone opening the publication first.
    grid = (await client.get(f"{BASE}/diagrams", headers=visitor["headers"])).json()["items"]
    detail = (await client.get(f"{BASE}/diagrams/{pub['id']}", headers=visitor["headers"])).json()
    by_diagram = (
        await client.get(f"{BASE}/by-diagram/{diagram_id}", headers=author["headers"])
    ).json()
    found = (
        await client.get(f"{BASE}/diagrams", params={"q": "v2"}, headers=visitor["headers"])
    ).json()["items"]

    await client.delete(f"/api/v1/diagrams/{diagram_id}", headers=author["headers"])
    after_delete = (
        await client.get(f"{BASE}/diagrams/{pub['id']}", headers=visitor["headers"])
    ).json()

    assert pub["description"] == "v1" and "auto_update" not in pub
    assert (grid[0]["title"], grid[0]["content"]) == ("Checkout v2", "graph TD\n  New-->Code")
    assert (detail["title"], detail["description"]) == ("Checkout v2", "v2")
    assert by_diagram["title"] == "Checkout v2"
    assert [i["id"] for i in found] == [pub["id"]]
    assert detail["stars_count"] == 1  # syncing never overwrites counters
    assert after_delete["content"] == "graph TD\n  New-->Code"  # last version stays


async def test_owner_changes_settings_and_unpublishes(client: AsyncClient, people: dict) -> None:
    author, visitor = people["author"], people["visitor"]
    _, diagram_id = await _diagram(client, author)
    pub = await _publish(client, author, diagram_id)

    not_owner = await client.put(
        f"{BASE}/diagrams/{pub['id']}", json={"category": "uml"}, headers=visitor["headers"]
    )
    updated = (
        await client.put(
            f"{BASE}/diagrams/{pub['id']}",
            json={"category": "uml", "tags": ["A b", "c"], "allow_comments": False},
            headers=author["headers"],
        )
    ).json()
    stored = await PublishedDiagramInDB.find_one()
    removed = await client.delete(f"{BASE}/diagrams/{pub['id']}", headers=author["headers"])

    assert not_owner.status_code == 404
    assert (updated["category"], updated["tags"]) == ("uml", ["a-b", "c"])
    assert updated["allow_comments"] is False
    assert (stored.category, stored.allow_comments) == ("uml", False)
    assert removed.status_code == 204
    assert await PublishedDiagramInDB.count() == 0


async def test_by_diagram_lookup_is_owner_only(client: AsyncClient, people: dict) -> None:
    author, visitor = people["author"], people["visitor"]
    _, diagram_id = await _diagram(client, author)
    pub = await _publish(client, author, diagram_id)

    mine = (await client.get(f"{BASE}/by-diagram/{diagram_id}", headers=author["headers"])).json()
    theirs = (
        await client.get(f"{BASE}/by-diagram/{diagram_id}", headers=visitor["headers"])
    ).json()

    assert mine["id"] == pub["id"]
    assert theirs is None


async def test_too_many_tags_are_rejected(client: AsyncClient, people: dict) -> None:
    author = people["author"]
    _, diagram_id = await _diagram(client, author)

    response = await client.post(
        f"{BASE}/diagrams",
        json={"diagram_id": diagram_id, "category": "uml", "tags": list("abcdef")},
        headers=author["headers"],
    )

    assert response.status_code == 422


async def test_my_published_lists_the_users_published_diagrams(
    client: AsyncClient, people: dict
) -> None:
    author, visitor, admin = people["author"], people["visitor"], people["admin"]
    _, published = await _diagram(client, author)
    _, hidden = await _diagram(client, author, title="Hidden")
    await _diagram(client, author, title="Private")
    pub = await _publish(client, author, published)
    hidden_pub = await _publish(client, author, hidden)
    await client.put(
        f"{BASE}/admin/diagrams/{hidden_pub['id']}",
        json={"hidden": True},
        headers=admin["headers"],
    )

    mine = (await client.get(f"{BASE}/my-published", headers=author["headers"])).json()
    theirs = (await client.get(f"{BASE}/my-published", headers=visitor["headers"])).json()

    assert sorted(mine, key=lambda x: x["diagram_id"]) == sorted(
        [
            {"diagram_id": published, "publication_id": pub["id"], "hidden": False},
            {"diagram_id": hidden, "publication_id": hidden_pub["id"], "hidden": True},
        ],
        key=lambda x: x["diagram_id"],
    )
    assert theirs == []


async def test_anonymous_visitors_browse_read_and_see_comments(
    client: AsyncClient, people: dict
) -> None:
    author, visitor, admin = people["author"], people["visitor"], people["admin"]
    _, d1 = await _diagram(client, author)
    _, d2 = await _diagram(client, author, title="Hidden one")
    pub = await _publish(client, author, d1)
    hidden = await _publish(client, author, d2)
    await client.put(
        f"{BASE}/admin/diagrams/{hidden['id']}", json={"hidden": True}, headers=admin["headers"]
    )
    await client.put(f"{BASE}/diagrams/{pub['id']}/star", headers=visitor["headers"])
    await client.post(
        f"{BASE}/diagrams/{pub['id']}/comments", json={"text": "Hi"}, headers=visitor["headers"]
    )

    grid = await client.get(f"{BASE}/diagrams")
    detail = await client.get(f"{BASE}/diagrams/{pub['id']}")
    comments = await client.get(f"{BASE}/diagrams/{pub['id']}/comments")
    hidden_detail = await client.get(f"{BASE}/diagrams/{hidden['id']}")
    mine = await client.get(f"{BASE}/diagrams", params={"tab": "mine"})
    starred = await client.get(f"{BASE}/diagrams", params={"tab": "starred"})

    assert grid.status_code == 200
    assert [i["id"] for i in grid.json()["items"]] == [pub["id"]]
    assert grid.json()["items"][0]["starred_by_me"] is False
    assert detail.status_code == 200
    assert (detail.json()["is_owner"], detail.json()["source_diagram_id"]) == (False, None)
    assert detail.json()["views_count"] == 1
    assert [(c["text"], c["can_delete"]) for c in comments.json()] == [("Hi", False)]
    assert hidden_detail.status_code == 404
    assert (mine.status_code, starred.status_code) == (401, 401)


@pytest.mark.parametrize(
    "method, path, body",
    [
        ("PUT", "/diagrams/{id}/star", None),
        ("POST", "/diagrams/{id}/comments", {"text": "anon"}),
        ("POST", "/diagrams/{id}/fork", {"project_id": "x"}),
        ("POST", "/reports", {"target_type": "diagram", "target_id": "{id}", "reason": "spam"}),
        ("POST", "/diagrams", {"diagram_id": "x", "category": "uml"}),
        ("GET", "/my-published", None),
    ],
)
async def test_anything_that_saves_needs_sign_in(
    client: AsyncClient, people: dict, method: str, path: str, body: dict | None
) -> None:
    _, diagram_id = await _diagram(client, people["author"])
    pub = await _publish(client, people["author"], diagram_id)
    if body:
        body = {
            k: (v.replace("{id}", pub["id"]) if isinstance(v, str) else v) for k, v in body.items()
        }

    response = await client.request(method, BASE + path.replace("{id}", pub["id"]), json=body)

    assert response.status_code in (401, 403)


async def test_a_private_community_needs_sign_in(
    client: AsyncClient, people: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core.config import settings

    _, diagram_id = await _diagram(client, people["author"])
    pub = await _publish(client, people["author"], diagram_id)
    monkeypatch.setattr(settings, "COMMUNITY_PUBLIC", False)

    anonymous = await client.get(f"{BASE}/diagrams/{pub['id']}")
    signed_in = await client.get(
        f"{BASE}/diagrams/{pub['id']}", headers=people["visitor"]["headers"]
    )
    bad_token = await client.get(
        f"{BASE}/diagrams", headers={"Authorization": "Bearer not-a-token"}
    )

    assert anonymous.status_code == 401
    assert signed_in.status_code == 200
    assert bad_token.status_code == 401
