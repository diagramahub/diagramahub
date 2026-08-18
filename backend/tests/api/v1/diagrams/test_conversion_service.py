"""
Tests unitarios para la limpieza de respuestas de conversión (clean_ai_code_response).

Los tags <think> deben eliminarse ANTES de limpiar los fences de markdown:
si la respuesta empieza con <think>, clean_code_response no reconoce el fence
anclado al inicio y el código convertido conservaría los ``` delimiters.
"""
import pytest

from app.api.v1.ai_providers.prompts import clean_ai_code_response


@pytest.mark.unit
class TestCleanAiCodeResponse:
    """Tests para clean_ai_code_response (strip <think> antes de limpiar fences)."""

    def test_think_tags_before_fenced_mermaid_block(self):
        raw = (
            "<think>El diagrama muestra nodos y aristas...</think>\n"
            "```mermaid\n"
            "graph TD\n  A[Start] --> B[End]\n"
            "```"
        )
        result = clean_ai_code_response(raw)
        assert result == "graph TD\n  A[Start] --> B[End]"
        assert "<think>" not in result
        assert "```" not in result

    def test_think_tags_before_fenced_d2_block(self):
        raw = (
            "<think>razonamiento interno</think>\n"
            "```d2\n"
            "x -> y: hello\n"
            "```"
        )
        result = clean_ai_code_response(raw)
        assert result == "x -> y: hello"

    def test_fenced_response_without_think_tags_still_cleaned(self):
        raw = "```plantuml\n@startuml\nAlice -> Bob\n@enduml\n```"
        result = clean_ai_code_response(raw)
        assert result == "@startuml\nAlice -> Bob\n@enduml"

    def test_plain_code_without_fences_or_tags_is_unchanged(self):
        raw = "graph TD\n  A --> B"
        result = clean_ai_code_response(raw)
        assert result == "graph TD\n  A --> B"

    def test_unbalanced_think_tag_truncates_after_it(self):
        raw = "<think>razonamiento sin cerrar\n```mermaid\ngraph TD\n  A --> B\n```"
        result = clean_ai_code_response(raw)
        assert "<think>" not in result

    def test_multiple_think_tag_pairs_are_stripped(self):
        raw = (
            "<think>primer bloque</think>\n"
            "<think>segundo bloque</think>\n"
            "```mermaid\ngraph TD\n  A --> B\n```"
        )
        result = clean_ai_code_response(raw)
        assert result == "graph TD\n  A --> B"
