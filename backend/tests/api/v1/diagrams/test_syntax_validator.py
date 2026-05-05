"""
Tests unitarios para SyntaxValidator — validación D2, DBML y enrutamiento.
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
class TestValidateDbml:
    """Tests para el método validate_dbml."""

    @pytest.mark.asyncio
    async def test_empty_code_returns_invalid(self):
        result = await SyntaxValidator.validate_dbml("")
        assert result.is_valid is False
        assert "vacío" in result.error_message

    @pytest.mark.asyncio
    async def test_whitespace_only_returns_invalid(self):
        result = await SyntaxValidator.validate_dbml("   \n  \n  ")
        assert result.is_valid is False
        assert "vacío" in result.error_message

    @pytest.mark.asyncio
    async def test_none_code_returns_invalid(self):
        result = await SyntaxValidator.validate_dbml(None)
        assert result.is_valid is False
        assert "vacío" in result.error_message

    @pytest.mark.asyncio
    async def test_simple_valid_table(self):
        code = "Table users {\n  id integer [primary key]\n  name varchar\n}"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is True
        assert result.error_message is None

    @pytest.mark.asyncio
    async def test_valid_table_with_ref(self):
        code = (
            "Table users {\n  id integer [primary key]\n  name varchar\n}\n\n"
            "Table posts {\n  id integer [primary key]\n  user_id integer\n}\n\n"
            "Ref: posts.user_id > users.id"
        )
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_valid_enum(self):
        code = "Enum status {\n  active\n  inactive\n  pending\n}"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_valid_ref_only(self):
        code = "Table a {\n  id int\n}\nTable b {\n  a_id int\n}\nRef: b.a_id > a.id"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_valid_inline_ref(self):
        code = "Table posts {\n  id integer [primary key]\n  user_id integer [ref: > users.id]\n}"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_no_definitions_returns_invalid(self):
        code = "// just a comment\nsome random text"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is False
        assert "Table" in result.error_message or "Enum" in result.error_message or "Ref" in result.error_message

    @pytest.mark.asyncio
    async def test_unbalanced_open_brace(self):
        code = "Table users {\n  id integer\n"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is False
        assert "sin cerrar" in result.error_message

    @pytest.mark.asyncio
    async def test_unbalanced_close_brace(self):
        code = "Table users {\n  id integer\n}\n}"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is False
        assert "'}'" in result.error_message
        assert result.error_line == 4

    @pytest.mark.asyncio
    async def test_comments_are_ignored_for_braces(self):
        code = "// { this brace in comment\nTable users {\n  id integer\n}"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_braces_in_strings_are_ignored(self):
        code = "Table users {\n  id integer [note: 'use { carefully}']\n}"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_invalid_table_format(self):
        code = "Table {\n  id integer\n}"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is False
        # "Table {" without a name is not recognized as a Table definition
        assert result.error_message is not None

    @pytest.mark.asyncio
    async def test_invalid_ref_format(self):
        code = "Table users {\n  id integer\n}\nRef invalid_ref"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is False
        assert "Formato de relación" in result.error_message

    @pytest.mark.asyncio
    async def test_valid_ref_block_format(self):
        code = "Table a {\n  id int\n}\nTable b {\n  a_id int\n}\nRef {\n  b.a_id > a.id\n}"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_valid_table_with_schema(self):
        code = "Table public.users {\n  id integer [primary key]\n  name varchar\n}"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_valid_table_with_alias(self):
        code = "Table users as U {\n  id integer [primary key]\n  name varchar\n}"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_multiple_unclosed_braces(self):
        code = "Table users {\nTable posts {"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is False
        assert "sin cerrar" in result.error_message

    @pytest.mark.asyncio
    async def test_ref_many_to_many(self):
        code = "Table a {\n  id int\n}\nTable b {\n  a_id int\n}\nRef: b.a_id <> a.id"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_ref_one_to_one(self):
        code = "Table a {\n  id int\n}\nTable b {\n  a_id int\n}\nRef: b.a_id - a.id"
        result = await SyntaxValidator.validate_dbml(code)
        assert result.is_valid is True


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

    @pytest.mark.asyncio
    async def test_dbml_routes_to_validate_dbml(self):
        code = "Table users {\n  id integer [primary key]\n  name varchar\n}"
        result = await SyntaxValidator.validate(code, "dbml")
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_dbml_uppercase_routes_to_validate_dbml(self):
        code = "Table users {\n  id integer [primary key]\n  name varchar\n}"
        result = await SyntaxValidator.validate(code, "DBML")
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_dbml_empty_code_returns_invalid(self):
        result = await SyntaxValidator.validate("", "dbml")
        assert result.is_valid is False
        assert "vacío" in result.error_message
