"""
Tests for SSE event formatters.

Covers unit tests and property-based tests for the sse_events module.
"""
import json

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.api.v1.chat_sessions.sse_events import (
    done_event,
    error_event,
    format_sse_event,
    phase_event,
    token_event,
)


class TestFormatSSEEvent:
    """Unit tests for format_sse_event."""

    def test_basic_dict(self):
        result = format_sse_event({"type": "token", "content": "hello"})
        assert result == 'data: {"type": "token", "content": "hello"}\n\n'

    def test_unicode_content(self):
        result = format_sse_event({"type": "token", "content": "café ñ 日本語"})
        assert "café ñ 日本語" in result
        assert result.startswith("data: ")
        assert result.endswith("\n\n")

    def test_newline_in_content(self):
        result = format_sse_event({"type": "token", "content": "line1\nline2"})
        # JSON encodes newlines as \\n, so the SSE data line is a single line
        parsed = json.loads(result[6:-2])  # strip "data: " and "\n\n"
        assert parsed["content"] == "line1\nline2"

    def test_empty_dict(self):
        result = format_sse_event({})
        assert result == "data: {}\n\n"

    def test_special_characters(self):
        result = format_sse_event({"content": 'quotes "and" <brackets>'})
        parsed = json.loads(result[6:-2])
        assert parsed["content"] == 'quotes "and" <brackets>'


class TestTokenEvent:
    """Unit tests for token_event."""

    def test_simple_token(self):
        result = token_event("Hello")
        parsed = json.loads(result[6:-2])
        assert parsed == {"type": "token", "content": "Hello"}

    def test_empty_token(self):
        result = token_event("")
        parsed = json.loads(result[6:-2])
        assert parsed == {"type": "token", "content": ""}

    def test_multiline_token(self):
        result = token_event("graph TD\n  A --> B")
        parsed = json.loads(result[6:-2])
        assert parsed["content"] == "graph TD\n  A --> B"


class TestPhaseEvent:
    """Unit tests for phase_event."""

    def test_thinking_phase(self):
        result = phase_event("Thinking…")
        parsed = json.loads(result[6:-2])
        assert parsed == {"type": "phase", "phase": "Thinking…"}

    def test_analyzing_phase(self):
        result = phase_event("Analyzing diagram…")
        parsed = json.loads(result[6:-2])
        assert parsed == {"type": "phase", "phase": "Analyzing diagram…"}


class TestDoneEvent:
    """Unit tests for done_event."""

    def test_with_improved_code(self):
        result = done_event(
            message_id="abc123",
            improved_code="graph TD\n  A --> B",
            provider_used="openai",
            model_used="gpt-4.1-mini",
            generation_time=3.456,
        )
        parsed = json.loads(result[6:-2])
        assert parsed["type"] == "done"
        assert parsed["message_id"] == "abc123"
        assert parsed["improved_code"] == "graph TD\n  A --> B"
        assert parsed["provider_used"] == "openai"
        assert parsed["model_used"] == "gpt-4.1-mini"
        assert parsed["generation_time"] == 3.46

    def test_without_improved_code(self):
        result = done_event(
            message_id="def456",
            improved_code=None,
            provider_used="gemini",
            model_used="gemini-2.0-flash",
            generation_time=1.2,
        )
        parsed = json.loads(result[6:-2])
        assert parsed["type"] == "done"
        assert parsed["message_id"] == "def456"
        assert "improved_code" not in parsed
        assert parsed["generation_time"] == 1.2

    def test_generation_time_rounding(self):
        result = done_event(
            message_id="x",
            improved_code=None,
            provider_used="claude",
            model_used="claude-sonnet-4-20250514",
            generation_time=2.999999,
        )
        parsed = json.loads(result[6:-2])
        assert parsed["generation_time"] == 3.0


class TestErrorEvent:
    """Unit tests for error_event."""

    def test_simple_error(self):
        result = error_event("AI provider error")
        parsed = json.loads(result[6:-2])
        assert parsed == {"type": "error", "message": "AI provider error"}

    def test_error_with_special_chars(self):
        result = error_event('Error: "timeout" at <provider>')
        parsed = json.loads(result[6:-2])
        assert parsed["message"] == 'Error: "timeout" at <provider>'


# --- Property-Based Tests ---


# Feature: ai-chat-streaming, Property 1: SSE Event Serialization Round-Trip
@pytest.mark.property
@given(
    content=st.text(min_size=0, max_size=500),
)
@settings(max_examples=200)
def test_property_token_event_round_trip(content: str):
    """For any content string, serializing as a token event and parsing back
    produces the original content."""
    result = token_event(content)
    assert result.startswith("data: ")
    assert result.endswith("\n\n")
    json_str = result[6:-2]
    parsed = json.loads(json_str)
    assert parsed["type"] == "token"
    assert parsed["content"] == content


@pytest.mark.property
@given(
    phase=st.text(min_size=1, max_size=100),
)
@settings(max_examples=100)
def test_property_phase_event_round_trip(phase: str):
    """For any phase string, serializing as a phase event and parsing back
    produces the original phase."""
    result = phase_event(phase)
    json_str = result[6:-2]
    parsed = json.loads(json_str)
    assert parsed["type"] == "phase"
    assert parsed["phase"] == phase


@pytest.mark.property
@given(
    message_id=st.text(min_size=1, max_size=50, alphabet=st.characters(categories=("L", "N"))),
    improved_code=st.one_of(st.none(), st.text(min_size=1, max_size=200)),
    provider_used=st.sampled_from(["openai", "claude", "gemini", "deepseek", "minimax"]),
    model_used=st.text(min_size=1, max_size=50, alphabet=st.characters(categories=("L", "N", "P"))),
    generation_time=st.floats(min_value=0.01, max_value=300.0, allow_nan=False),
)
@settings(max_examples=200)
def test_property_done_event_round_trip(
    message_id: str,
    improved_code: str | None,
    provider_used: str,
    model_used: str,
    generation_time: float,
):
    """For any done event parameters, serializing and parsing back produces
    consistent metadata."""
    result = done_event(message_id, improved_code, provider_used, model_used, generation_time)
    json_str = result[6:-2]
    parsed = json.loads(json_str)
    assert parsed["type"] == "done"
    assert parsed["message_id"] == message_id
    assert parsed["provider_used"] == provider_used
    assert parsed["model_used"] == model_used
    assert parsed["generation_time"] == round(generation_time, 2)
    if improved_code:
        assert parsed["improved_code"] == improved_code
    else:
        assert "improved_code" not in parsed


@pytest.mark.property
@given(
    message=st.text(min_size=1, max_size=200),
)
@settings(max_examples=100)
def test_property_error_event_round_trip(message: str):
    """For any error message, serializing as an error event and parsing back
    produces the original message."""
    result = error_event(message)
    json_str = result[6:-2]
    parsed = json.loads(json_str)
    assert parsed["type"] == "error"
    assert parsed["message"] == message
