"""
Tests para fix_prompts.py — funciones de generación de prompts para corrección con IA.
"""
import pytest

from app.api.v1.diagrams.fix_prompts import (
    build_d2_fix_prompt,
    build_fix_prompt,
)


class TestBuildD2FixPrompt:
    """Tests para build_d2_fix_prompt."""

    def test_returns_prompt_with_d2_syntax_rules(self):
        prompt = build_d2_fix_prompt("a -> b", language="es")
        assert "D2" in prompt
        assert "->" in prompt
        assert "<->" in prompt
        assert "--" in prompt
        assert "shape" in prompt.lower()
        assert "style" in prompt.lower()
        assert "#" in prompt

    def test_includes_diagram_code(self):
        code = "server -> database: query"
        prompt = build_d2_fix_prompt(code, language="es")
        assert code in prompt

    def test_includes_error_context_when_provided(self):
        error = "Unbalanced braces at line 3"
        prompt = build_d2_fix_prompt("a {", error_context=error, language="es")
        assert error in prompt

    def test_no_error_section_when_no_context(self):
        prompt = build_d2_fix_prompt("a -> b", language="es")
        assert "ERROR DETECTADO" not in prompt

    def test_spanish_language(self):
        prompt = build_d2_fix_prompt("a -> b", language="es")
        assert "Eres un experto en diagramas D2" in prompt
        assert "INSTRUCCIONES:" in prompt

    def test_english_language(self):
        prompt = build_d2_fix_prompt("a -> b", language="en")
        assert "You are an expert in D2 diagrams" in prompt
        assert "INSTRUCTIONS:" in prompt

    def test_unknown_language_defaults_to_spanish(self):
        prompt = build_d2_fix_prompt("a -> b", language="fr")
        assert "Eres un experto en diagramas D2" in prompt

    def test_includes_d2_specific_elements(self):
        prompt = build_d2_fix_prompt("a -> b", language="es")
        # D2-specific syntax rules
        assert "Conexiones dirigidas" in prompt
        assert "Conexiones bidireccionales" in prompt
        assert "Contenedores" in prompt
        assert "Formas (shape)" in prompt
        assert "Estilos (style)" in prompt
        assert "Comentarios: #" in prompt

    def test_includes_json_response_format(self):
        prompt = build_d2_fix_prompt("a -> b", language="es")
        assert "corrected_code" in prompt
        assert "explanation" in prompt
        assert "changes_summary" in prompt

    def test_code_block_uses_d2_language(self):
        prompt = build_d2_fix_prompt("a -> b", language="es")
        assert "```d2" in prompt


class TestBuildFixPromptD2Routing:
    """Tests para el enrutamiento de D2 en build_fix_prompt."""

    def test_routes_d2_type(self):
        prompt = build_fix_prompt("a -> b", "d2", language="es")
        assert "D2" in prompt
        assert "Mermaid" not in prompt
        assert "PlantUML" not in prompt

    def test_routes_d2_case_insensitive(self):
        prompt = build_fix_prompt("a -> b", "D2", language="es")
        assert "D2" in prompt

    def test_plantuml_still_routes_correctly(self):
        prompt = build_fix_prompt("@startuml", "plantuml", language="es")
        assert "PlantUML" in prompt

    def test_mermaid_still_routes_correctly(self):
        prompt = build_fix_prompt("graph TD", "flowchart", language="es")
        assert "Mermaid" in prompt

    def test_uml_routes_to_plantuml(self):
        prompt = build_fix_prompt("@startuml", "uml", language="es")
        assert "PlantUML" in prompt
