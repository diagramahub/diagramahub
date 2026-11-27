"""
Images of sketches in ZIP exports (``.files/<sha256>.<ext>``) and their
restoration on import.
"""

import hashlib
import io
import json
import zipfile

import pytest
from httpx import AsyncClient

from app.api.v1.diagram_files.schemas import DiagramFileInDB, FileScope
from app.api.v1.projects.export_service import export_rate_limiter, export_summary_rate_limiter
from app.api.v1.projects.import_parsers import (
    IMAGE_SKIPPED,
    ImportLimits,
    plan_zip_import,
)
from app.api.v1.projects.import_service import import_preview_rate_limiter, import_rate_limiter
from tests.api.v1.diagram_files.helpers import make_diagram, make_user, png, scene, sha, upload

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def _reset_rate_limiters():
    for limiter in (
        export_rate_limiter,
        export_summary_rate_limiter,
        import_rate_limiter,
        import_preview_rate_limiter,
    ):
        limiter.reset()
    yield


async def _sketch_with_images(client: AsyncClient, user: dict, *images: bytes, unused=()) -> str:
    """A sketch whose scene uses ``images``; ``unused`` are stored but not in the scene."""
    diagram_id = await make_diagram(client, user, content=scene(*(sha(i) for i in images)))
    for data in (*images, *unused):
        assert (await upload(client, user, diagram_id, data)).status_code in (200, 201)
    return diagram_id


async def _export(client: AsyncClient, user: dict, **params) -> zipfile.ZipFile:
    response = await client.get(
        f"/api/v1/projects/{user['project_id']}/export",
        params={"format": "zip", **params},
        headers=user["headers"],
    )
    assert response.status_code == 200, response.text
    return zipfile.ZipFile(io.BytesIO(response.content))


def _archive_bytes(archive: zipfile.ZipFile) -> bytes:
    """The bytes of an archive opened from memory."""
    archive.fp.seek(0)
    return archive.fp.read()


def _manifest(archive: zipfile.ZipFile) -> dict:
    [name] = [n for n in archive.namelist() if n.endswith("/manifest.json")]
    return json.loads(archive.read(name))


def _asset_names(archive: zipfile.ZipFile) -> set[str]:
    return {n.split("/", 1)[1] for n in archive.namelist() if "/.files/" in n}


async def _import(client: AsyncClient, user: dict, archive: bytes, dry_run: bool = False):
    response = await client.post(
        f"/api/v1/projects/{user['project_id']}/import",
        params={"dry_run": str(dry_run).lower()},
        files=[("files", ("export.zip", archive, "application/zip"))],
        headers=user["headers"],
    )
    assert response.status_code == 200, response.text
    return response.json()


def _zip(entries: dict[str, bytes | str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in entries.items():
            archive.writestr(name, content)
    return buffer.getvalue()


def _export_zip(sketch_content: str, files: dict[str, bytes], listed: list[str]) -> bytes:
    """A hand-made Diagramahub export with one sketch listing ``listed`` images."""
    manifest = {
        "format": "diagramahub-export",
        "format_version": 1,
        "folders": [],
        "diagrams": [
            {"title": "Board", "type": "freehand", "path": "Board.freehand.json", "files": listed}
        ],
    }
    return _zip(
        {
            "Proj/manifest.json": json.dumps(manifest),
            "Proj/Board.freehand.json": sketch_content,
            **{f"Proj/{path}": data for path, data in files.items()},
        }
    )


# --------------------------------------------------------------------------- #
#  Export
# --------------------------------------------------------------------------- #


async def test_export_writes_the_images_sketches_use(client: AsyncClient) -> None:
    user = await make_user(client, "Ella Export")
    shared, own, unused = png(), png(), png()
    first = await _sketch_with_images(client, user, shared, own, unused=(unused,))
    await _sketch_with_images(client, user, shared)

    archive = await _export(client, user)

    # Each image once, even when two sketches use it; unused ones are left out.
    assert _asset_names(archive) == {f".files/{sha(shared)}.png", f".files/{sha(own)}.png"}
    [name] = [n for n in archive.namelist() if n.endswith(f"{sha(own)}.png")]
    assert archive.read(name) == own
    entries = {d["id"]: d for d in _manifest(archive)["diagrams"]}
    assert entries[first]["files"] == [f".files/{sha(shared)}.png", f".files/{sha(own)}.png"]


async def test_folder_export_includes_its_sketches_images(client: AsyncClient) -> None:
    user = await make_user(client, "Ella Export")
    await make_diagram(client, user)  # creates the project
    folder = await client.post(
        f"/api/v1/projects/{user['project_id']}/folders",
        json={"name": "Boards", "color": "#3B82F6"},
        headers=user["headers"],
    )
    image = png()
    diagram_id = await make_diagram(
        client, user, content=scene(sha(image)), folder_id=folder.json()["id"]
    )
    await upload(client, user, diagram_id, image)

    archive = await _export(client, user, folder_id=folder.json()["id"])

    assert _asset_names(archive) == {f".files/{sha(image)}.png"}


async def test_text_diagrams_export_no_files(client: AsyncClient) -> None:
    user = await make_user(client, "Ella Export")
    await make_diagram(client, user, content="graph TD\n  A-->B", diagram_type="mermaid")

    archive = await _export(client, user)

    assert _asset_names(archive) == set()
    assert "files" not in _manifest(archive)["diagrams"][0]


async def test_summary_counts_the_images(client: AsyncClient) -> None:
    user = await make_user(client, "Ella Export")
    await _sketch_with_images(client, user, png(200_000))

    summary = await client.get(
        f"/api/v1/projects/{user['project_id']}/export/summary",
        params={"format": "zip"},
        headers=user["headers"],
    )
    download = await client.get(
        f"/api/v1/projects/{user['project_id']}/export",
        params={"format": "zip"},
        headers=user["headers"],
    )

    assert summary.status_code == 200, summary.text
    assert summary.json()["size_bytes"] >= 200_000
    assert summary.json()["size_bytes"] >= len(download.content)


# --------------------------------------------------------------------------- #
#  Import
# --------------------------------------------------------------------------- #


async def test_round_trip_restores_the_images(client: AsyncClient) -> None:
    user = await make_user(client, "Rita Roundtrip")
    image = png(5000)
    await _sketch_with_images(client, user, image)
    archive = await _export(client, user)
    data = _archive_bytes(archive)

    preview = await _import(client, user, data, dry_run=True)
    result = await _import(client, user, data)

    assert preview["diagrams"][0]["image_count"] == 1
    assert preview["diagrams"][0]["warnings"] == []
    assert preview["skipped"] == []
    [new_id] = result["created_diagram_ids"]
    read = await client.get(
        f"/api/v1/diagrams/{new_id}/files/{sha(image)}", headers=user["headers"]
    )
    assert read.status_code == 200
    assert read.content == image
    stored = await DiagramFileInDB.find_one({"scope_id": new_id})
    assert stored.owner_id == user["id"] and stored.mime_type == "image/png"


async def test_old_style_export_still_imports(client: AsyncClient) -> None:
    user = await make_user(client, "Olaf Old")
    await make_diagram(client, user)
    manifest = {
        "format": "diagramahub-export",
        "format_version": 1,
        "folders": [],
        "diagrams": [{"title": "Board", "type": "freehand", "path": "Board.freehand.json"}],
    }
    archive = _zip(
        {"Proj/manifest.json": json.dumps(manifest), "Proj/Board.freehand.json": scene("a" * 64)}
    )

    result = await _import(client, user, archive)

    assert len(result["created_diagram_ids"]) == 1
    assert result["diagrams"][0]["image_count"] == 0
    assert result["diagrams"][0]["warnings"] == []
    assert await DiagramFileInDB.find({"scope_id": result["created_diagram_ids"][0]}).count() == 0


async def test_tampered_images_are_skipped_with_a_warning(client: AsyncClient) -> None:
    user = await make_user(client, "Tom Tamper")
    await make_diagram(client, user)
    good, swapped = png(), png()
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    lying_id = sha(png())  # name of an image, bytes of another
    svg_id = hashlib.sha256(svg).hexdigest()
    paths = [f".files/{sha(good)}.png", f".files/{lying_id}.png", f".files/{svg_id}.svg"]
    archive = _export_zip(
        scene(sha(good), lying_id, svg_id),
        {paths[0]: good, paths[1]: swapped, paths[2]: svg},
        paths,
    )

    result = await _import(client, user, archive)

    [diagram] = result["diagrams"]
    assert diagram["image_count"] == 1
    assert IMAGE_SKIPPED in diagram["warnings"]
    [new_id] = result["created_diagram_ids"]
    stored = await DiagramFileInDB.find(
        {"scope": FileScope.DIAGRAM.value, "scope_id": new_id}
    ).to_list()
    assert [f.file_id for f in stored] == [sha(good)]
    # The images are never imported as diagrams of their own.
    assert result["skipped"] == []


# --------------------------------------------------------------------------- #
#  Parser
# --------------------------------------------------------------------------- #


@pytest.mark.unit
def test_parser_only_keeps_images_the_scene_mentions_within_the_cap() -> None:
    first, second, stranger = png(), png(), png()
    paths = [f".files/{sha(d)}.png" for d in (first, second, stranger)]
    archive = _export_zip(
        scene(sha(first), sha(second)),
        dict(zip(paths, (first, second, stranger))),
        paths,
    )

    plan = plan_zip_import(archive, ImportLimits(max_images_per_diagram=1))

    [diagram] = plan.root_diagrams
    assert [f.file_id for f in diagram.files] == [sha(first)]
    assert diagram.warnings == [IMAGE_SKIPPED]
    assert plan.skipped == []


@pytest.mark.unit
def test_parser_rejects_oversized_images_and_ignores_files_folder_without_manifest() -> None:
    big = png(2048)
    path = f".files/{sha(big)}.png"
    plan = plan_zip_import(
        _export_zip(scene(sha(big)), {path: big}, [path]), ImportLimits(max_image_bytes=1024)
    )
    assert plan.root_diagrams[0].files == []
    assert plan.root_diagrams[0].warnings == [IMAGE_SKIPPED]

    loose = plan_zip_import(
        _zip({".files/x.png": png(), "a.mmd": "graph TD\n  A-->B"}), ImportLimits()
    )
    assert [d.title for d in loose.root_diagrams] == ["a"]
    assert loose.skipped == []
