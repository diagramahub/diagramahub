"""Chat code handling (0.8.1): reply splitting, response mode, D2 validation."""

import pytest

from app.api.v1.chat_sessions.services import ChatSessionService
from app.api.v1.diagrams.syntax_validator import SyntaxValidator

CODE = "flowchart TD\n    A[Inicio] --> B[Fin]"
split = ChatSessionService._split_reply


@pytest.mark.parametrize(
    "reply",
    [
        f"Listo, aquí está:\n<<<DIAGRAM>>>\n{CODE}\n<<<END_DIAGRAM>>>\nAgregué el fin.",
        f"Listo, aquí está:\n<<<DIAGRAM>\n{CODE}\n<<<END_DIAGRAM>\nAgregué el fin.",  # malformed
        f"Listo, aquí está:\n```mermaid\n{CODE}\n```\nAgregué el fin.",
        f"Listo, aquí está:\n```text\n{CODE}\n```\nAgregué el fin.",  # any fence tag (seen from Gemini)
    ],
)
def test_split_reply_returns_code_and_the_text_around_it(reply: str) -> None:
    code, text = split(reply, "mermaid")
    assert code == CODE
    assert text == "Listo, aquí está:\n\nAgregué el fin."


def test_split_reply_handles_unclosed_blocks_and_bare_code() -> None:
    assert split(f"```mermaid\n{CODE}", "mermaid")[0] == CODE
    assert split("Aquí:\n@startuml\nA -> B\n@enduml", "plantuml")[0] == "@startuml\nA -> B\n@enduml"
    assert split("Table users {\n  id integer [pk]\n}", "dbml")[0].startswith("Table users")


def test_split_reply_without_code_keeps_the_text() -> None:
    assert split("Claro, ¿qué quieres cambiar?", "mermaid") == (None, "Claro, ¿qué quieres cambiar?")


@pytest.mark.parametrize(
    ("message", "mode"),
    [
        ("Crea un flujo de urgencias (¿requiere cirugía? ¿hay camas?)", "code"),
        ("Agrega un paso de pago, ¿puede ser con tarjeta?", "code"),
        ("¿Qué hace este diagrama?", "text"),
        ("Explica el flujo", "text"),
        ("create a login flow", "code"),
    ],
)
def test_requests_that_start_with_an_action_are_code_even_with_questions(message: str, mode: str) -> None:
    assert ChatSessionService._detect_response_mode(message) == mode


def test_truncated_notice_is_localized() -> None:
    assert "se cortó" in ChatSessionService._truncated_notice("es")
    assert "cut off" in ChatSessionService._truncated_notice("en")


@pytest.mark.integration
async def test_d2_validation_uses_the_real_renderer() -> None:
    """Errors a brace count can't see (unknown shapes) are now caught for the retry."""
    bad = await SyntaxValidator.validate("db: {shape: database}", "d2")
    good = await SyntaxValidator.validate("db: {shape: cylinder}\napi -> db", "d2")
    assert good.is_valid is True
    assert bad.is_valid is False and "database" in (bad.error_message or "")
