"""Neutralize request data before it goes into a log line.

Values that come from a request (path parameters, emails, provider names, IDs)
can carry line breaks or other control characters. Written as-is they let a
caller forge extra log entries or corrupt the log format, so every such value
goes through :func:`log_safe` first.
"""

_MAX_LENGTH = 200


def log_safe(value: object, max_length: int = _MAX_LENGTH) -> str:
    """``value`` as a single printable line, at most ``max_length`` characters."""
    text = str(value).replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    text = "".join(ch if ch.isprintable() else "?" for ch in text)
    if len(text) > max_length:
        return text[:max_length] + "…"
    return text
