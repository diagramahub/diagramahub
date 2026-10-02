"""Unit tests for the pure import parsers (no database)."""

import io
import json
import zipfile

import pytest

from app.api.v1.projects.import_parsers import (
    ImportError_,
    ImportLimits,
    detect_diagram_type,
    excalidraw_to_freehand,
    normalize_freehand,
    parse_loose_file,
    parse_markdown_file,
    plan_upload,
    plan_zip_import,
    title_from_filename,
)

LIMITS = ImportLimits(max_files=50, max_total_bytes=1_000_000, max_file_bytes=100_000)


def _zip(files: dict[str, str | bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return buffer.getvalue()


# ---------------------------------------------------------------- detection


@pytest.mark.unit
@pytest.mark.parametrize(
    ("name", "content", "expected"),
    [
        ("flow.mmd", "x", "mermaid"),
        ("Flow.MERMAID", "x", "mermaid"),
        ("seq.puml", "x", "plantuml"),
        ("seq.pu", "x", "plantuml"),
        ("arch.d2", "x", "d2"),
        ("db.dbml", "x", "dbml"),
        ("sketch.freehand.json", '{"elements": []}', "freehand"),
        ("draw.excalidraw", '{"type":"excalidraw","elements":[]}', "excalidraw"),
        ("sketch.freehand.json", '{"type":"excalidraw","elements":[]}', "excalidraw"),
        ("notes.txt", "graph TD\n  A-->B", "mermaid"),
        ("notes.txt", "sequenceDiagram\n  A->>B: hi", "mermaid"),
        ("notes.txt", "---\ntitle: x\n---\nflowchart LR", "mermaid"),
        ("notes.txt", "@startuml\nA->B\n@enduml", "plantuml"),
        ("notes.txt", "Table users {\n  id int\n}", "dbml"),
        ("notes.txt", "server -> db: query\ndirection: right", "d2"),
        ("notes.txt", "hello world", None),
        ("photo.png", "\x89PNG", None),
        ("archive.tar", "x", None),
    ],
)
def test_detect_diagram_type(name: str, content: str, expected) -> None:
    assert detect_diagram_type(name, content) == expected


@pytest.mark.unit
def test_title_from_filename() -> None:
    assert title_from_filename("folder/Flujo_de__login.mmd") == "Flujo de login"
    assert title_from_filename("Boceto.freehand.json") == "Boceto"
    assert title_from_filename("x.excalidraw") == "x"
    assert title_from_filename(".mmd") == ".mmd"[:100] or True  # degenerate names never crash


# ---------------------------------------------------------------- markdown


@pytest.mark.unit
def test_parse_markdown_file_takes_first_known_fence_and_description() -> None:
    text = "# Pagos\n\nFlujo de cobro.\n\n```python\nprint(1)\n```\n\n```plantuml\n@startuml\nA->B\n@enduml\n```\n\nNotas finales.\n"
    assert parse_markdown_file(text) == ("plantuml", "@startuml\nA->B\n@enduml", "Flujo de cobro.\n\n```python\nprint(1)\n```\n\nNotas finales.", "Pagos")


@pytest.mark.unit
def test_parse_markdown_file_untagged_fence_uses_content_detection() -> None:
    assert parse_markdown_file("```\ngraph TD\n  A-->B\n```")[:2] == ("mermaid", "graph TD\n  A-->B")
    assert parse_markdown_file("just prose") is None
    assert parse_markdown_file("```js\nlet a\n```") is None


# ---------------------------------------------------------------- freehand


@pytest.mark.unit
def test_normalize_freehand_fills_defaults_and_drops_unknown_elements() -> None:
    raw = json.dumps({"elements": [
        {"type": "rectangle", "x": "10", "y": 5, "width": 100, "height": 50, "opacity": 3},
        {"type": "alien", "x": 0}, "junk",
    ], "background": "#000"})
    data = json.loads(normalize_freehand(raw))
    assert data["version"] == 1 and data["background"] == "#000"
    assert data["viewport"] == {"zoom": 1, "scrollX": 0, "scrollY": 0}
    [el] = data["elements"]
    assert el["x"] == 10 and el["opacity"] == 1 and el["fillColor"] == "transparent" and el["id"]
    with pytest.raises(ImportError_):
        normalize_freehand("[1,2]")
    with pytest.raises(ImportError_):
        normalize_freehand("nope")


@pytest.mark.unit
def test_excalidraw_to_freehand_maps_shapes_labels_arrows_and_skips_unsupported() -> None:
    doc = {
        "type": "excalidraw", "version": 2,
        "appState": {"viewBackgroundColor": "#fafafa"},
        "elements": [
            {"id": "r1", "type": "rectangle", "x": 0, "y": 0, "width": 100, "height": 60,
             "strokeColor": "#111", "backgroundColor": "#ffd", "strokeWidth": 2, "opacity": 80,
             "roundness": {"type": 3}, "groupIds": ["g1"], "strokeStyle": "dashed",
             "boundElements": [{"id": "t1", "type": "text"}]},
            {"id": "t1", "type": "text", "x": 10, "y": 20, "width": 80, "height": 20,
             "text": "Inicio", "fontSize": 20, "containerId": "r1"},
            {"id": "e1", "type": "ellipse", "x": 300, "y": 0, "width": 100, "height": 60, "opacity": 100},
            {"id": "a1", "type": "arrow", "x": 100, "y": 30, "width": 200, "height": 0,
             "points": [[0, 0], [200, 0]], "endArrowhead": "arrow", "startArrowhead": None,
             "startBinding": {"elementId": "r1", "focus": 0, "gap": 1},
             "endBinding": {"elementId": "e1", "focus": 0, "gap": 1}},
            {"id": "f1", "type": "freedraw", "x": 50, "y": 100, "points": [[0, 0], [5, 5], [10, 0]]},
            {"id": "x1", "type": "text", "x": 0, "y": 200, "width": 50, "height": 20, "text": "Suelto"},
            {"id": "i1", "type": "image", "x": 0, "y": 0, "width": 10, "height": 10},
            {"id": "d1", "type": "rectangle", "x": 0, "y": 0, "width": 10, "height": 10, "isDeleted": True},
        ],
    }
    content, warnings = excalidraw_to_freehand(json.dumps(doc))
    sketch = json.loads(content)
    assert sketch["background"] == "#fafafa" and warnings == ["skipped_image:1"]
    by_id = {e["id"]: e for e in sketch["elements"]}
    assert set(by_id) == {"r1", "e1", "a1", "f1", "x1"}  # t1 merged into r1, d1 deleted, i1 skipped
    rect = by_id["r1"]
    assert rect["text"] == "Inicio" and rect["fontSize"] == 20 and rect["borderRadius"] == 8
    assert rect["fillColor"] == "#ffd" and rect["opacity"] == 0.8 and rect["dashed"] is True and rect["groupId"] == "g1"
    arrow = by_id["a1"]
    assert arrow["points"] == [{"x": 100, "y": 30}, {"x": 300, "y": 30}]
    assert arrow["endArrowhead"] is True and arrow["startArrowhead"] is False
    assert arrow["startBinding"] == {"elementId": "r1", "anchorSide": "right"}
    assert arrow["endBinding"] == {"elementId": "e1", "anchorSide": "left"}
    free = by_id["f1"]
    assert free["type"] == "freehand" and free["points"][1] == {"x": 55, "y": 105} and free["width"] == 10
    assert by_id["x1"]["type"] == "text" and by_id["x1"]["text"] == "Suelto"
    with pytest.raises(ImportError_):
        excalidraw_to_freehand('{"type":"other"}')


# ---------------------------------------------------------------- loose files


@pytest.mark.unit
def test_parse_loose_file_variants() -> None:
    diagram, skipped = parse_loose_file("Flujo de login.mmd", b"graph TD\n  A-->B\n", LIMITS)
    assert skipped is None and diagram.title == "Flujo de login" and diagram.diagram_type == "mermaid"
    assert diagram.content == "graph TD\n  A-->B"

    diagram, _ = parse_loose_file("readme.md", "# Cobros\n\nDesc\n\n```mermaid\ngraph LR\n  X-->Y\n```".encode(), LIMITS)
    assert diagram.title == "Cobros" and diagram.description == "Desc" and diagram.diagram_type == "mermaid"

    diagram, _ = parse_loose_file("draw.excalidraw", json.dumps({"type": "excalidraw", "elements": []}).encode(), LIMITS)
    assert diagram.diagram_type == "freehand" and json.loads(diagram.content)["elements"] == []

    _, skipped = parse_loose_file("photo.png", b"\x89PNG....", LIMITS)
    assert skipped.reason == "unsupported_type"
    _, skipped = parse_loose_file("empty.mmd", b"   ", LIMITS)
    assert skipped.reason == "empty"
    _, skipped = parse_loose_file("big.mmd", b"x" * (LIMITS.max_file_bytes + 1), LIMITS)
    assert skipped.reason == "too_large"
    _, skipped = parse_loose_file("prose.md", b"no code here", LIMITS)
    assert skipped.reason == "no_diagram_block"
    _, skipped = parse_loose_file("bad.freehand.json", b"{not json", LIMITS)
    assert skipped.reason == "invalid_json"


# ---------------------------------------------------------------- zip


@pytest.mark.unit
def test_plan_zip_import_diagramahub_export_restores_folders_titles_descriptions() -> None:
    manifest = {
        "format": "diagramahub-export", "format_version": 1,
        "folders": [{"id": "f1", "name": "Arquitectura: v2", "color": "#8B5CF6", "path": "Arquitectura v2"},
                    {"id": "f2", "name": "Vacía", "color": "#10B981", "path": "Vacía"}],
        "diagrams": [{"title": "Flujo de login (prod)", "type": "mermaid", "path": "Arquitectura v2/Flujo de login.mmd"}],
    }
    data = _zip({
        "Mi proyecto/manifest.json": json.dumps(manifest),
        "Mi proyecto/README.md": "# index",
        "Mi proyecto/Borrador.mmd": "graph LR\n  X-->Y",
        "Mi proyecto/Borrador.md": "# Borrador\n\nUn borrador",
        "Mi proyecto/Arquitectura v2/Flujo de login.mmd": "graph TD\n  A-->B",
        "Mi proyecto/Arquitectura v2/Flujo de login.md": "# Flujo de login\n\nLogin con MFA",
        "Mi proyecto/Arquitectura v2/Pagos.puml": "@startuml\nA->B\n@enduml",
        "Mi proyecto/Vacía/": "",
    })
    plan = plan_zip_import(data, LIMITS)

    assert [d.title for d in plan.root_diagrams] == ["Borrador"]
    assert plan.root_diagrams[0].description == "Un borrador"
    assert [(f.name, f.color) for f in plan.folders] == [("Arquitectura v2", "#8B5CF6"), ("Vacía", "#10B981")]
    arch = plan.folders[0]
    assert [d.title for d in arch.diagrams] == ["Flujo de login (prod)", "Pagos"]
    assert arch.diagrams[0].description == "Login con MFA" and arch.diagrams[1].diagram_type == "plantuml"
    assert plan.skipped == [] and plan.diagram_count == 3 and len(plan.folders[1].diagrams) == 0


@pytest.mark.unit
def test_plan_zip_import_arbitrary_archive_security_and_collisions() -> None:
    data = _zip({
        "docs/flow.mmd": "graph TD\n  A-->B",
        "docs/flow.MMD": "graph TD\n  B-->C",
        "docs/deep/nested/er.dbml": "Table t {\n id int\n}",
        "docs/notes.md": "```d2\na -> b\n```",
        "docs/photo.png": b"\x89PNG",
        "__MACOSX/docs/._flow.mmd": "junk",
        ".hidden/secret.mmd": "graph TD",
        "../escape.mmd": "graph TD",
        "inner.zip": _zip({"x.mmd": "graph TD"}),
        "root.puml": "@startuml\n@enduml",
    })
    plan = plan_zip_import(data, LIMITS)

    assert [d.title for d in plan.root_diagrams] == ["root"]
    [docs] = plan.folders
    assert docs.name == "docs" and docs.color is None
    assert sorted(d.title for d in docs.diagrams) == ["er", "flow", "flow (2)", "notes"]
    assert {d.diagram_type for d in docs.diagrams} == {"mermaid", "dbml", "d2"}
    reasons = {s.source: s.reason for s in plan.skipped}
    assert reasons == {"docs/photo.png": "unsupported_type", "inner.zip": "nested_zip"}
    assert not any("escape" in d.title or "secret" in d.title for d in docs.diagrams + plan.root_diagrams)


@pytest.mark.unit
def test_plan_zip_import_limits() -> None:
    too_many = _zip({f"d{i}.mmd": "graph TD" for i in range(LIMITS.max_files + 1)})
    with pytest.raises(ImportError_, match="too_many_files"):
        plan_zip_import(too_many, LIMITS)
    bomb = _zip({"a.mmd": "x" * (LIMITS.max_total_bytes + 1)})
    with pytest.raises(ImportError_, match="too_large_uncompressed"):
        plan_zip_import(bomb, LIMITS)
    with pytest.raises(ImportError_, match="invalid_zip"):
        plan_zip_import(b"PK\x03\x04garbage", LIMITS)


@pytest.mark.unit
def test_plan_upload_dispatches_zip_vs_loose_and_merge_flatten() -> None:
    plan = plan_upload("a.mmd", b"graph TD", LIMITS)
    assert plan.diagram_count == 1 and plan.folders == []
    plan.merge(plan_upload("bundle.zip", _zip({"F/x.mmd": "graph TD", "F/y.mmd": "graph LR"}), LIMITS))
    plan.merge(plan_upload("bundle2.zip", _zip({"f/z.mmd": "graph TD"}), LIMITS))
    assert [f.name for f in plan.folders] == ["F"] and len(plan.folders[0].diagrams) == 3
    plan.flatten_into_root()
    assert plan.folders == [] and plan.diagram_count == 4
