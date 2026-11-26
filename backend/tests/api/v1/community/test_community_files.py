"""
Images of community publications: copied on publish, served publicly with the
publication's visibility, copied on fork, deleted on unpublish.

Freehand sketches aren't publishable today (``PUBLISHABLE_TYPES``); the file
handling is type-agnostic, so these tests let ``freehand`` through.
"""

import pytest
from httpx import AsyncClient

from app.api.v1.community import services as community_services
from app.api.v1.diagram_files.schemas import DiagramFileInDB, FileScope
from app.core.config import settings
from tests.api.v1.diagram_files.helpers import (
    make_diagram,
    make_user,
    png,
    scene,
    set_content,
    sha,
    upload,
)

pytestmark = pytest.mark.integration

BASE = "/api/v1/community"


@pytest.fixture(autouse=True)
def _publishable_sketches(monkeypatch):
    """Let freehand diagrams be published, without the renderer check."""

    async def _always_publishable(self, diagram_type: str, content: str) -> None:
        return None

    monkeypatch.setattr(
        community_services, "PUBLISHABLE_TYPES", community_services.PUBLISHABLE_TYPES | {"freehand"}
    )
    monkeypatch.setattr(
        community_services.CommunityService, "_check_publishable", _always_publishable
    )
    community_services.publish_limiter.reset()
    yield


@pytest.fixture
async def people(client: AsyncClient) -> dict:
    """The first user registered is the admin (installation)."""
    return {
        "admin": await make_user(client, "Ada Admin"),
        "author": await make_user(client, "Ana Autora"),
        "visitor": await make_user(client, "Vic Visitante"),
    }


async def _published_sketch(client: AsyncClient, author: dict) -> dict:
    """A freehand diagram with two images (one in use), published."""
    used, unused = png(), png()
    diagram_id = await make_diagram(client, author, content=scene(sha(used)))
    await upload(client, author, diagram_id, used)
    await upload(client, author, diagram_id, unused)
    response = await client.post(
        f"{BASE}/diagrams",
        json={"diagram_id": diagram_id, "category": "architecture"},
        headers=author["headers"],
    )
    assert response.status_code == 201, response.text
    return {
        "diagram_id": diagram_id,
        "publication_id": response.json()["id"],
        "used": used,
        "unused": unused,
    }


async def _publication_files(publication_id: str) -> set[str]:
    files = await DiagramFileInDB.find(
        {"scope": FileScope.PUBLICATION.value, "scope_id": publication_id}
    ).to_list()
    return {f.file_id for f in files}


def _url(publication_id: str, file_id: str) -> str:
    return f"{BASE}/{publication_id}/files/{file_id}"


async def test_publish_copies_the_images_in_use(client: AsyncClient, people: dict) -> None:
    sketch = await _published_sketch(client, people["author"])

    assert await _publication_files(sketch["publication_id"]) == {sha(sketch["used"])}


async def test_anyone_can_read_a_visible_publications_images(
    client: AsyncClient, people: dict
) -> None:
    sketch = await _published_sketch(client, people["author"])
    url = _url(sketch["publication_id"], sha(sketch["used"]))

    anonymous = await client.get(url)
    visitor = await client.get(url, headers=people["visitor"]["headers"])
    not_copied = await client.get(_url(sketch["publication_id"], sha(sketch["unused"])))

    assert anonymous.status_code == 200
    assert anonymous.content == sketch["used"]
    assert anonymous.headers["cache-control"] == "public, max-age=86400"
    assert anonymous.headers["x-content-type-options"] == "nosniff"
    assert visitor.status_code == 200
    assert not_copied.status_code == 404


async def test_closed_community_needs_sign_in(
    client: AsyncClient, people: dict, monkeypatch
) -> None:
    sketch = await _published_sketch(client, people["author"])
    monkeypatch.setattr(settings, "COMMUNITY_PUBLIC", False)
    url = _url(sketch["publication_id"], sha(sketch["used"]))

    anonymous = await client.get(url)
    member = await client.get(url, headers=people["visitor"]["headers"])

    assert anonymous.status_code == 401
    assert member.status_code == 200
    assert member.headers["cache-control"] == "private, max-age=3600"


async def test_images_outlive_the_source_diagram(client: AsyncClient, people: dict) -> None:
    author = people["author"]
    sketch = await _published_sketch(client, author)

    deleted = await client.delete(
        f"/api/v1/diagrams/{sketch['diagram_id']}", headers=author["headers"]
    )
    response = await client.get(_url(sketch["publication_id"], sha(sketch["used"])))

    assert deleted.status_code == 200
    assert response.status_code == 200
    assert response.content == sketch["used"]


async def test_images_follow_the_diagram_after_publishing(
    client: AsyncClient, people: dict
) -> None:
    author = people["author"]
    sketch = await _published_sketch(client, author)
    added = png()
    await upload(client, author, sketch["diagram_id"], added)
    # The scene now uses the new image instead of the first one.
    await set_content(client, author, sketch["diagram_id"], scene(sha(added)))

    response = await client.get(_url(sketch["publication_id"], sha(added)))

    assert response.status_code == 200
    assert response.content == added
    # Reading the publication synced its files: the old image is gone.
    assert await _publication_files(sketch["publication_id"]) == {sha(added)}


async def test_hidden_publication_hides_its_images(client: AsyncClient, people: dict) -> None:
    sketch = await _published_sketch(client, people["author"])
    hidden = await client.put(
        f"{BASE}/admin/diagrams/{sketch['publication_id']}",
        json={"hidden": True},
        headers=people["admin"]["headers"],
    )
    assert hidden.status_code == 200, hidden.text
    url = _url(sketch["publication_id"], sha(sketch["used"]))

    anonymous = await client.get(url)
    visitor = await client.get(url, headers=people["visitor"]["headers"])
    owner = await client.get(url, headers=people["author"]["headers"])

    assert anonymous.status_code == 404
    assert visitor.status_code == 404
    assert owner.status_code == 200
    assert owner.headers["cache-control"] == "private, max-age=3600"


async def test_unknown_publication_or_file_is_404(client: AsyncClient, people: dict) -> None:
    sketch = await _published_sketch(client, people["author"])

    assert (await client.get(_url("000000000000000000000000", "a" * 64))).status_code == 404
    assert (await client.get(_url(sketch["publication_id"], "a" * 64))).status_code == 404
    assert (await client.get(_url(sketch["publication_id"], "../x"))).status_code == 404


async def test_fork_copies_the_images(client: AsyncClient, people: dict) -> None:
    author, visitor = people["author"], people["visitor"]
    sketch = await _published_sketch(client, author)
    project = await client.post(
        "/api/v1/projects", json={"name": "Forks", "emoji": "📁"}, headers=visitor["headers"]
    )

    fork = await client.post(
        f"{BASE}/diagrams/{sketch['publication_id']}/fork",
        json={"project_id": project.json()["id"]},
        headers=visitor["headers"],
    )

    assert fork.status_code == 201, fork.text
    fork_id = fork.json()["diagram_id"]
    read = await client.get(
        f"/api/v1/diagrams/{fork_id}/files/{sha(sketch['used'])}", headers=visitor["headers"]
    )
    assert read.status_code == 200 and read.content == sketch["used"]
    copy = await DiagramFileInDB.find_one({"scope": FileScope.DIAGRAM.value, "scope_id": fork_id})
    assert copy.owner_id == visitor["id"]


async def test_unpublish_deletes_the_publications_images(client: AsyncClient, people: dict) -> None:
    author = people["author"]
    sketch = await _published_sketch(client, author)

    response = await client.delete(
        f"{BASE}/diagrams/{sketch['publication_id']}", headers=author["headers"]
    )

    assert response.status_code == 204, response.text
    assert await _publication_files(sketch["publication_id"]) == set()
    assert (
        await client.get(_url(sketch["publication_id"], sha(sketch["used"])))
    ).status_code == 404
    # The diagram keeps its own images.
    own = await client.get(
        f"/api/v1/diagrams/{sketch['diagram_id']}/files/{sha(sketch['used'])}",
        headers=author["headers"],
    )
    assert own.status_code == 200
