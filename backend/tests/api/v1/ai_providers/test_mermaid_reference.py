"""
The newer Mermaid types' syntax reaches the prompts that need it.

(The examples themselves are checked against the real mermaid parser by
frontend/src/utils/__tests__/mermaidReference.test.ts.)
"""

import pytest

from app.api.v1.ai_providers.mermaid_reference import (
    mermaid_type_syntaxes,
    other_mermaid_types_reference,
    syntax_for_keyword,
    type_reference_for_code,
)
from app.api.v1.ai_providers.prompts import (
    build_code_system_prompt,
    build_fix_prompt,
    build_unified_chat_prompt,
)
from app.api.v1.diagrams.mermaid_types import MERMAID_DIAGRAM_KEYWORDS

VENN = 'venn-beta\n  set A\n  set B\n  union A B["both"]'

pytestmark = pytest.mark.unit


def test_every_reference_type_is_a_header_mermaid_knows() -> None:
    syntaxes = mermaid_type_syntaxes()

    assert len(syntaxes) >= 20
    assert set(syntaxes) <= set(MERMAID_DIAGRAM_KEYWORDS)
    for syntax in syntaxes.values():
        assert syntax.example.lstrip().startswith(("---", syntax.keyword))


@pytest.mark.parametrize(
    "keyword, expected",
    [
        ("venn-beta", "venn-beta"),
        ("packet-beta", "packet"),
        ("treemap", "treemap-beta"),
        ("requirement", "requirementDiagram"),
        ("C4Container", "C4Context"),
    ],
)
def test_header_spellings_find_their_entry(keyword: str, expected: str) -> None:
    syntax = syntax_for_keyword(keyword)

    assert syntax is not None and syntax.keyword == expected


@pytest.mark.parametrize("keyword", [None, "flowchart", "sequenceDiagram", "zenuml"])
def test_classic_or_unknown_types_have_no_entry(keyword) -> None:
    assert syntax_for_keyword(keyword) is None


def test_the_fix_prompt_carries_the_syntax_of_the_diagrams_own_type() -> None:
    venn = build_fix_prompt(VENN, "mermaid", "Parse error on line 4", "es")
    flow = build_fix_prompt("flowchart TD\n  A --> ", "mermaid", None, "es")

    assert "SYNTAX OF THIS DIAGRAM TYPE" in venn
    assert syntax_for_keyword("venn-beta").example in venn
    assert "SYNTAX OF THIS DIAGRAM TYPE" not in flow
    assert type_reference_for_code("---\ntitle: x\n---\nkanban\n  todo") != ""


def test_generation_and_chat_teach_the_other_types_only_for_mermaid() -> None:
    reference = other_mermaid_types_reference()

    assert reference in build_code_system_prompt("mermaid", "es")
    assert reference in build_unified_chat_prompt("flowchart TD\n  A", "mermaid", "es")
    assert "OTHER MERMAID DIAGRAM TYPES" not in build_code_system_prompt("plantuml", "es")
    assert "OTHER MERMAID DIAGRAM TYPES" not in build_unified_chat_prompt("a -> b", "d2", "en")


def test_flowchart_extras_teach_motion_and_bpmn() -> None:
    from app.api.v1.ai_providers.mermaid_reference import mermaid_feature_syntaxes

    names = {f.name for f in mermaid_feature_syntaxes()}
    flow_fix = build_fix_prompt(
        "flowchart LR\n  A e1@--> B\n  e1@{ animate: tru", "mermaid", None, "es"
    )

    assert {"animated edges", "step-by-step animation", "BPMN shapes"} <= names
    assert "FLOWCHART EXTRAS" in build_code_system_prompt("mermaid", "es")
    assert "FLOWCHART EXTRAS" in flow_fix and "bpmn-start" in flow_fix
    assert "FLOWCHART EXTRAS" not in build_fix_prompt(VENN, "mermaid", None, "es")
