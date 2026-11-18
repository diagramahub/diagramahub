"""
The diagram types Mermaid recognizes, and how to find a diagram's header.

Mirrors the detectors of the `mermaid` version the frontend bundles (12.3):
the server can only check Mermaid structurally, so it must at least accept
every diagram the browser renders. When the frontend upgrades Mermaid, add the
new headers here (the frontend's real parser is the final word).
"""

import re
from typing import Optional

# Header keywords, as Mermaid's detectors spell them.
MERMAID_DIAGRAM_KEYWORDS: tuple[str, ...] = (
    "flowchart",
    "flowchart-elk",
    "graph",
    "sequenceDiagram",
    "classDiagram",
    "classDiagram-v2",
    "stateDiagram",
    "stateDiagram-v2",
    "erDiagram",
    "gantt",
    "pie",
    "journey",
    "gitGraph",
    "mindmap",
    "timeline",
    "quadrantChart",
    "requirementDiagram",
    "requirement",
    "C4Context",
    "C4Container",
    "C4Component",
    "C4Dynamic",
    "C4Deployment",
    "sankey",
    "sankey-beta",
    "xychart",
    "xychart-beta",
    "block",
    "block-beta",
    "packet",
    "packet-beta",
    "kanban",
    "architecture",
    "architecture-beta",
    "radar-beta",
    "treemap",
    "treemap-beta",
    "venn-beta",
    "usecase-beta",
    "swimlane-beta",
    "agentflow-beta",
    "ishikawa",
    "ishikawa-beta",
    "cynefin-beta",
    "wardley-beta",
    "treeView-beta",
    "eventmodeling",
    "railroad-beta",
    "railroad-ebnf-beta",
    "railroad-abnf-beta",
    "railroad-peg-beta",
)

# Longest first so "stateDiagram-v2" wins over "stateDiagram". A keyword ends
# at whitespace or at the end of the line ("block:" in D2 is not Mermaid).
MERMAID_KEYWORD_PATTERN = (
    "(?:"
    + "|".join(re.escape(k) for k in sorted(MERMAID_DIAGRAM_KEYWORDS, key=len, reverse=True))
    + r")(?=\s|$)"
)
_KEYWORD_RE = re.compile(MERMAID_KEYWORD_PATTERN)

# Diagrams whose blocks open with "subgraph" and close with "end".
SUBGRAPH_DIAGRAMS = frozenset({"flowchart", "flowchart-elk", "graph", "swimlane-beta"})


def mermaid_header_line(code: str) -> tuple[str, int]:
    """The first line that is not front matter, a %% comment/directive or blank.

    Returns the line (stripped) and its 1-based number, or ("", 0) if none.
    """
    lines = code.splitlines()
    i = 0
    while i < len(lines) and not lines[i].strip():
        i += 1
    if i < len(lines) and lines[i].strip() == "---":
        closing = next((j for j in range(i + 1, len(lines)) if lines[j].strip() == "---"), None)
        if closing is not None:
            i = closing + 1
    for j in range(i, len(lines)):
        line = re.sub(r"%%.*$", "", lines[j]).strip()
        if line:
            return line, j + 1
    return "", 0


def mermaid_diagram_keyword(code: str) -> Optional[str]:
    """The diagram type keyword the code starts with, or None if Mermaid wouldn't know it."""
    line, _ = mermaid_header_line(code)
    match = _KEYWORD_RE.match(line)
    return match.group(0) if match else None
