"""Code generation prompts and reply extraction (0.8.1 G3/G4/G5/G8)."""

import pytest

from app.api.v1.ai_providers.prompts import (
    build_code_system_prompt,
    build_generate_user_prompt,
    build_improve_user_prompt,
    extract_diagram_code,
)

CODE = "graph TD\n  A-->B"


@pytest.mark.parametrize(
    "reply",
    [
        f"<<<DIAGRAM>>>\n{CODE}\n<<<END_DIAGRAM>>>",
        f"Aquí está tu diagrama:\n<<<DIAGRAM>>>\n{CODE}\n<<<END_DIAGRAM>>>\nEspero que te sirva.",
        f"<<<DIAGRAM>\n{CODE}\n<<<END_DIAGRAM>",  # malformed markers (seen from Gemini)
        f"{CODE}\n<<<END_DIAGRAM>>>",  # end marker only (seen from DeepSeek)
        f"<<<DIAGRAMA>>>\n{CODE}\n<<<END_DIAGRAMA>>>",  # Spanish markers
        f"Here you go:\n```mermaid\n{CODE}\n```\nEnjoy!",  # fenced block after prose
        f"<think>razonando...</think>\n<<<DIAGRAM>>>\n{CODE}\n<<<END_DIAGRAM>>>",
        CODE,  # bare code
        f"```d2\n{CODE}\n```",
        f"{CODE}\n>>>END_DIAGRAM>>>",  # mangled end marker
        f"{CODE}\n<END_DIAGRAM>",
        f"{CODE}\n<<<_DIAGRAM>>\nend_diagram",
        f"{CODE}\n<",
    ],
)
def test_extract_diagram_code_handles_real_reply_shapes(reply: str) -> None:
    assert extract_diagram_code(reply) == CODE


def test_extract_returns_empty_for_empty_replies() -> None:
    assert extract_diagram_code("") == ""
    assert extract_diagram_code("<<<DIAGRAM>>>\n<<<END_DIAGRAM>>>") == ""


def test_system_prompt_is_english_with_reference_rules_and_output_contract() -> None:
    prompt = build_code_system_prompt("dbml", "es")
    assert "DBML SYNTAX REFERENCE" in prompt
    assert "ASCII" in prompt and "Never Ref" not in prompt  # verified DBML rules
    assert "in Spanish" in prompt
    assert "code block tagged dbml" in prompt
    assert "in English" in build_code_system_prompt("mermaid", "en")


def test_system_prompt_is_stable_and_user_prompts_carry_the_request() -> None:
    assert build_code_system_prompt("d2", "es") == build_code_system_prompt("d2", "es")
    assert "cylinder" in build_code_system_prompt("d2", "es")
    assert build_generate_user_prompt("  un flujo  ").endswith("un flujo")
    improve = build_improve_user_prompt(CODE, "agrega C")
    assert CODE in improve and "agrega C" in improve


def test_a_node_named_diagram_is_kept() -> None:
    assert extract_diagram_code("```d2\ndiagram\ndiagram -> b\n```") == "diagram\ndiagram -> b"
