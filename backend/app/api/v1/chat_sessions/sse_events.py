"""
SSE (Server-Sent Events) event formatters for AI chat streaming.

All events are JSON-encoded and sent as `data:` lines following the SSE protocol.
"""
import json
from typing import Optional


def format_sse_event(data: dict) -> str:
    """Format a dict as an SSE data line.

    Args:
        data: Dictionary to serialize as JSON.

    Returns:
        Formatted SSE event string: ``data: {json}\\n\\n``
    """
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def token_event(content: str) -> str:
    """Create an SSE event for a token chunk from the AI provider.

    Args:
        content: The text chunk received from the provider.

    Returns:
        Formatted SSE token event.
    """
    return format_sse_event({"type": "token", "content": content})


def phase_event(phase: str) -> str:
    """Create an SSE event for a generation phase indicator.

    Args:
        phase: The phase label (e.g., "Thinking…", "Generating code…").

    Returns:
        Formatted SSE phase event.
    """
    return format_sse_event({"type": "phase", "phase": phase})


def mode_event(mode: str) -> str:
    """Create an SSE event indicating the response mode.

    Emitted early in the stream to tell the frontend whether to show
    progressive text or only phase indicators.

    Args:
        mode: Either "text" (show content progressively) or "code"
              (hide content, only show phases until done).

    Returns:
        Formatted SSE mode event.
    """
    return format_sse_event({"type": "mode", "mode": mode})


def done_event(
    message_id: str,
    improved_code: Optional[str],
    provider_used: str,
    model_used: str,
    generation_time: float,
    thinking_content: Optional[str] = None,
) -> str:
    """Create an SSE event indicating stream completion.

    Args:
        message_id: The persisted message ID (MongoDB document _id).
        improved_code: Extracted diagram code, if present.
        provider_used: AI provider name used for generation.
        model_used: AI model name used for generation.
        generation_time: Total generation time in seconds.
        thinking_content: Optional chain-of-thought content from reasoning models.

    Returns:
        Formatted SSE done event with message metadata.
    """
    data: dict = {
        "type": "done",
        "message_id": message_id,
        "provider_used": provider_used,
        "model_used": model_used,
        "generation_time": round(generation_time, 2),
    }
    if improved_code:
        data["improved_code"] = improved_code
    if thinking_content:
        data["thinking_content"] = thinking_content
    return format_sse_event(data)


def error_event(message: str) -> str:
    """Create an SSE event indicating an error.

    Args:
        message: Human-readable error description.

    Returns:
        Formatted SSE error event.
    """
    return format_sse_event({"type": "error", "message": message})
