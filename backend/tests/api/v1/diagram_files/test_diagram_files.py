"""
Images of freehand diagrams: upload, read, limits, cleanup and cascades.
"""

from datetime import timedelta

import pytest
from httpx import AsyncClient

from app.api.v1.api_tokens.permissions import AccessLevel, ApiKeyArea, required_access
from app.api.v1.diagram_files import services as file_services
from app.api.v1.diagram_files.schemas import DiagramFileInDB, FileScope
from app.api.v1.diagram_files.services import referenced_file_ids, sniff_image_type
from app.api.v1.users.schemas import UserInDB, UserRole
from app.core.config import settings

from .helpers import (
    gif,
    make_diagram,
    make_user,
    png,
    scene,
    set_content,
    sha,
    upload,
    webp,
)

pytestmark = pytest.mark.integration


async def _stored(diagram_id: str) -> set[str]:
    files = await DiagramFileInDB.find(
        {"scope": FileScope.DIAGRAM.value, "scope_id": diagram_id}
    ).to_list()
    return {f.file_id for f in files}


# --------------------------------------------------------------------------- #
#  Upload and read
# --------------------------------------------------------------------------- #


async def test_upload_then_read_back(client: AsyncClient) -> None:
    owner = await make_user(client, "Olga Owner")
    diagram_id = await make_diagram(client, owner)
    data = png(500)

    created = await upload(client, owner, diagram_id, data)

    assert created.status_code == 201, created.text
    assert created.json() == {"file_id": sha(data), "mime_type": "image/png", "size": len(data)}

    response = await client.get(
        f"/api/v1/diagrams/{diagram_id}/files/{sha(data)}", headers=owner["headers"]
    )
    assert response.status_code == 200
    assert response.content == data
    assert response.headers["content-type"] == "image/png"
    assert response.headers["cache-control"] == "private, max-age=31536000, immutable"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["content-disposition"] == "inline"


async def test_same_image_twice_is_stored_once(client: AsyncClient) -> None:
    owner = await make_user(client, "Olga Owner")
    diagram_id = await make_diagram(client, owner)
    data = png()

    first = await upload(client, owner, diagram_id, data)
    again = await upload(client, owner, diagram_id, data)

    assert first.status_code == 201
    assert again.status_code == 200
    assert again.json() == first.json()
    assert await DiagramFileInDB.find({"file_id": sha(data)}).count() == 1


@pytest.mark.parametrize(
    "make, mime",
    [(webp, "image/webp"), (gif, "image/gif"), (lambda: b"\xff\xd8\xff" + b"j" * 40, "image/jpeg")],
)
async def test_type_comes_from_the_bytes(client: AsyncClient, make, mime: str) -> None:
    owner = await make_user(client, "Olga Owner")
    diagram_id = await make_diagram(client, owner)

    # The declared type is ignored: the bytes decide.
    response = await upload(client, owner, diagram_id, make(), content_type="text/plain")

    assert response.status_code == 201, response.text
    assert response.json()["mime_type"] == mime


@pytest.mark.parametrize(
    "data, declared",
    [
        (
            b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
            "image/svg+xml",
        ),
        (b"<html><body>hi</body></html>", "image/png"),
        (b"just some text", "image/png"),
        (b"", "image/png"),
    ],
)
async def test_non_images_are_rejected(client: AsyncClient, data: bytes, declared: str) -> None:
    owner = await make_user(client, "Olga Owner")
    diagram_id = await make_diagram(client, owner)

    response = await upload(client, owner, diagram_id, data, content_type=declared)

    assert response.status_code == 415
    assert response.json()["detail"] == {"error": "unsupported_file_type"}
    assert await DiagramFileInDB.find_all().count() == 0


async def test_too_large_is_rejected(client: AsyncClient) -> None:
    owner = await make_user(client, "Olga Owner")
    diagram_id = await make_diagram(client, owner)

    just_over = await upload(client, owner, diagram_id, png(settings.DIAGRAM_FILE_MAX_BYTES + 1))
    way_over = await upload(client, owner, diagram_id, png(settings.DIAGRAM_FILE_MAX_BYTES * 2))

    assert just_over.status_code == 413
    assert just_over.json()["detail"] == {
        "error": "file_too_large",
        "limit": settings.DIAGRAM_FILE_MAX_BYTES,
    }
    # Far over the limit: the body limit stops it before it is read.
    assert way_over.status_code == 413
    assert await DiagramFileInDB.find_all().count() == 0


async def test_exactly_the_limit_is_accepted(client: AsyncClient) -> None:
    owner = await make_user(client, "Olga Owner")
    diagram_id = await make_diagram(client, owner)

    response = await upload(client, owner, diagram_id, png(settings.DIAGRAM_FILE_MAX_BYTES))

    assert response.status_code == 201, response.text
    assert response.json()["size"] == settings.DIAGRAM_FILE_MAX_BYTES


async def test_only_freehand_diagrams_take_files(client: AsyncClient) -> None:
    owner = await make_user(client, "Olga Owner")
    diagram_id = await make_diagram(
        client, owner, content="graph TD\n  A-->B", diagram_type="mermaid"
    )

    response = await upload(client, owner, diagram_id, png())

    assert response.status_code == 422
    assert response.json()["detail"] == {"error": "diagram_type_not_supported"}


async def test_strangers_get_404(client: AsyncClient) -> None:
    owner = await make_user(client, "Olga Owner")
    stranger = await make_user(client, "Sam Stranger")
    diagram_id = await make_diagram(client, owner)
    data = png()
    await upload(client, owner, diagram_id, data)

    upload_attempt = await upload(client, stranger, diagram_id, png())
    read_attempt = await client.get(
        f"/api/v1/diagrams/{diagram_id}/files/{sha(data)}", headers=stranger["headers"]
    )
    anonymous = await client.get(f"/api/v1/diagrams/{diagram_id}/files/{sha(data)}")

    assert upload_attempt.status_code == 404
    assert read_attempt.status_code == 404
    assert anonymous.status_code in (401, 403)
    assert await _stored(diagram_id) == {sha(data)}


@pytest.mark.parametrize(
    "file_id",
    ["../../etc/passwd", "ABCDEF" + "0" * 58, "0" * 63, "g" * 64, "0" * 65],
)
async def test_malformed_or_unknown_ids_are_404(client: AsyncClient, file_id: str) -> None:
    owner = await make_user(client, "Olga Owner")
    diagram_id = await make_diagram(client, owner)

    response = await client.get(
        f"/api/v1/diagrams/{diagram_id}/files/{file_id}", headers=owner["headers"]
    )

    assert response.status_code == 404


async def test_unknown_file_and_diagram_are_404(client: AsyncClient) -> None:
    owner = await make_user(client, "Olga Owner")
    diagram_id = await make_diagram(client, owner)

    missing_file = await client.get(
        f"/api/v1/diagrams/{diagram_id}/files/{'a' * 64}", headers=owner["headers"]
    )
    missing_diagram = await upload(client, owner, "000000000000000000000000", png())

    assert missing_file.status_code == 404
    assert missing_diagram.status_code == 404


# --------------------------------------------------------------------------- #
#  Per-diagram cap and cleanup
# --------------------------------------------------------------------------- #


async def test_cap_collects_unused_files_first(client: AsyncClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "DIAGRAM_FILES_MAX_PER_DIAGRAM", 2)
    monkeypatch.setattr(file_services, "GC_GRACE_PERIOD", timedelta(0))
    owner = await make_user(client, "Olga Owner")
    diagram_id = await make_diagram(client, owner)
    kept, dropped, new, extra = png(), png(), png(), png()
    await upload(client, owner, diagram_id, kept)
    await upload(client, owner, diagram_id, dropped)
    # The scene only uses the first image now.
    await set_content(client, owner, diagram_id, scene(sha(kept)))

    response = await upload(client, owner, diagram_id, new)

    assert response.status_code == 201, response.text
    assert await _stored(diagram_id) == {sha(kept), sha(new)}

    # Both in use: nothing to collect, so the next one is refused.
    await set_content(client, owner, diagram_id, scene(sha(kept), sha(new)))
    refused = await upload(client, owner, diagram_id, extra)

    assert refused.status_code == 409
    assert refused.json()["detail"] == {"error": "diagram_files_limit", "limit": 2}
    # Re-uploading a file the diagram already has is still fine when full.
    assert (await upload(client, owner, diagram_id, kept)).status_code == 200


async def test_cleanup_spares_recent_uploads(client: AsyncClient, monkeypatch) -> None:
    """An image just placed on the canvas (scene not saved yet) is never collected."""
    monkeypatch.setattr(settings, "DIAGRAM_FILES_MAX_PER_DIAGRAM", 1)
    owner = await make_user(client, "Olga Owner")
    diagram_id = await make_diagram(client, owner)
    unsaved = png()
    await upload(client, owner, diagram_id, unsaved)

    refused = await upload(client, owner, diagram_id, png())

    assert refused.status_code == 409
    assert await _stored(diagram_id) == {sha(unsaved)}


def test_referenced_ids_is_a_substring_check() -> None:
    a, b = "a" * 64, "b" * 64
    assert referenced_file_ids(scene(a), [a, b]) == [a]
    assert referenced_file_ids(None, [a]) == []


def test_sniffing_never_recognises_svg() -> None:
    assert sniff_image_type(b"<svg></svg>") is None
    assert sniff_image_type(b"<?xml version='1.0'?><svg/>") is None
    assert sniff_image_type(png()) == "image/png"


# --------------------------------------------------------------------------- #
#  Cascades: duplicate copies, deletes remove
# --------------------------------------------------------------------------- #


async def test_duplicate_copies_the_files_in_use(client: AsyncClient) -> None:
    owner = await make_user(client, "Olga Owner")
    diagram_id = await make_diagram(client, owner)
    used, unused = png(), png()
    await upload(client, owner, diagram_id, used)
    await upload(client, owner, diagram_id, unused)
    await set_content(client, owner, diagram_id, scene(sha(used)))

    response = await client.post(
        f"/api/v1/diagrams/{diagram_id}/duplicate",
        json={"title": "Sketch-copy"},
        headers=owner["headers"],
    )

    assert response.status_code == 200, response.text
    copy_id = response.json()["id"]
    assert await _stored(copy_id) == {sha(used)}
    read = await client.get(
        f"/api/v1/diagrams/{copy_id}/files/{sha(used)}", headers=owner["headers"]
    )
    assert read.status_code == 200 and read.content == used
    # The copy is independent: deleting the original keeps its images.
    await client.delete(f"/api/v1/diagrams/{diagram_id}", headers=owner["headers"])
    assert await _stored(copy_id) == {sha(used)}


async def test_deleting_a_diagram_deletes_its_files(client: AsyncClient) -> None:
    owner = await make_user(client, "Olga Owner")
    diagram_id = await make_diagram(client, owner)
    other_id = await make_diagram(client, owner)
    data = png()
    await upload(client, owner, diagram_id, data)
    await upload(client, owner, other_id, data)

    response = await client.delete(f"/api/v1/diagrams/{diagram_id}", headers=owner["headers"])

    assert response.status_code == 200
    assert await _stored(diagram_id) == set()
    assert await _stored(other_id) == {sha(data)}


async def test_deleting_a_project_deletes_its_files(client: AsyncClient) -> None:
    owner = await make_user(client, "Olga Owner")
    first = await make_diagram(client, owner)
    second = await make_diagram(client, owner)
    await upload(client, owner, first, png())
    await upload(client, owner, second, png())

    response = await client.delete(
        f"/api/v1/projects/{owner['project_id']}", headers=owner["headers"]
    )

    assert response.status_code == 200, response.text
    assert await DiagramFileInDB.find_all().count() == 0


async def test_deleting_a_folder_with_its_diagrams_deletes_their_files(
    client: AsyncClient,
) -> None:
    owner = await make_user(client, "Olga Owner")
    outside = await make_diagram(client, owner)
    folder = await client.post(
        f"/api/v1/projects/{owner['project_id']}/folders",
        json={"name": "Ideas", "color": "#3B82F6"},
        headers=owner["headers"],
    )
    assert folder.status_code == 201, folder.text
    folder_id = folder.json()["id"]
    inside = await make_diagram(client, owner, folder_id=folder_id)
    await upload(client, owner, outside, png())
    await upload(client, owner, inside, png())

    response = await client.delete(
        f"/api/v1/folders/{folder_id}",
        params={"delete_diagrams": "true"},
        headers=owner["headers"],
    )

    assert response.status_code == 200, response.text
    assert await _stored(inside) == set()
    assert len(await _stored(outside)) == 1


async def test_deleting_the_account_deletes_every_file(client: AsyncClient) -> None:
    await make_user(client, "Ada Admin")  # the first user is the admin, who can't leave
    owner = await make_user(client, "Olga Owner")
    other = await make_user(client, "Otto Other")
    diagram_id = await make_diagram(client, owner)
    others_diagram = await make_diagram(client, other)
    await upload(client, owner, diagram_id, png())
    await upload(client, other, others_diagram, png())

    response = await client.request(
        "DELETE",
        "/api/v1/users/me",
        json={"confirmation_phrase": "delete me"},
        headers=owner["headers"],
    )

    assert response.status_code == 200, response.text
    assert await DiagramFileInDB.find({"owner_id": owner["id"]}).count() == 0
    assert await _stored(others_diagram) != set()


async def test_admin_deleting_a_user_deletes_their_files(client: AsyncClient) -> None:
    admin = await make_user(client, "Ada Admin")
    user = await UserInDB.get(admin["id"])
    assert user.role == UserRole.ADMIN
    owner = await make_user(client, "Olga Owner")
    diagram_id = await make_diagram(client, owner)
    await upload(client, owner, diagram_id, png())
    owner_doc = await UserInDB.get(owner["id"])

    response = await client.request(
        "DELETE",
        f"/api/v1/users/admin/{owner['id']}",
        json={"confirm_email": owner_doc.email},
        headers=admin["headers"],
    )

    assert response.status_code in (200, 204), response.text
    assert await DiagramFileInDB.find_all().count() == 0


# --------------------------------------------------------------------------- #
#  API keys
# --------------------------------------------------------------------------- #


@pytest.mark.unit
def test_api_keys_need_diagram_access() -> None:
    upload_needs = required_access("POST", "/diagrams/abc/files")
    read_needs = required_access("GET", f"/diagrams/abc/files/{'a' * 64}")

    assert upload_needs == {ApiKeyArea.DIAGRAMS: AccessLevel.WRITE}
    assert read_needs == {ApiKeyArea.DIAGRAMS: AccessLevel.READ}
    assert required_access("GET", f"/community/abc/files/{'a' * 64}") == {
        ApiKeyArea.COMMUNITY: AccessLevel.READ
    }
