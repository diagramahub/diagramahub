"""Import robustness: malformed files are skipped, never a 500 (0.8.1 C1–C5, C7)."""

import io
import json
import zipfile
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.api.v1.projects import import_service as import_module
from app.api.v1.projects.export_builders import unique_name
from app.api.v1.projects.import_parsers import (
    ImportLimits,
    excalidraw_to_freehand,
    normalize_freehand,
    parse_loose_file,
    plan_zip_import,
)
from app.api.v1.projects.import_service import import_preview_rate_limiter, import_rate_limiter

LIMITS = ImportLimits()


@pytest.fixture(autouse=True)
def _reset_rate_limiters():
    import_rate_limiter.reset()
    import_preview_rate_limiter.reset()
    yield
    import_rate_limiter.reset()
    import_preview_rate_limiter.reset()


def _excalidraw(elements, **extra) -> str:
    return json.dumps({"type": "excalidraw", "elements": elements, **extra})


# ---------------------------------------------------------------- C1 titles


def test_unique_name_respects_max_length() -> None:
    title = "T" * 100
    taken = {title.lower()}
    second = unique_name(title, taken, 100)
    third = unique_name(title, taken, 100)
    assert second.endswith(" (2)") and len(second) == 100
    assert third.endswith(" (3)") and len(third) == 100
    assert unique_name("corto", set(), 100) == "corto"


@pytest.mark.integration
async def test_importing_a_100_char_title_twice_suffixes_within_the_limit(
    authenticated_client: AsyncClient,
) -> None:
    pid = (await authenticated_client.post("/api/v1/projects", json={"name": "P", "emoji": "📥"})).json()["id"]
    name = "T" * 100 + ".mmd"
    files = [("files", (name, b"graph TD\n A-->B", "text/plain"))]

    first = await authenticated_client.post(f"/api/v1/projects/{pid}/import", files=files)
    second = await authenticated_client.post(f"/api/v1/projects/{pid}/import", files=files)

    assert first.status_code == 200 and second.status_code == 200
    titles = {d["title"] for d in (await authenticated_client.get(f"/api/v1/projects/{pid}")).json()["diagrams"]}
    assert titles == {"T" * 100, "T" * 96 + " (2)"}


# ---------------------------------------------------------------- C2 Excalidraw


@pytest.mark.parametrize(
    "document",
    [
        _excalidraw([{"id": "a", "type": "arrow", "x": 0, "y": 0, "points": [1, 2]}]),
        _excalidraw([{"id": "f", "type": "freedraw", "x": 0, "y": 0, "points": ["x", None, {}]}]),
        _excalidraw([{"id": ["list"], "type": "rectangle", "x": 0, "y": 0}]),
        _excalidraw([{"id": "t", "type": "text", "containerId": {"a": 1}, "text": "hola"}]),
        _excalidraw([{"id": "r", "type": "rectangle"}], appState=["not", "a", "dict"]),
        _excalidraw([{"id": "a", "type": "arrow", "points": [[0, 0], [5, 5]], "endBinding": {"elementId": [1]}}]),
    ],
)
def test_malformed_excalidraw_never_raises(document: str) -> None:
    content, _warnings = excalidraw_to_freehand(document)
    assert json.loads(content)["version"] == 1


def test_excalidraw_arrow_without_valid_points_is_skipped_and_reported() -> None:
    content, warnings = excalidraw_to_freehand(
        _excalidraw([{"id": "a", "type": "arrow", "x": 0, "y": 0, "points": [1, 2]}])
    )
    assert json.loads(content)["elements"] == []
    assert warnings == ["skipped_arrow:1"]


def test_deeply_nested_json_is_skipped_not_crashing() -> None:
    nested = "[" * 100_000 + "]" * 100_000
    diagram, skipped = parse_loose_file("deep.excalidraw", nested.encode(), LIMITS)
    assert diagram is None and skipped is not None


def test_unexpected_parser_error_skips_only_that_file() -> None:
    with patch(
        "app.api.v1.projects.import_parsers.excalidraw_to_freehand", side_effect=KeyError("boom")
    ):
        diagram, skipped = parse_loose_file("x.excalidraw", _excalidraw([]).encode(), LIMITS)
    assert diagram is None and skipped.reason == "unreadable"


# ---------------------------------------------------------------- C3 ZIP entries


def test_corrupt_zip_entry_is_skipped_and_the_rest_imported() -> None:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("ok.mmd", "graph TD\n A-->B")
        archive.writestr("bad.mmd", "graph TD\n" + "X-->Y\n" * 200)
    data = bytearray(buffer.getvalue())
    # Corrupt the CRC recorded for the second entry in the central directory
    # (what zipfile checks the decompressed data against)
    second = data.find(b"PK\x01\x02", data.find(b"PK\x01\x02") + 4)
    data[second + 16] ^= 0xFF

    plan = plan_zip_import(bytes(data), LIMITS)

    assert [d.title for d in plan.root_diagrams] == ["ok"]
    assert [(s.source, s.reason) for s in plan.skipped] == [("bad.mmd", "unreadable")]


# ---------------------------------------------------------------- C7 NaN


def test_nan_and_infinity_become_zero_in_sketches() -> None:
    raw = '{"elements": [{"type": "freehand", "x": NaN, "y": 1, "points": [{"x": Infinity, "y": -Infinity}]}]}'
    out = normalize_freehand(raw)
    element = json.loads(out)["elements"][0]  # strict JSON: would fail on NaN
    assert element["x"] == 0 and element["points"][0] == {"x": 0.0, "y": 0.0}
    assert "NaN" not in out and "Infinity" not in out


# ---------------------------------------------------------------- C4 rollback


@pytest.mark.integration
async def test_rollback_reports_incomplete_cleanup(authenticated_client: AsyncClient) -> None:
    pid = (await authenticated_client.post("/api/v1/projects", json={"name": "R", "emoji": "📥"})).json()["id"]
    from app.api.v1.diagrams.repository import DiagramRepository

    real_create = DiagramRepository.create
    calls = {"n": 0}

    async def flaky_create(self, data, project_id):  # noqa: ANN001, ANN202
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("database hiccup")
        return await real_create(self, data, project_id)

    async def failing_delete(self, diagram_id):  # noqa: ANN001, ANN202
        raise RuntimeError("delete failed too")

    files = [("files", (f"d{i}.mmd", b"graph TD", "text/plain")) for i in range(3)]
    with patch.object(DiagramRepository, "create", flaky_create), patch.object(DiagramRepository, "delete", failing_delete):
        response = await authenticated_client.post(f"/api/v1/projects/{pid}/import", files=files)

    assert response.status_code == 500
    assert response.json()["detail"] == {"error": "import_failed", "rolled_back": False}


async def test_cancellation_rolls_back_the_partial_import() -> None:
    """A cancelled request (client gone) still removes what it created."""
    import asyncio
    from types import SimpleNamespace

    deleted: list[str] = []

    class Repo:
        async def get_by_id(self, _id):  # noqa: ANN001, ANN202
            return SimpleNamespace(id="p1", user_id="u1", project_id="p1")

        async def get_by_project_id(self, _pid):  # noqa: ANN001, ANN202
            return []

        async def get_without_folder(self, _pid):  # noqa: ANN001, ANN202
            return []

        async def create(self, data, project_id):  # noqa: ANN001, ANN202
            if getattr(data, "title", "") == "b":
                raise asyncio.CancelledError()
            return SimpleNamespace(id=f"new-{data.title}")

        async def delete(self, diagram_id):  # noqa: ANN001, ANN202
            deleted.append(diagram_id)

    class Limiter:
        async def check_diagram_limit(self, _user):  # noqa: ANN001, ANN202
            return {"allowed": True, "current_usage": 0, "limit": -1, "plan_name": "FREE"}

    repo = Repo()
    service = import_module.ProjectImportService(repo, repo, repo, Limiter())
    uploads = [import_module.UploadedFile("a.mmd", b"graph TD"), import_module.UploadedFile("b.mmd", b"graph TD")]

    with pytest.raises(asyncio.CancelledError):
        await service.execute("p1", "u1", uploads, None)
    assert deleted == ["new-a"]


# ---------------------------------------------------------------- C5 folder names


@pytest.mark.integration
async def test_folders_differing_only_in_case_become_one(authenticated_client: AsyncClient) -> None:
    pid = (await authenticated_client.post("/api/v1/projects", json={"name": "C", "emoji": "📥"})).json()["id"]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("Docs/a.mmd", "graph TD")
        archive.writestr("docs/b.mmd", "graph TD")

    response = await authenticated_client.post(
        f"/api/v1/projects/{pid}/import", files=[("files", ("c.zip", buffer.getvalue(), "application/zip"))]
    )

    assert response.status_code == 200
    folders = (await authenticated_client.get(f"/api/v1/projects/{pid}")).json()["folders"]
    assert len(folders) == 1 and sorted(d["title"] for d in folders[0]["diagrams"]) == ["a", "b"]


def test_utf16_files_decode_and_latin1_is_flagged() -> None:
    utf16, _ = parse_loose_file("a.mmd", "graph TD\n  A[Añadir]-->B".encode("utf-16"), LIMITS)
    latin1, _ = parse_loose_file("b.mmd", "graph TD\r  A[Añadir]-->B".encode("latin-1"), LIMITS)

    assert utf16.content == "graph TD\n  A[Añadir]-->B" and utf16.warnings == []
    assert "\r" not in latin1.content and latin1.warnings == ["replaced_characters"]
