"""
Tests for predefined chat action prompts.
"""

from app.api.v1.ai_providers.prompts import build_unified_chat_prompt


def test_explain_action_includes_explain_instruction() -> None:
    prompt = build_unified_chat_prompt("flowchart TD\nA-->B", "mermaid", "es", "explain")

    assert "ACCION PREDEFINIDA: EXPLICAR" in prompt
    assert "No incluyas codigo" in prompt
    assert "CODIGO COMPLETO OBLIGATORIO" not in prompt
    assert "<<<DIAGRAM>>>" in prompt


def test_improve_ui_action_includes_visual_improvement_instruction() -> None:
    prompt = build_unified_chat_prompt("flowchart TD\nA-->B", "mermaid", "en", "improve_ui")

    assert "PRESET ACTION: IMPROVE UI" in prompt
    assert "Improve the visual presentation" in prompt


def test_fix_action_includes_repair_instruction() -> None:
    prompt = build_unified_chat_prompt("flowchart TD\nA-->B", "mermaid", "es", "fix")

    assert "ACCION PREDEFINIDA: REPARAR" in prompt
    assert "Corrige errores de sintaxis" in prompt
