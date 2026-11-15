"""
Prompts that produce a diagram in the chat are saved to the prompt history.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.api.v1.chat_sessions.services import ChatSessionService

pytestmark = pytest.mark.unit


def _service(repo: MagicMock | None) -> ChatSessionService:
    return ChatSessionService(
        session_repo=MagicMock(),
        message_repo=MagicMock(),
        ai_service=MagicMock(),
        prompt_history_repo=repo,
    )


async def test_prompt_on_an_empty_diagram_is_a_creation() -> None:
    repo = MagicMock(upsert=AsyncMock())

    await _service(repo)._record_prompt("u1", "  a login flow  ", "", "d1", None)

    repo.upsert.assert_awaited_once_with("u1", "a login flow", "creation", "d1")


async def test_prompt_on_an_existing_diagram_is_an_improvement() -> None:
    repo = MagicMock(upsert=AsyncMock())

    await _service(repo)._record_prompt("u1", "add a retry", "graph TD\n A-->B", "d1", None)

    repo.upsert.assert_awaited_once_with("u1", "add a retry", "improvement", "d1")


async def test_preset_actions_are_not_recorded() -> None:
    repo = MagicMock(upsert=AsyncMock())

    await _service(repo)._record_prompt("u1", "Fix the diagram", "graph TD", "d1", "fix")

    repo.upsert.assert_not_awaited()


async def test_long_prompts_are_cut_to_the_schema_limit() -> None:
    repo = MagicMock(upsert=AsyncMock())

    await _service(repo)._record_prompt("u1", "x" * 6000, "", None, None)

    assert len(repo.upsert.await_args.args[1]) == 5000


async def test_a_history_failure_never_breaks_the_chat() -> None:
    repo = MagicMock(upsert=AsyncMock(side_effect=RuntimeError("db down")))

    await _service(repo)._record_prompt("u1", "a flow", "", "d1", None)


async def test_without_a_repository_nothing_happens() -> None:
    await _service(None)._record_prompt("u1", "a flow", "", "d1", None)
