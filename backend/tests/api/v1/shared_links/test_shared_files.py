"""
Images of a shared freehand diagram (``GET /shared/{token}/files/{file_id}``).

Same rules as the shared diagram view: active, not expired, and for protected
links the access code (proven by the ``file_token`` that ``/verify`` returns).
"""

from datetime import timedelta

import pytest
from httpx import AsyncClient

from app.api.v1.shared_links import services as share_services
from app.api.v1.shared_links.public_routes import get_file_rate_limiter
from app.api.v1.shared_links.schemas import SharedLinkInDB
from app.core.clock import utcnow
from tests.api.v1.diagram_files.helpers import make_diagram, make_user, png, scene, sha, upload

pytestmark = pytest.mark.integration

ACCESS_CODE = "Abc123"


async def _shared_sketch(client: AsyncClient, **link_fields) -> dict:
    """An owner, a freehand diagram with one image, and a shared link to it."""
    owner = await make_user(client, "Olga Owner")
    data = png()
    diagram_id = await make_diagram(client, owner, content=scene(sha(data)))
    assert (await upload(client, owner, diagram_id, data)).status_code == 201
    link = await client.post(
        "/api/v1/shared-links",
        json={"diagram_id": diagram_id, **link_fields},
        headers=owner["headers"],
    )
    assert link.status_code in (200, 201), link.text
    return {
        "owner": owner,
        "diagram_id": diagram_id,
        "data": data,
        "token": link.json()["token"],
        "link_id": link.json()["id"],
    }


def _url(token: str, file_id: str) -> str:
    return f"/api/v1/shared/{token}/files/{file_id}"


async def test_public_link_serves_its_images(client: AsyncClient) -> None:
    shared = await _shared_sketch(client)

    response = await client.get(_url(shared["token"], sha(shared["data"])))

    assert response.status_code == 200
    assert response.content == shared["data"]
    assert response.headers["content-type"] == "image/png"
    assert response.headers["cache-control"] == "public, max-age=86400"
    assert response.headers["x-content-type-options"] == "nosniff"


async def test_only_the_links_own_diagram(client: AsyncClient) -> None:
    shared = await _shared_sketch(client)
    owner = shared["owner"]
    other_data = png()
    other_diagram = await make_diagram(client, owner, content=scene(sha(other_data)))
    await upload(client, owner, other_diagram, other_data)

    response = await client.get(_url(shared["token"], sha(other_data)))

    assert response.status_code == 404


async def test_unknown_or_malformed_ids_are_404(client: AsyncClient) -> None:
    shared = await _shared_sketch(client)

    assert (await client.get(_url(shared["token"], "a" * 64))).status_code == 404
    assert (await client.get(_url(shared["token"], "not-a-hash"))).status_code == 404
    assert (await client.get(_url("no-such-token", sha(shared["data"])))).status_code == 404


async def test_protected_link_needs_the_file_token(client: AsyncClient) -> None:
    shared = await _shared_sketch(client, access_type="protected", access_code=ACCESS_CODE)
    url = _url(shared["token"], sha(shared["data"]))

    without = await client.get(url)
    forged = await client.get(url, params={"file_token": f"{10**12}.{'0' * 64}"})
    verified = await client.post(
        f"/api/v1/shared/{shared['token']}/verify", json={"access_code": ACCESS_CODE}
    )
    file_token = verified.json()["file_token"]
    with_token = await client.get(url, params={"file_token": file_token})

    assert without.status_code == 403
    assert without.json()["detail"] == {"error": "access_code_required"}
    assert forged.status_code == 403
    assert verified.status_code == 200 and file_token
    assert with_token.status_code == 200
    assert with_token.content == shared["data"]
    assert with_token.headers["cache-control"] == "private, max-age=3600"


async def test_public_link_gets_no_file_token(client: AsyncClient) -> None:
    shared = await _shared_sketch(client)

    response = await client.get(f"/api/v1/shared/{shared['token']}/diagram")

    assert response.status_code == 200
    assert response.json()["file_token"] is None


async def test_file_token_ends_when_the_code_changes(client: AsyncClient) -> None:
    shared = await _shared_sketch(client, access_type="protected", access_code=ACCESS_CODE)
    url = _url(shared["token"], sha(shared["data"]))
    verified = await client.post(
        f"/api/v1/shared/{shared['token']}/verify", json={"access_code": ACCESS_CODE}
    )
    file_token = verified.json()["file_token"]

    changed = await client.put(
        f"/api/v1/shared-links/{shared['link_id']}",
        json={"access_code": "Xyz789"},
        headers=shared["owner"]["headers"],
    )

    assert changed.status_code == 200, changed.text
    assert (await client.get(url, params={"file_token": file_token})).status_code == 403


async def test_file_token_expires(client: AsyncClient, monkeypatch) -> None:
    shared = await _shared_sketch(client, access_type="protected", access_code=ACCESS_CODE)
    verified = await client.post(
        f"/api/v1/shared/{shared['token']}/verify", json={"access_code": ACCESS_CODE}
    )
    file_token = verified.json()["file_token"]
    later = share_services._epoch_now() + share_services.FILE_TOKEN_TTL_SECONDS + 1
    monkeypatch.setattr(share_services, "_epoch_now", lambda: later)

    response = await client.get(
        _url(shared["token"], sha(shared["data"])), params={"file_token": file_token}
    )

    assert response.status_code == 403


async def test_a_token_of_another_link_does_not_work(client: AsyncClient) -> None:
    first = await _shared_sketch(client, access_type="protected", access_code=ACCESS_CODE)
    second = await _shared_sketch(client, access_type="protected", access_code=ACCESS_CODE)
    verified = await client.post(
        f"/api/v1/shared/{first['token']}/verify", json={"access_code": ACCESS_CODE}
    )

    response = await client.get(
        _url(second["token"], sha(second["data"])),
        params={"file_token": verified.json()["file_token"]},
    )

    assert response.status_code == 403


async def test_revoked_link_is_404(client: AsyncClient) -> None:
    shared = await _shared_sketch(client)
    revoked = await client.delete(
        f"/api/v1/shared-links/{shared['link_id']}", headers=shared["owner"]["headers"]
    )
    assert revoked.status_code == 200, revoked.text

    response = await client.get(_url(shared["token"], sha(shared["data"])))

    assert response.status_code == 404


async def test_expired_link_is_gone(client: AsyncClient) -> None:
    """Like the diagram view, an expired link answers 410."""
    shared = await _shared_sketch(client)
    link = await SharedLinkInDB.find_one(SharedLinkInDB.token == shared["token"])
    link.expires_at = utcnow() - timedelta(minutes=1)
    await link.save()

    response = await client.get(_url(shared["token"], sha(shared["data"])))

    assert response.status_code == 410


async def test_deleted_diagram_takes_its_images(client: AsyncClient) -> None:
    shared = await _shared_sketch(client)
    await client.delete(
        f"/api/v1/diagrams/{shared['diagram_id']}", headers=shared["owner"]["headers"]
    )

    response = await client.get(_url(shared["token"], sha(shared["data"])))

    # Deleting the diagram revokes its link.
    assert response.status_code == 404


async def test_images_are_rate_limited(client: AsyncClient, monkeypatch) -> None:
    shared = await _shared_sketch(client)
    monkeypatch.setattr(get_file_rate_limiter(), "max_requests", 2)
    url = _url(shared["token"], sha(shared["data"]))

    statuses = [(await client.get(url)).status_code for _ in range(3)]

    assert statuses == [200, 200, 429]
