"""
Pure parsers for the project import feature.

Side-effect free: they turn uploaded bytes (loose diagram files, Diagramahub
or arbitrary ZIP archives, Excalidraw drawings) into an ``ImportPlan`` that
the service can preview (dry run) or execute. Database access, permission
and plan-limit checks live in ``import_service.py``.
"""

from __future__ import annotations

import io
import json
import math
import posixpath
import re
import uuid
import zipfile
from dataclasses import dataclass, field
from typing import Optional

from .export_builders import MANIFEST_FILENAME, sanitize_filename, unique_name

KNOWN_TYPES = ("mermaid", "plantuml", "d2", "dbml", "freehand")

# File extension -> diagram type ("excalidraw" is converted to "freehand").
_EXTENSION_TYPES: dict[str, str] = {
    ".mmd": "mermaid",
    ".mermaid": "mermaid",
    ".puml": "plantuml",
    ".plantuml": "plantuml",
    ".pu": "plantuml",
    ".iuml": "plantuml",
    ".d2": "d2",
    ".dbml": "dbml",
    ".freehand.json": "freehand",
    ".excalidraw": "excalidraw",
    ".excalidraw.json": "excalidraw",
}
_TEXT_EXTENSIONS = (".md", ".markdown", ".txt")
_ALL_EXTENSIONS = sorted(set(_EXTENSION_TYPES) | set(_TEXT_EXTENSIONS), key=len, reverse=True)

_MERMAID_STARTERS = (
    "graph",
    "flowchart",
    "sequencediagram",
    "classdiagram",
    "statediagram",
    "erdiagram",
    "gantt",
    "pie",
    "journey",
    "gitgraph",
    "mindmap",
    "timeline",
    "quadrantchart",
    "requirementdiagram",
    "c4context",
    "c4container",
    "sankey",
    "xychart",
    "block-beta",
    "packet-beta",
    "kanban",
    "architecture",
    "zenuml",
    "%%{init",
    "---",
)
_FENCE_RE = re.compile(r"^```[ \t]*([A-Za-z0-9_+-]*)[ \t]*$")
_FENCE_LANGUAGES = {
    "mermaid": "mermaid",
    "mmd": "mermaid",
    "plantuml": "plantuml",
    "puml": "plantuml",
    "uml": "plantuml",
    "d2": "d2",
    "dbml": "dbml",
}


@dataclass
class ImportLimits:
    """Caps that keep an archive from exhausting the server."""

    max_files: int = 500
    max_total_bytes: int = 50 * 1024 * 1024
    max_file_bytes: int = 5 * 1024 * 1024


@dataclass
class ImportDiagram:
    """A diagram to create."""

    title: str
    diagram_type: str
    content: str
    description: Optional[str]
    source: str  # file name / path inside the upload, for the preview
    warnings: list[str] = field(default_factory=list)


@dataclass
class ImportFolder:
    """A folder to create (or reuse by name) with its diagrams."""

    name: str
    color: Optional[str]
    diagrams: list[ImportDiagram] = field(default_factory=list)


@dataclass
class ImportSkipped:
    """An upload entry that is not imported, with the reason."""

    source: str
    reason: str  # machine-readable: unsupported_type, too_large, nested_zip, invalid, empty


@dataclass
class ImportPlan:
    """Everything an upload would create."""

    root_diagrams: list[ImportDiagram] = field(default_factory=list)
    folders: list[ImportFolder] = field(default_factory=list)
    skipped: list[ImportSkipped] = field(default_factory=list)

    @property
    def diagram_count(self) -> int:
        """Total diagrams that would be created."""
        return len(self.root_diagrams) + sum(len(f.diagrams) for f in self.folders)

    def merge(self, other: "ImportPlan") -> None:
        """Append another plan's entries (several uploads in one request)."""
        self.root_diagrams.extend(other.root_diagrams)
        self.skipped.extend(other.skipped)
        by_name = {f.name.lower(): f for f in self.folders}
        for folder in other.folders:
            existing = by_name.get(folder.name.lower())
            if existing:
                existing.diagrams.extend(folder.diagrams)
                existing.color = existing.color or folder.color
            else:
                self.folders.append(folder)
                by_name[folder.name.lower()] = folder

    def flatten_into_root(self) -> None:
        """Drop the folder structure (used when importing into a specific folder)."""
        for folder in self.folders:
            self.root_diagrams.extend(folder.diagrams)
        self.folders = []


class ImportError_(ValueError):
    """A file that cannot be imported at all (reported as 400)."""


# --------------------------------------------------------------------------- #
#  Names and types
# --------------------------------------------------------------------------- #


def split_extension(filename: str) -> tuple[str, str]:
    """``("Flujo", ".freehand.json")`` — longest known extension wins."""
    lower = filename.lower()
    for ext in _ALL_EXTENSIONS:
        if lower.endswith(ext) and len(lower) > len(ext):
            return filename[: -len(ext)], ext
    base, dot, ext = filename.rpartition(".")
    return (base, f".{ext}") if dot and base else (filename, "")


def title_from_filename(filename: str) -> str:
    """Diagram title from a file name: no extension, no path, tidy spaces."""
    base, _ = split_extension(posixpath.basename(filename))
    title = re.sub(r"[_]+", " ", base)
    title = re.sub(r"\s+", " ", title).strip()
    return (title or "Diagram")[:100]


def detect_type_from_content(content: str) -> Optional[str]:
    """Best-effort type detection from the source when the extension is ambiguous."""
    text = content.strip()
    if not text:
        return None
    lowered = text.lower()
    if "@startuml" in lowered or "@startmindmap" in lowered or "@startgantt" in lowered:
        return "plantuml"
    first_words = lowered.split(None, 1)[0] if lowered.split() else ""
    if any(lowered.startswith(s) for s in _MERMAID_STARTERS) or first_words in _MERMAID_STARTERS:
        return "mermaid"
    if (
        re.search(r"^\s*(table|enum|project|ref|tablegroup)\s+\S+", lowered, re.MULTILINE)
        and "{" in text
    ):
        return "dbml"
    if re.search(r"^\s*(direction|shape|vars|classes)\s*:", lowered, re.MULTILINE) or re.search(
        r"^\s*[\w\"']+\s*->\s*[\w\"']+", text, re.MULTILINE
    ):
        return "d2"
    try:
        data = json.loads(text)
    except ValueError:
        return None
    if isinstance(data, dict):
        if data.get("type") == "excalidraw":
            return "excalidraw"
        if isinstance(data.get("elements"), list):
            return "freehand"
    return None


def detect_diagram_type(filename: str, content: str) -> Optional[str]:
    """Type by extension first, then by content for text files."""
    _, ext = split_extension(filename)
    if ext in _EXTENSION_TYPES:
        detected = _EXTENSION_TYPES[ext]
        # A ".json" sketch may actually be an Excalidraw file.
        if detected == "freehand" and detect_type_from_content(content) == "excalidraw":
            return "excalidraw"
        return detected
    if ext in _TEXT_EXTENSIONS or not ext:
        return detect_type_from_content(content)
    return None


# --------------------------------------------------------------------------- #
#  Markdown (single file with a fenced block)
# --------------------------------------------------------------------------- #


def parse_markdown_file(text: str) -> Optional[tuple[str, str, Optional[str], Optional[str]]]:
    """``(diagram_type, code, description, title)`` from a Markdown file.

    Takes the first fenced block tagged mermaid/plantuml/d2/dbml (or an
    untagged one whose content is recognisable). The text outside the block
    becomes the description; a leading ``# Title`` becomes the title.
    """
    lines = text.splitlines()
    block_start = block_end = None
    diagram_type: Optional[str] = None
    skipping_other_block = False  # inside a fence of another language (e.g. ```python)
    for i, line in enumerate(lines):
        match = _FENCE_RE.match(line.strip())
        if not match:
            continue
        if skipping_other_block:
            skipping_other_block = False  # this fence closes the other block
            continue
        if block_start is None:
            lang = match.group(1).lower()
            if lang and lang not in _FENCE_LANGUAGES:
                skipping_other_block = True
                continue
            block_start = i
            diagram_type = _FENCE_LANGUAGES.get(lang)
        else:
            block_end = i
            break
    if block_start is None or block_end is None:
        return None
    code = "\n".join(lines[block_start + 1 : block_end]).strip("\n")
    if diagram_type is None:
        diagram_type = detect_type_from_content(code)
    if diagram_type not in ("mermaid", "plantuml", "d2", "dbml") or not code.strip():
        return None

    outside = lines[:block_start] + lines[block_end + 1 :]
    title: Optional[str] = None
    rest: list[str] = []
    for line in outside:
        if title is None and line.startswith("# ") and not rest:
            title = line[2:].strip()[:100] or None
            continue
        rest.append(line)
    # Removing the block can leave consecutive blank lines: collapse them.
    description = re.sub(r"\n{3,}", "\n\n", "\n".join(rest)).strip() or None
    return diagram_type, code, description, title


# --------------------------------------------------------------------------- #
#  Freehand / Excalidraw
# --------------------------------------------------------------------------- #

_FREEHAND_TYPES = {"rectangle", "diamond", "ellipse", "arrow", "line", "text", "freehand"}


def _num(value, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if math.isfinite(number) else default


def normalize_freehand(content: str) -> str:
    """Validate a Diagramahub sketch JSON and return it normalised.

    Raises:
        ImportError_: when the JSON is not a sketch.
    """
    try:
        data = json.loads(content)
    except ValueError as exc:
        raise ImportError_("invalid_json") from exc
    if not isinstance(data, dict) or not isinstance(data.get("elements"), list):
        raise ImportError_("not_a_sketch")
    elements = []
    for raw in data["elements"]:
        if not isinstance(raw, dict) or raw.get("type") not in _FREEHAND_TYPES:
            continue
        element = dict(raw)
        element.setdefault("id", uuid.uuid4().hex[:12])
        for key in ("x", "y", "width", "height"):
            element[key] = _num(element.get(key))
        element.setdefault("strokeColor", "#1e1e1e")
        element.setdefault("fillColor", "transparent")
        element["strokeWidth"] = _num(element.get("strokeWidth"), 2) or 2
        element["opacity"] = min(1.0, max(0.0, _num(element.get("opacity"), 1)))
        elements.append(element)
    raw_viewport = data.get("viewport")
    viewport: dict = raw_viewport if isinstance(raw_viewport, dict) else {}
    normalised = {
        "version": 1,
        "elements": elements,
        "viewport": {
            "zoom": _num(viewport.get("zoom"), 1) or 1,
            "scrollX": _num(viewport.get("scrollX")),
            "scrollY": _num(viewport.get("scrollY")),
        },
        "background": (
            data.get("background") if isinstance(data.get("background"), str) else "#ffffff"
        ),
    }
    return json.dumps(normalised, ensure_ascii=False)


def _anchor_side(point: dict, box: dict) -> str:
    """Which side of ``box`` an arrow endpoint touches (for arrow bindings)."""
    cx = box["x"] + box["width"] / 2
    cy = box["y"] + box["height"] / 2
    dx = (point["x"] - cx) / max(box["width"] / 2, 1)
    dy = (point["y"] - cy) / max(box["height"] / 2, 1)
    if abs(dx) >= abs(dy):
        return "right" if dx > 0 else "left"
    return "bottom" if dy > 0 else "top"


def excalidraw_to_freehand(content: str) -> tuple[str, list[str]]:
    """Convert an ``.excalidraw`` file into a Diagramahub sketch.

    Supported: rectangle, diamond, ellipse, arrow, line, text, freedraw. Text
    bound to a shape becomes the shape's label. Images, frames, embeds and
    anything else are skipped and reported in the returned warnings.

    Raises:
        ImportError_: when the file is not an Excalidraw document.
    """
    try:
        data = json.loads(content)
    except ValueError as exc:
        raise ImportError_("invalid_json") from exc
    if (
        not isinstance(data, dict)
        or data.get("type") != "excalidraw"
        or not isinstance(data.get("elements"), list)
    ):
        raise ImportError_("not_excalidraw")

    raw_elements = [e for e in data["elements"] if isinstance(e, dict) and not e.get("isDeleted")]
    by_id = {e.get("id"): e for e in raw_elements if e.get("id")}
    converted: dict[str, dict] = {}
    order: list[str] = []
    skipped: dict[str, int] = {}
    bound_text_ids: set[str] = set()

    def base(element: dict, kind: str, eid: str) -> dict:
        stroke_style = element.get("strokeStyle")
        result = {
            "id": eid,
            "type": kind,
            "x": _num(element.get("x")),
            "y": _num(element.get("y")),
            "width": max(1.0, _num(element.get("width"), 1)),
            "height": max(1.0, _num(element.get("height"), 1)),
            "strokeColor": element.get("strokeColor") or "#1e1e1e",
            "fillColor": element.get("backgroundColor") or "transparent",
            "strokeWidth": _num(element.get("strokeWidth"), 2) or 2,
            "opacity": min(1.0, max(0.0, _num(element.get("opacity"), 100) / 100)),
        }
        if stroke_style in ("dashed", "dotted"):
            result["dashed"] = True
        groups = element.get("groupIds")
        if isinstance(groups, list) and groups:
            result["groupId"] = str(groups[0])
        return result

    for element in raw_elements:
        kind = element.get("type")
        eid = str(element.get("id") or uuid.uuid4().hex[:12])
        if kind in ("rectangle", "diamond", "ellipse"):
            shape = base(element, kind, eid)
            if kind == "rectangle" and element.get("roundness"):
                shape["borderRadius"] = 8
            converted[eid] = shape
            order.append(eid)
        elif kind in ("arrow", "line"):
            points = element.get("points")
            if not isinstance(points, list) or len(points) < 2:
                skipped[kind] = skipped.get(kind, 0) + 1
                continue
            x0, y0 = _num(element.get("x")), _num(element.get("y"))
            abs_points = [
                {"x": x0 + _num(p[0]), "y": y0 + _num(p[1])}
                for p in points
                if isinstance(p, (list, tuple)) and len(p) >= 2
            ]
            xs = [p["x"] for p in abs_points]
            ys = [p["y"] for p in abs_points]
            shape = base(element, kind, eid)
            shape.update(
                {
                    "x": min(xs),
                    "y": min(ys),
                    "width": max(1.0, max(xs) - min(xs)),
                    "height": max(1.0, max(ys) - min(ys)),
                    "points": abs_points,
                    "fillColor": "transparent",
                }
            )
            if kind == "arrow":
                shape["endArrowhead"] = bool(element.get("endArrowhead", "arrow"))
                shape["startArrowhead"] = bool(element.get("startArrowhead"))
            for side in ("start", "end"):
                binding = element.get(f"{side}Binding")
                if isinstance(binding, dict) and binding.get("elementId"):
                    shape[f"_{side}_bound_to"] = binding["elementId"]
            converted[eid] = shape
            order.append(eid)
        elif kind == "freedraw":
            points = element.get("points")
            if not isinstance(points, list) or len(points) < 2:
                skipped[kind] = skipped.get(kind, 0) + 1
                continue
            x0, y0 = _num(element.get("x")), _num(element.get("y"))
            abs_points = [
                {"x": x0 + _num(p[0]), "y": y0 + _num(p[1])}
                for p in points
                if isinstance(p, (list, tuple)) and len(p) >= 2
            ]
            xs = [p["x"] for p in abs_points]
            ys = [p["y"] for p in abs_points]
            shape = base(element, "freehand", eid)
            shape.update(
                {
                    "x": min(xs),
                    "y": min(ys),
                    "width": max(1.0, max(xs) - min(xs)),
                    "height": max(1.0, max(ys) - min(ys)),
                    "points": abs_points,
                    "fillColor": "transparent",
                }
            )
            converted[eid] = shape
            order.append(eid)
        elif kind == "text":
            container_id = element.get("containerId")
            if container_id and container_id in by_id:
                bound_text_ids.add(eid)
                continue  # applied to its container below
            shape = base(element, "text", eid)
            shape.update(
                {
                    "text": str(element.get("text") or ""),
                    "fontSize": _num(element.get("fontSize"), 16) or 16,
                    "fontFamily": "sans-serif",
                    "fillColor": "transparent",
                }
            )
            converted[eid] = shape
            order.append(eid)
        else:
            skipped[str(kind)] = skipped.get(str(kind), 0) + 1

    # Labels: text elements bound to a container become the container's text.
    for text_id in bound_text_ids:
        text_el = by_id[text_id]
        container = converted.get(str(text_el.get("containerId")))
        if container is not None:
            container["text"] = str(text_el.get("text") or "")
            container["fontSize"] = _num(text_el.get("fontSize"), 14) or 14

    # Arrow bindings: resolve to the side of the bound shape the endpoint touches.
    for shape in converted.values():
        for side in ("start", "end"):
            target_id = shape.pop(f"_{side}_bound_to", None)
            target = converted.get(str(target_id)) if target_id is not None else None
            if (
                target
                and target["type"] in ("rectangle", "diamond", "ellipse")
                and shape.get("points")
            ):
                point = shape["points"][0] if side == "start" else shape["points"][-1]
                shape[f"{side}Binding"] = {
                    "elementId": target["id"],
                    "anchorSide": _anchor_side(point, target),
                }

    elements = [converted[eid] for eid in order]
    sketch = {
        "version": 1,
        "elements": elements,
        "viewport": {"zoom": 1, "scrollX": 0, "scrollY": 0},
        "background": (data.get("appState") or {}).get("viewBackgroundColor") or "#ffffff",
    }
    warnings = [f"skipped_{kind}:{count}" for kind, count in sorted(skipped.items())]
    return json.dumps(sketch, ensure_ascii=False), warnings


# --------------------------------------------------------------------------- #
#  Loose files
# --------------------------------------------------------------------------- #


def _decode(data: bytes) -> str:
    text = data.decode("utf-8-sig", errors="replace")
    return text.replace("\r\n", "\n")


def parse_loose_file(
    filename: str, data: bytes, limits: ImportLimits
) -> tuple[Optional[ImportDiagram], Optional[ImportSkipped]]:
    """One uploaded (non-ZIP) file -> a diagram, or the reason it was skipped."""
    name = posixpath.basename(filename) or "file"
    if len(data) > limits.max_file_bytes:
        return None, ImportSkipped(name, "too_large")
    if not data.strip():
        return None, ImportSkipped(name, "empty")

    text = _decode(data)
    detected = detect_diagram_type(name, text)
    _, ext = split_extension(name)

    if detected is None and ext in (".md", ".markdown"):
        parsed = parse_markdown_file(text)
        if parsed:
            diagram_type, code, description, title = parsed
            return (
                ImportDiagram(
                    title or title_from_filename(name), diagram_type, code, description, name
                ),
                None,
            )
        return None, ImportSkipped(name, "no_diagram_block")
    if detected is None:
        return None, ImportSkipped(name, "unsupported_type")

    if ext in (".md", ".markdown"):
        # A Markdown file whose body is recognisable code: still prefer the fenced block if any.
        parsed = parse_markdown_file(text)
        if parsed:
            diagram_type, code, description, title = parsed
            return (
                ImportDiagram(
                    title or title_from_filename(name), diagram_type, code, description, name
                ),
                None,
            )

    warnings: list[str] = []
    try:
        if detected == "excalidraw":
            content, warnings = excalidraw_to_freehand(text)
            detected = "freehand"
        elif detected == "freehand":
            content = normalize_freehand(text)
        else:
            content = text.strip("\n")
    except ImportError_ as exc:
        return None, ImportSkipped(name, str(exc))
    return ImportDiagram(title_from_filename(name), detected, content, None, name, warnings), None


# --------------------------------------------------------------------------- #
#  ZIP archives
# --------------------------------------------------------------------------- #


def is_zip(data: bytes) -> bool:
    """Cheap signature check before trying to open an archive."""
    return data[:4] in (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")


def _safe_parts(name: str) -> Optional[list[str]]:
    """Path components of a ZIP entry, or None when the path must be ignored."""
    normalized = name.replace("\\", "/")
    parts = [p for p in normalized.split("/") if p not in ("", ".")]
    if not parts or any(p == ".." for p in parts) or normalized.startswith("/"):
        return None
    if any(p.startswith(".") or p == "__MACOSX" for p in parts):
        return None  # hidden files/folders and macOS resource forks
    return parts


def plan_zip_import(data: bytes, limits: ImportLimits) -> ImportPlan:
    """Build the plan for a ZIP: Diagramahub export (manifest) or any archive.

    Folders come from the first path level (below a single top-level folder,
    if the archive has one). Deeper levels are flattened into that folder.
    A ``.md`` next to a diagram with the same base name is its description.
    """
    plan = ImportPlan()
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise ImportError_("invalid_zip") from exc

    with archive:
        entries = [i for i in archive.infolist() if not i.is_dir()]
        if len(entries) > limits.max_files:
            raise ImportError_("too_many_files")
        if sum(i.file_size for i in entries) > limits.max_total_bytes:
            raise ImportError_("too_large_uncompressed")

        files: dict[str, bytes] = {}
        for info in entries:
            parts = _safe_parts(info.filename)
            if parts is None:
                continue
            if info.file_size > limits.max_file_bytes:
                plan.skipped.append(ImportSkipped("/".join(parts), "too_large"))
                continue
            files["/".join(parts)] = archive.read(info)

    # A Diagramahub export wraps everything in one top-level folder that holds
    # the manifest: unwrap it. Any other archive keeps its top-level folder.
    tops = {path.split("/", 1)[0] for path in files}
    if len(tops) == 1 and all("/" in path for path in files):
        top = next(iter(tops))
        if f"{top}/{MANIFEST_FILENAME}" in files:
            files = {path.split("/", 1)[1]: content for path, content in files.items()}

    manifest = None
    if MANIFEST_FILENAME in files:
        try:
            candidate = json.loads(_decode(files[MANIFEST_FILENAME]))
            if isinstance(candidate, dict) and candidate.get("format") == "diagramahub-export":
                manifest = candidate
        except ValueError:
            manifest = None

    folder_colors: dict[str, Optional[str]] = {}
    folder_display: dict[str, str] = {}
    if manifest:
        for entry in manifest.get("folders") or []:
            if isinstance(entry, dict) and entry.get("path"):
                folder_display[str(entry["path"])] = str(entry.get("name") or entry["path"])
                folder_colors[str(entry["path"])] = (
                    entry.get("color") if isinstance(entry.get("color"), str) else None
                )
        manifest_titles = {
            str(d["path"]): str(d.get("title") or "")
            for d in manifest.get("diagrams") or []
            if isinstance(d, dict) and d.get("path")
        }
    else:
        manifest_titles = {}

    diagram_paths = [
        path
        for path in files
        if path not in (MANIFEST_FILENAME, "README.md") and not is_zip(files[path])
    ]
    for path in files:
        if is_zip(files[path]):
            plan.skipped.append(ImportSkipped(path, "nested_zip"))

    # Markdown description siblings: "X.md" next to "X.<diagram ext>".
    bases_with_diagram = set()
    for path in diagram_paths:
        base, ext = split_extension(path)
        if ext in _EXTENSION_TYPES:
            bases_with_diagram.add(base)
    description_files = {
        path
        for path in diagram_paths
        if split_extension(path)[1] in (".md", ".markdown")
        and split_extension(path)[0] in bases_with_diagram
    }

    folders: dict[str, ImportFolder] = {}
    taken_root: set[str] = set()
    taken_in_folder: dict[str, set[str]] = {}

    for path in diagram_paths:
        if path in description_files:
            continue
        parts = path.split("/")
        folder_key = parts[0] if len(parts) > 1 else None
        diagram, skipped = parse_loose_file(parts[-1], files[path], limits)
        if skipped:
            skipped.source = path
            plan.skipped.append(skipped)
            continue
        assert diagram is not None
        diagram.source = path
        if path in manifest_titles and manifest_titles[path]:
            diagram.title = manifest_titles[path][:100]
        base, _ = split_extension(path)
        for sibling in (f"{base}.md", f"{base}.markdown"):
            if sibling in description_files and diagram.description is None:
                description = _decode(files[sibling]).strip()
                # Our own export writes "# Title\n\n<description>": drop that heading.
                lines = description.splitlines()
                if lines and lines[0].startswith("# "):
                    description = "\n".join(lines[1:]).strip()
                diagram.description = description or None
        if folder_key is None:
            diagram.title = unique_name(diagram.title, taken_root)
            plan.root_diagrams.append(diagram)
        else:
            folder = folders.get(folder_key)
            if folder is None:
                folder = ImportFolder(
                    name=sanitize_filename(folder_display.get(folder_key, folder_key), "folder")[
                        :100
                    ],
                    color=folder_colors.get(folder_key),
                )
                folders[folder_key] = folder
                taken_in_folder[folder_key] = set()
            diagram.title = unique_name(diagram.title, taken_in_folder[folder_key])
            folder.diagrams.append(diagram)

    # Empty folders declared by the manifest are still created.
    for key, display in folder_display.items():
        if key not in folders:
            folders[key] = ImportFolder(
                name=sanitize_filename(display, "folder")[:100], color=folder_colors.get(key)
            )

    plan.folders = list(folders.values())
    return plan


def plan_upload(filename: str, data: bytes, limits: ImportLimits) -> ImportPlan:
    """Plan for one uploaded file: a ZIP archive or a loose diagram file."""
    if is_zip(data) or filename.lower().endswith(".zip"):
        return plan_zip_import(data, limits)
    plan = ImportPlan()
    diagram, skipped = parse_loose_file(filename, data, limits)
    if diagram:
        plan.root_diagrams.append(diagram)
    if skipped:
        plan.skipped.append(skipped)
    return plan
