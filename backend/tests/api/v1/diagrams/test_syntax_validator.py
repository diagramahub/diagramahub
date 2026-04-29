"""
Tests unitarios para SyntaxValidator — validación D2 y enrutamiento.
"""
import pytest

from app.api.v1.diagrams.syntax_validator import SyntaxValidator


@pytest.mark.unit
class TestValidateD2:
    """Tests para el método validate_d2."""

    @pytest.mark.asyncio
    async def test_empty_code_returns_invalid(self):
        result = await SyntaxValidator.validate_d2("")
        assert result.is_valid is False
        assert "vacío" in result.error_message

    @pytest.mark.asyncio
    async def test_whitespace_only_returns_invalid(self):
        result = await SyntaxValidator.validate_d2("   \n  \n  ")
        assert result.is_valid is False
        assert "vacío" in result.error_message

    @pytest.mark.asyncio
    async def test_none_code_returns_invalid(self):
        result = await SyntaxValidator.validate_d2(None)
        assert result.is_valid is False
        assert "vacío" in result.error_message

    @pytest.mark.asyncio
    async def test_simple_valid_d2(self):
        result = await SyntaxValidator.validate_d2("a -> b")
        assert result.is_valid is True
        assert result.error_message is None

    @pytest.mark.asyncio
    async def test_valid_d2_with_braces(self):
        code = "a: {\n  shape: rectangle\n}"
        result = await SyntaxValidator.validate_d2(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_valid_d2_nested_braces(self):
        code = "server: {\n  api: {\n    handler -> db\n  }\n}"
        result = await SyntaxValidator.validate_d2(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_unbalanced_open_brace(self):
        code = "a: {\n  shape: rectangle\n"
        result = await SyntaxValidator.validate_d2(code)
        assert result.is_valid is False
        assert "sin cerrar" in result.error_message

    @pytest.mark.asyncio
    async def test_unbalanced_close_brace(self):
        code = "a -> b\n}"
        result = await SyntaxValidator.validate_d2(code)
        assert result.is_valid is False
        assert "'}'" in result.error_message
        assert result.error_line == 2

    @pytest.mark.asyncio
    async def test_comments_are_ignored(self):
        code = "# This is a comment\na -> b\n# { this brace in comment should be ignored"
        result = await SyntaxValidator.validate_d2(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_braces_in_strings_are_ignored(self):
        code = 'a: "label with { brace"'
        result = await SyntaxValidator.validate_d2(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_inline_comment_braces_ignored(self):
        code = "a -> b # { comment brace"
        result = await SyntaxValidator.validate_d2(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_multiple_unclosed_braces(self):
        code = "a: {\nb: {"
        result = await SyntaxValidator.validate_d2(code)
        assert result.is_valid is False
        assert "2" in result.error_message


@pytest.mark.unit
class TestValidateRouting:
    """Tests para el enrutamiento del método validate()."""

    @pytest.mark.asyncio
    async def test_d2_routes_to_validate_d2(self):
        result = await SyntaxValidator.validate("a -> b", "d2")
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_d2_uppercase_routes_to_validate_d2(self):
        result = await SyntaxValidator.validate("a -> b", "D2")
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_d2_empty_code_returns_invalid(self):
        result = await SyntaxValidator.validate("", "d2")
        assert result.is_valid is False
        assert "vacío" in result.error_message

    @pytest.mark.asyncio
    async def test_plantuml_still_routes_correctly(self):
        code = "@startuml\nA -> B\n@enduml"
        result = await SyntaxValidator.validate(code, "plantuml")
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_mermaid_still_routes_correctly(self):
        code = "flowchart LR\n  A --> B"
        result = await SyntaxValidator.validate(code, "mermaid")
        assert result.is_valid is True
