"""Chat code handling (0.8.1): reply splitting, response mode, D2 validation."""

import pytest

from app.api.v1.chat_sessions.schemas import ChatPresetAction
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


# ---------------------------------------------------------------- truncated retries (Codex review)

from types import SimpleNamespace  # noqa: E402
from unittest.mock import patch  # noqa: E402

from app.api.v1.ai_providers.clients.base import BaseAIClient  # noqa: E402

BROKEN = "<<<DIAGRAM>>>\nflowchart TD\n  subgraph a\n  A-->B\n<<<END_DIAGRAM>>>"  # unbalanced subgraph
CUT_FIX = "<<<DIAGRAM>>>\nflowchart TD\n  subgraph a\n  A-->B\n  end\n  B-->"  # cut mid-reply


class _RetryClient(BaseAIClient):
    """First reply invalid; the corrective (retry) reply is cut at the output limit."""

    def __init__(self):
        super().__init__("k" * 20, "fake", {})

    async def complete(self, system_prompt, user_prompt, *, max_tokens=None, temperature=None):  # noqa: ANN001, ANN201
        return BROKEN

    async def complete_chat(self, system_prompt, messages, language="es"):  # noqa: ANN001, ANN201
        self.last_truncated = len(messages) > 1  # the retry carries the error message
        return CUT_FIX if self.last_truncated else BROKEN

    async def chat_with_context_stream(self, messages, diagram_code, diagram_type, language="es", system_prompt=None, max_tokens=None):  # noqa: ANN001, ANN201
        self.last_truncated = False
        yield BROKEN

    generate_description = fix_diagram = chat_with_context = summarize_conversation = complete

    async def validate_api_key(self) -> bool:
        return True

    @property
    def provider_name(self) -> str:
        return "Fake"


class _Sessions:
    session = SimpleNamespace(id="s1", status="active", summary=None, title="t", user_id="u", diagram_id="d")

    async def get_session_by_id(self, _sid):  # noqa: ANN001, ANN201
        return self.session

    async def update_session_last_provider(self, *a, **k):  # noqa: ANN002, ANN003, ANN201
        return self.session

    update_session_summary = update_session_title = update_session_status = update_session_last_provider


class _Messages:
    def __init__(self):
        self.items = []

    async def create_message(self, session_id, role, content, **extra):  # noqa: ANN001, ANN003, ANN201
        msg = SimpleNamespace(id=f"m{len(self.items)}", session_id=session_id, role=role, content=content,
                              created_at=None, **{"improved_code": None, "improvement_status": None, **extra})
        self.items.append(msg)
        return msg

    async def get_recent_messages(self, _sid, limit=4):  # noqa: ANN001, ANN201
        return self.items[-limit:]

    async def count_messages_by_session(self, _sid):  # noqa: ANN001, ANN201
        return len(self.items)


class _AIService:
    async def get_active_provider_config(self, *_a):  # noqa: ANN002, ANN201
        return SimpleNamespace(provider=SimpleNamespace(value="openai"), api_key="k", model="fake", parameters={})

    async def get_user_settings(self, _uid):  # noqa: ANN001, ANN201
        return SimpleNamespace(auto_fix_generated=True)


def _service():  # noqa: ANN202
    return ChatSessionService(_Sessions(), _Messages(), _AIService())


async def test_streaming_never_offers_a_truncated_retry_as_the_new_diagram() -> None:
    import json

    service = _service()
    with patch("app.api.v1.chat_sessions.services.AIClientFactory.create_client", return_value=_RetryClient()):
        events = [
            json.loads(line[6:])
            async for raw in service.stream_message("s1", "u", "Crea un flujo", "flowchart TD", "mermaid")
            for line in raw.splitlines() if line.startswith("data: ")
        ]
    done = next(e for e in events if e["type"] == "done")
    saved = service.message_repo.items[-1]
    assert done.get("improved_code") is None
    assert saved.improved_code is None and saved.improvement_status is None
    assert "se cortó" in saved.content


async def test_send_message_never_offers_a_truncated_retry_as_the_new_diagram() -> None:
    service = _service()
    with patch("app.api.v1.chat_sessions.services.AIClientFactory.create_client", return_value=_RetryClient()), patch.object(
        ChatSessionService, "_message_to_response", lambda self, msg: msg
    ):
        saved = await service.send_message("s1", "u", "Crea un flujo", "flowchart TD", "mermaid")
    assert saved.improved_code is None and saved.improvement_status is None
    assert "se cortó" in saved.content


# --- 0.8.2: the reply, not the keyword guess, decides whether a diagram was offered ---

offers = ChatSessionService._reply_offers_diagram


class _ReplyClient(_RetryClient):
    """Answers every call with a fixed reply (optionally cut at the output limit)."""

    def __init__(self, reply: str, truncated: bool = False):
        super().__init__()
        self.reply, self.truncated = reply, truncated

    async def complete_chat(self, system_prompt, messages, language="es"):  # noqa: ANN001, ANN201
        self.last_truncated = self.truncated
        return self.reply

    async def chat_with_context_stream(self, messages, diagram_code, diagram_type, language="es", system_prompt=None, max_tokens=None):  # noqa: ANN001, ANN201
        self.last_truncated = self.truncated
        yield self.reply


async def _stream(service, client, content, diagram_type="mermaid", preset=None):  # noqa: ANN001, ANN202
    import json

    with patch("app.api.v1.chat_sessions.services.AIClientFactory.create_client", return_value=client):
        return [
            json.loads(line[6:])
            async for raw in service.stream_message(
                "s1", "u", content, "flowchart TD", diagram_type, preset_action=preset
            )
            for line in raw.splitlines() if line.startswith("data: ")
        ]


@pytest.mark.parametrize(
    "message",
    [
        "Agrégale diseño elegante y algunos emojis",
        "Hazlo más corporativo",
        "Corrígelo por favor",
        "hay un error en el diagrama... revisa y resuélvelo",
        "Diagrama de base de datos donde se vea una relación de una clase de universidad.",
        "Pon los nodos en azul",
    ],
)
def test_real_requests_that_were_taken_for_questions_are_code(message: str) -> None:
    assert ChatSessionService._detect_response_mode(message) == "code"


@pytest.mark.parametrize("message", ["¿Qué hace este diagrama?", "Explica el flujo", "La empresa es grande"])
def test_questions_stay_text(message: str) -> None:
    assert ChatSessionService._detect_response_mode(message) == "text"


def test_reply_offers_a_diagram_only_with_markers_or_a_whole_tagged_block() -> None:
    assert offers(f"Claro:\n<<<DIAGRAM>>>\n{CODE}\n<<<END_DIAGRAM>>>", "mermaid")
    assert offers(f"Claro:\n```mermaid\n%%{{init: {{}}}}%%\n{CODE}\n```", "mermaid")
    assert offers("```plantuml\n@startuml\nA -> B\n@enduml\n```", "plantuml")
    assert offers("```dbml\nTable users {\n  id integer [pk]\n}\n```", "dbml")
    # A snippet that illustrates an answer is not a new diagram
    assert not offers("Usa:\n```mermaid\nstyle A fill:#f9f\n```", "mermaid")
    assert not offers(f"Ejemplo:\n```text\n{CODE}\n```", "mermaid")
    assert not offers(f"<<<DIAGRAM>>>\n{CODE}\n<<<END_DIAGRAM>>>", "mermaid", ChatPresetAction.EXPLAIN)


async def test_streaming_a_question_answered_with_the_diagram_offers_the_preview() -> None:
    service = _service()
    reply = f"Claro, así queda:\n<<<DIAGRAM>>>\n{CODE}\n<<<END_DIAGRAM>>>\nCambié los colores."
    events = await _stream(service, _ReplyClient(reply), "¿Lo puedes poner en azul?")
    modes = [e["mode"] for e in events if e["type"] == "mode"]
    done = next(e for e in events if e["type"] == "done")
    saved = service.message_repo.items[-1]
    assert modes == ["text", "code"]  # the panel learns it was a diagram after all
    assert done["improved_code"] == CODE
    assert saved.improved_code == CODE and saved.improvement_status is not None
    assert "<<<" not in saved.content and "flowchart" not in saved.content


async def test_send_message_a_question_answered_with_the_diagram_offers_the_preview() -> None:
    service = _service()
    reply = f"Claro:\n```mermaid\n{CODE}\n```\nListo."
    with patch("app.api.v1.chat_sessions.services.AIClientFactory.create_client", return_value=_ReplyClient(reply)), patch.object(
        ChatSessionService, "_message_to_response", lambda self, msg: msg
    ):
        saved = await service.send_message("s1", "u", "¿Lo puedes poner en azul?", "flowchart TD", "mermaid")
    assert saved.improved_code == CODE
    assert "```" not in saved.content


async def test_a_cut_diagram_in_a_text_reply_shows_the_notice_not_the_fragment() -> None:
    service = _service()
    reply = "Claro:\n<<<DIAGRAM>>>\nflowchart TD\n    A[Inicio] --> B[Pa"
    await _stream(service, _ReplyClient(reply, truncated=True), "¿Lo puedes poner en azul?")
    saved = service.message_repo.items[-1]
    assert saved.improved_code is None
    assert "se cortó" in saved.content and "flowchart" not in saved.content


async def test_every_chat_reply_gets_the_code_budget() -> None:
    from app.api.v1.ai_providers.clients.base import CODE_MAX_TOKENS

    client = _ReplyClient("Es un flujo de compra.")
    await _stream(_service(), client, "¿Qué hace este diagrama?")
    assert client.parameters["max_tokens"] == CODE_MAX_TOKENS


async def test_a_text_answer_stays_text() -> None:
    service = _service()
    await _stream(service, _ReplyClient("Es un flujo de compra con 3 pasos."), "¿Qué hace este diagrama?")
    saved = service.message_repo.items[-1]
    assert saved.improved_code is None and saved.content == "Es un flujo de compra con 3 pasos."


# --- 0.8.2: chat errors in the user's language ---


class _FailingClient(_ReplyClient):
    """The provider rejects the request (no credits)."""

    async def chat_with_context_stream(self, messages, diagram_code, diagram_type, language="es", system_prompt=None, max_tokens=None):  # noqa: ANN001, ANN201
        from app.api.v1.ai_providers.clients.base import provider_error

        raise provider_error("OpenAI", 402, "insufficient_quota")
        yield ""  # pragma: no cover - makes this an async generator


class _NoProviderAIService(_AIService):
    async def get_active_provider_config(self, *_a):  # noqa: ANN002, ANN201
        return None


async def _stream_lang(service, client, language):  # noqa: ANN001, ANN202
    import json

    with patch("app.api.v1.chat_sessions.services.AIClientFactory.create_client", return_value=client):
        return [
            json.loads(line[6:])
            async for raw in service.stream_message(
                "s1", "u", "Crea un flujo", "flowchart TD", "mermaid", language=language
            )
            for line in raw.splitlines() if line.startswith("data: ")
        ]


def test_provider_errors_speak_the_users_language() -> None:
    from app.api.v1.ai_providers.clients.base import provider_error

    error = provider_error("OpenAI", 402, "insufficient_quota")
    assert error.message_for("en").startswith("OpenAI: the provider account has no credits")
    assert error.message_for("es") == str(error) and "créditos" in str(error)
    # Unclassified errors carry the provider's own (English) text in both languages
    other = provider_error("OpenAI", 500, "boom")
    assert other.message_for("en") == other.message_for("es") == str(other)


@pytest.mark.parametrize(("language", "expected"), [("en", "no credits"), ("es", "créditos")])
async def test_a_provider_failure_is_reported_in_the_users_language(language: str, expected: str) -> None:
    service = _service()
    events = await _stream_lang(service, _FailingClient("x"), language)
    error = next(e for e in events if e["type"] == "error")
    assert expected in error["message"]
    assert expected in service.message_repo.items[-1].content  # the saved error too


@pytest.mark.parametrize(
    ("language", "expected"), [("en", "No AI provider is configured."), ("es", "No hay proveedor de IA configurado.")]
)
async def test_missing_provider_is_reported_in_the_users_language(language: str, expected: str) -> None:
    service = ChatSessionService(_Sessions(), _Messages(), _NoProviderAIService())
    events = await _stream_lang(service, _ReplyClient("x"), language)
    assert next(e for e in events if e["type"] == "error")["message"] == expected
