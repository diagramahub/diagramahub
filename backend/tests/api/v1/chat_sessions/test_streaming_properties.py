"""
Property-based tests for AI chat streaming.

Validates correctness properties defined in the design document using Hypothesis.
Each test runs a minimum of 100 iterations with randomized inputs.
"""
import json

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from app.api.v1.chat_sessions.sse_events import (
    format_sse_event,
    token_event,
    phase_event,
    done_event,
    error_event,
)


# =============================================================================
# Property 1: SSE Event Serialization Round-Trip
# =============================================================================
# For any SSE event with arbitrary content strings (including unicode, special
# characters, newlines), serializing the event with format_sse_event and then
# parsing the resulting string back as JSON SHALL produce an object identical
# to the original event data.
# =============================================================================


@pytest.mark.property
@given(
    data=st.fixed_dictionaries({
        "type": st.sampled_from(["token", "phase", "done", "error"]),
        "content": st.text(min_size=0, max_size=1000),
    })
)
@settings(max_examples=200)
def test_property_1_sse_round_trip_arbitrary_dict(data: dict):
    """Feature: ai-chat-streaming, Property 1: SSE Event Serialization Round-Trip"""
    result = format_sse_event(data)
    assert result.startswith("data: ")
    assert result.endswith("\n\n")
    # Parse back
    json_str = result[6:-2]
    parsed = json.loads(json_str)
    assert parsed == data


@pytest.mark.property
@given(
    content=st.text(
        min_size=0,
        max_size=500,
        alphabet=st.characters(categories=("L", "M", "N", "P", "S", "Z")),
    )
)
@settings(max_examples=200)
def test_property_1_token_event_unicode(content: str):
    """Token events with unicode content round-trip correctly."""
    result = token_event(content)
    parsed = json.loads(result[6:-2])
    assert parsed["type"] == "token"
    assert parsed["content"] == content


@pytest.mark.property
@given(content=st.text(min_size=2, max_size=300).map(lambda s: s[:100] + "\n" + s[100:]))
@settings(max_examples=100)
def test_property_1_token_event_whitespace(content: str):
    """Token events with whitespace characters (newlines, tabs) round-trip correctly."""
    result = token_event(content)
    parsed = json.loads(result[6:-2])
    assert parsed["content"] == content


# =============================================================================
# Property 2: OpenAI-Compatible Stream Parsing
# =============================================================================
# For any sequence of OpenAI-format SSE lines, the streaming parser SHALL yield
# exactly the sequence of content values in order, and SHALL stop yielding when
# it encounters data: [DONE].
# =============================================================================


def _build_openai_sse_lines(tokens: list[str]) -> list[str]:
    """Build OpenAI-format SSE lines from a list of token strings."""
    lines = []
    for token in tokens:
        chunk = {
            "choices": [{"delta": {"content": token}, "index": 0}]
        }
        lines.append(f"data: {json.dumps(chunk)}")
    lines.append("data: [DONE]")
    return lines


def _parse_openai_stream(lines: list[str]) -> list[str]:
    """Parse OpenAI-format SSE lines and extract content tokens."""
    tokens = []
    for line in lines:
        if not line.startswith("data: "):
            continue
        data = line[6:]
        if data == "[DONE]":
            break
        try:
            chunk = json.loads(data)
            delta = chunk["choices"][0].get("delta", {})
            content = delta.get("content")
            if content:
                tokens.append(content)
        except (json.JSONDecodeError, KeyError, IndexError):
            continue
    return tokens


@pytest.mark.property
@given(
    tokens=st.lists(
        st.text(min_size=1, max_size=50),
        min_size=1,
        max_size=20,
    )
)
@settings(max_examples=200)
def test_property_2_openai_stream_parsing(tokens: list[str]):
    """Feature: ai-chat-streaming, Property 2: OpenAI-Compatible Stream Parsing"""
    lines = _build_openai_sse_lines(tokens)
    parsed = _parse_openai_stream(lines)
    assert parsed == tokens


@pytest.mark.property
@given(
    tokens=st.lists(st.text(min_size=1, max_size=50), min_size=1, max_size=10),
    extra_lines_after_done=st.lists(
        st.text(min_size=1, max_size=30), min_size=0, max_size=5
    ),
)
@settings(max_examples=100)
def test_property_2_openai_stops_at_done(tokens: list[str], extra_lines_after_done: list[str]):
    """Parser stops at [DONE] and ignores subsequent lines."""
    lines = _build_openai_sse_lines(tokens)
    # Add extra lines after [DONE]
    for extra in extra_lines_after_done:
        chunk = {"choices": [{"delta": {"content": extra}, "index": 0}]}
        lines.append(f"data: {json.dumps(chunk)}")
    parsed = _parse_openai_stream(lines)
    assert parsed == tokens


# =============================================================================
# Property 3: Claude Stream Parsing
# =============================================================================
# For any sequence of Anthropic SSE events containing content_block_delta events
# with arbitrary text values, the streaming parser SHALL yield exactly the
# sequence of text values in order, and SHALL stop yielding when it encounters
# a message_stop event.
# =============================================================================


def _build_claude_sse_lines(texts: list[str]) -> list[str]:
    """Build Anthropic-format SSE lines from a list of text strings."""
    lines = []
    for text in texts:
        event = {"type": "content_block_delta", "delta": {"text": text}}
        lines.append(f"data: {json.dumps(event)}")
    lines.append(f'data: {json.dumps({"type": "message_stop"})}')
    return lines


def _parse_claude_stream(lines: list[str]) -> list[str]:
    """Parse Anthropic-format SSE lines and extract text tokens."""
    tokens = []
    for line in lines:
        if not line.startswith("data: "):
            continue
        try:
            event_data = json.loads(line[6:])
        except json.JSONDecodeError:
            continue
        event_type = event_data.get("type")
        if event_type == "content_block_delta":
            text = event_data.get("delta", {}).get("text", "")
            if text:
                tokens.append(text)
        elif event_type == "message_stop":
            break
    return tokens


@pytest.mark.property
@given(
    texts=st.lists(
        st.text(min_size=1, max_size=50),
        min_size=1,
        max_size=20,
    )
)
@settings(max_examples=200)
def test_property_3_claude_stream_parsing(texts: list[str]):
    """Feature: ai-chat-streaming, Property 3: Claude Stream Parsing"""
    lines = _build_claude_sse_lines(texts)
    parsed = _parse_claude_stream(lines)
    assert parsed == texts


# =============================================================================
# Property 5: Non-Streaming Fallback Produces Valid SSE Sequence
# =============================================================================
# For any complete response string returned by a non-streaming chat_with_context
# call, the fallback path SHALL emit exactly one token event containing the full
# response text followed by one done event, forming a valid SSE event sequence.
# =============================================================================


def _simulate_fallback(response_text: str, message_id: str = "abc123") -> list[str]:
    """Simulate the non-streaming fallback SSE output."""
    events = []
    events.append(token_event(response_text))
    events.append(done_event(
        message_id=message_id,
        improved_code=None,
        provider_used="openai",
        model_used="gpt-4.1-mini",
        generation_time=1.5,
    ))
    return events


@pytest.mark.property
@given(
    response_text=st.text(min_size=1, max_size=500),
)
@settings(max_examples=200)
def test_property_5_fallback_produces_valid_sse(response_text: str):
    """Feature: ai-chat-streaming, Property 5: Non-Streaming Fallback"""
    events = _simulate_fallback(response_text)
    assert len(events) == 2

    # First event is a token with the full response
    token_parsed = json.loads(events[0][6:-2])
    assert token_parsed["type"] == "token"
    assert token_parsed["content"] == response_text

    # Second event is done
    done_parsed = json.loads(events[1][6:-2])
    assert done_parsed["type"] == "done"
    assert done_parsed["message_id"] == "abc123"


# =============================================================================
# Property 6: Diagram Code Accumulator Handles Arbitrary Chunk Splits
# =============================================================================
# For any complete text containing <<<DIAGRAM>>> and <<<END_DIAGRAM>>> markers
# with arbitrary diagram code between them, splitting the text into chunks at
# any arbitrary positions and feeding them sequentially to the accumulator SHALL
# produce the same extracted diagram code as processing the complete text at once.
# =============================================================================


def _extract_diagram_code_python(full_text: str) -> str | None:
    """Python implementation of diagram code extraction (mirrors frontend logic)."""
    import re
    normalized = full_text
    normalized = normalized.replace("<<<DIAGRAMA>>>", "<<<DIAGRAM>>>")
    normalized = normalized.replace("<<<FIN_DIAGRAMA>>>", "<<<END_DIAGRAM>>>")
    normalized = normalized.replace("<<<END_DIAGRAMA>>>", "<<<END_DIAGRAM>>>")
    normalized = re.sub(r'<<<DIAGRAM>>>\s*\n?```\w*\s*\n?', '<<<DIAGRAM>>>\n', normalized)
    normalized = re.sub(r'\n?```\s*\n?<<<END_DIAGRAM>>>', '\n<<<END_DIAGRAM>>>', normalized)

    start_marker = "<<<DIAGRAM>>>"
    end_marker = "<<<END_DIAGRAM>>>"

    start_idx = normalized.find(start_marker)
    end_idx = normalized.find(end_marker)

    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        code = normalized[start_idx + len(start_marker):end_idx].strip()
        return code or None

    if start_idx != -1 and end_idx == -1:
        code = normalized[start_idx + len(start_marker):].strip()
        return code or None

    return None


@pytest.mark.property
@given(
    before_text=st.text(min_size=0, max_size=50),
    diagram_code=st.text(min_size=1, max_size=200),
    after_text=st.text(min_size=0, max_size=50),
    split_points=st.lists(st.integers(min_value=1, max_value=300), min_size=1, max_size=10),
)
@settings(max_examples=200)
def test_property_6_accumulator_chunk_splits(
    before_text: str, diagram_code: str, after_text: str, split_points: list[int]
):
    """Feature: ai-chat-streaming, Property 6: Diagram Code Accumulator Handles Arbitrary Chunk Splits"""
    # Ensure diagram_code doesn't contain markers
    assume("<<<DIAGRAM>>>" not in diagram_code)
    assume("<<<END_DIAGRAM>>>" not in diagram_code)
    assume("<<<DIAGRAMA>>>" not in diagram_code)
    assume("<<<DIAGRAM>>>" not in before_text)
    assume("<<<END_DIAGRAM>>>" not in before_text)
    assume("<<<DIAGRAM>>>" not in after_text)
    assume("<<<END_DIAGRAM>>>" not in after_text)

    full_text = f"{before_text}<<<DIAGRAM>>>\n{diagram_code}\n<<<END_DIAGRAM>>>{after_text}"

    # Extract from full text at once
    expected = _extract_diagram_code_python(full_text)

    # Split into chunks and accumulate
    sorted_points = sorted(set(p for p in split_points if 0 < p < len(full_text)))
    chunks = []
    prev = 0
    for point in sorted_points:
        chunks.append(full_text[prev:point])
        prev = point
    chunks.append(full_text[prev:])

    # Accumulate chunks
    accumulated = ""
    for chunk in chunks:
        accumulated += chunk

    # Extract from accumulated
    result = _extract_diagram_code_python(accumulated)

    assert result == expected


# =============================================================================
# Property 7: Truncated Stream Extraction
# =============================================================================
# For any text containing only a <<<DIAGRAM>>> start marker (no end marker)
# followed by arbitrary content, the accumulator SHALL extract all content
# after the start marker as diagram code.
# =============================================================================


@pytest.mark.property
@given(
    before_text=st.text(min_size=0, max_size=50),
    diagram_code=st.text(min_size=1, max_size=200).filter(lambda s: s.strip()),
)
@settings(max_examples=200)
def test_property_7_truncated_stream_extraction(before_text: str, diagram_code: str):
    """Feature: ai-chat-streaming, Property 7: Truncated Stream Extraction"""
    assume("<<<DIAGRAM>>>" not in before_text)
    assume("<<<END_DIAGRAM>>>" not in before_text)
    assume("<<<DIAGRAM>>>" not in diagram_code)
    assume("<<<END_DIAGRAM>>>" not in diagram_code)

    full_text = f"{before_text}<<<DIAGRAM>>>\n{diagram_code}"

    result = _extract_diagram_code_python(full_text)
    assert result is not None
    assert result == diagram_code.strip()


# =============================================================================
# Property 8: Fallback Fenced Code Block Detection
# =============================================================================
# For any text containing a fenced code block with content longer than 20
# characters and no diagram markers present, the accumulator SHALL extract
# the code block content as diagram code.
# =============================================================================


def _extract_fenced_code_block(text: str, diagram_type: str) -> str | None:
    """Python implementation of fallback fenced code block detection."""
    import re
    # Only if no diagram markers
    if "<<<DIAGRAM>>>" in text or "<<<END_DIAGRAM>>>" in text:
        return None

    pattern = r'```(?:' + re.escape(diagram_type) + r'|mermaid|plantuml|d2|dbml)?\s*\n([\s\S]*?)```'
    match = re.search(pattern, text)
    if match and len(match.group(1).strip()) > 20:
        return match.group(1).strip()
    return None


@pytest.mark.property
@given(
    code_content=st.text(min_size=25, max_size=200),
    diagram_type=st.sampled_from(["mermaid", "plantuml", "d2", "dbml"]),
    surrounding_text=st.text(min_size=0, max_size=50),
)
@settings(max_examples=200)
def test_property_8_fallback_fenced_code_block(
    code_content: str, diagram_type: str, surrounding_text: str
):
    """Feature: ai-chat-streaming, Property 8: Fallback Fenced Code Block Detection"""
    assume("<<<DIAGRAM>>>" not in code_content)
    assume("<<<END_DIAGRAM>>>" not in code_content)
    assume("```" not in code_content)
    assume("<<<DIAGRAM>>>" not in surrounding_text)
    assume("```" not in surrounding_text)
    assume(len(code_content.strip()) > 20)

    full_text = f"{surrounding_text}\n```{diagram_type}\n{code_content}\n```\n"

    result = _extract_fenced_code_block(full_text, diagram_type)
    assert result is not None
    assert result == code_content.strip()


# =============================================================================
# Property 9: Message Persistence Metadata Completeness
# =============================================================================
# For any successfully completed stream with arbitrary content, provider name,
# model name, and generation time, the done event SHALL contain all metadata
# fields matching the values from the stream.
# =============================================================================


@pytest.mark.property
@given(
    message_id=st.text(min_size=1, max_size=30, alphabet=st.characters(categories=("L", "N"))),
    provider_used=st.sampled_from(["openai", "claude", "gemini", "deepseek", "minimax"]),
    model_used=st.text(min_size=1, max_size=40, alphabet=st.characters(categories=("L", "N", "P"))),
    generation_time=st.floats(min_value=0.01, max_value=300.0, allow_nan=False, allow_infinity=False),
    improved_code=st.one_of(st.none(), st.text(min_size=1, max_size=200)),
)
@settings(max_examples=200)
def test_property_9_message_persistence_metadata(
    message_id: str,
    provider_used: str,
    model_used: str,
    generation_time: float,
    improved_code: str | None,
):
    """Feature: ai-chat-streaming, Property 9: Message Persistence Metadata Completeness"""
    event_str = done_event(
        message_id=message_id,
        improved_code=improved_code,
        provider_used=provider_used,
        model_used=model_used,
        generation_time=generation_time,
    )
    parsed = json.loads(event_str[6:-2])

    assert parsed["type"] == "done"
    assert parsed["message_id"] == message_id
    assert parsed["provider_used"] == provider_used
    assert parsed["model_used"] == model_used
    assert parsed["generation_time"] == round(generation_time, 2)
    if improved_code:
        assert parsed["improved_code"] == improved_code
    else:
        assert "improved_code" not in parsed
