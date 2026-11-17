"""
Tests de los tipos de diagrama Mermaid 12 y de su validación estructural en el servidor.
"""

import pytest

from app.api.v1.diagrams.mermaid_types import mermaid_diagram_keyword, mermaid_header_line
from app.api.v1.diagrams.syntax_validator import SyntaxValidator
from app.api.v1.projects.import_parsers import detect_type_from_content

# One diagram per header that Mermaid 12.3 added or that the old list missed.
MODERN_DIAGRAMS = {
    "venn-beta": "venn-beta\n  set A\n  set B\n  union A,B",
    "usecase-beta": 'usecase-beta\nactor User("User")\nLogin("Log in")\nUser --> Login',
    "swimlane-beta": "swimlane-beta LR\n  subgraph Customer\n    a[Ask]\n  end\n  a --> a",
    "architecture-beta": "architecture-beta\n  service api(server)[API]",
    "ishikawa-beta": "ishikawa-beta\n  Problem\n    Cause",
    "cynefin-beta": 'cynefin-beta\n  clear\n    "Restart"',
    "wardley-beta": "wardley-beta\ntitle Tea\ncomponent Tea [0.6, 0.8]",
    "treeView-beta": "treeView-beta\n  src/\n    App.tsx",
    "eventmodeling": "eventmodeling\ntf 01 ui ShopUI",
    "railroad-beta": 'railroad-beta\n  digit = terminal("0") ;',
    "treemap-beta": 'treemap-beta\n"Budget"\n    "Rent": 1400',
    "radar-beta": 'radar-beta\n  axis a["A"], b["B"], c["C"]\n  curve x{1, 2, 3}',
    "kanban": "kanban\n  Todo\n    t1[Write docs]",
    "block-beta": "block-beta\n  columns 2\n  block:g\n    a b\n  end",
    "packet-beta": 'packet-beta\n  0-15: "Source Port"',
    "xychart-beta": "xychart-beta\n  bar [1, 2, 3]",
    "sankey-beta": "sankey-beta\n  A,B,10",
    "C4Container": "C4Container\n  title Containers",
}


@pytest.mark.unit
class TestMermaidHeader:
    """La cabecera se busca después del front matter y de las líneas %%."""

    def test_skips_front_matter_and_directives(self):
        code = "---\nconfig:\n  look: neo\n---\n%% note\n%%{init: {}}%%\n\nflowchart LR\n  A-->B"
        assert mermaid_header_line(code) == ("flowchart LR", 8)
        assert mermaid_diagram_keyword(code) == "flowchart"

    def test_longest_keyword_wins(self):
        assert mermaid_diagram_keyword("stateDiagram-v2\n  [*] --> A") == "stateDiagram-v2"
        assert mermaid_diagram_keyword("railroad-ebnf-beta\n  a = 'x' ;") == "railroad-ebnf-beta"

    def test_keyword_must_end_the_word(self):
        # D2 and plain text that only start like a Mermaid keyword
        assert mermaid_diagram_keyword("block: {\n  shape: rectangle\n}") is None
        assert mermaid_diagram_keyword("pies are good") is None
        assert mermaid_diagram_keyword("") is None


@pytest.mark.unit
class TestValidateModernMermaid:
    """Lo que Mermaid 12 renderiza no debe fallar en el servidor."""

    @pytest.mark.parametrize("keyword,code", list(MODERN_DIAGRAMS.items()))
    async def test_new_diagram_types_are_valid(self, keyword, code):
        result = await SyntaxValidator.validate(code, "mermaid")
        assert result.is_valid, result.error_message
        assert mermaid_diagram_keyword(code) == keyword

    async def test_front_matter_config_is_valid(self):
        code = "---\ntitle: Demo\nconfig:\n  layout: elk\n---\nflowchart LR\n  A --> B"
        assert (await SyntaxValidator.validate(code, "mermaid")).is_valid

    async def test_sequence_blocks_closed_with_end_are_valid(self):
        code = (
            "sequenceDiagram\n  A->>B: hi\n  loop Every minute\n    B->>A: ok\n  end\n"
            "  alt ok\n    A->>B: yes\n  else no\n    A->>B: no\n  end"
        )
        assert (await SyntaxValidator.validate(code, "mermaid")).is_valid

    async def test_flowchart_still_checks_subgraphs(self):
        unclosed = await SyntaxValidator.validate(
            "flowchart LR\n  subgraph S\n    A-->B", "mermaid"
        )
        assert not unclosed.is_valid and "sin cerrar" in unclosed.error_message
        stray = await SyntaxValidator.validate("flowchart LR\n  A-->B\n  end", "mermaid")
        assert not stray.is_valid and stray.error_line == 3

    async def test_label_mentioning_subgraph_is_not_a_block(self):
        code = 'flowchart LR\n  A["a subgraph label"] --> B'
        assert (await SyntaxValidator.validate(code, "mermaid")).is_valid

    async def test_unknown_type_reports_the_line(self):
        result = await SyntaxValidator.validate("%% c\nnotADiagram\n  x", "mermaid")
        assert not result.is_valid
        assert "notADiagram" in result.error_message
        assert result.error_line == 2


@pytest.mark.unit
class TestImportDetectsModernMermaid:
    """El import reconoce como Mermaid los tipos nuevos y el front matter."""

    @pytest.mark.parametrize("code", list(MODERN_DIAGRAMS.values()))
    def test_new_types_detected(self, code):
        assert detect_type_from_content(code) == "mermaid"

    def test_front_matter_detected(self):
        assert detect_type_from_content("---\ntitle: X\n---\nvenn-beta\n  set A") == "mermaid"
