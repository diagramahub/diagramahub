"""Global request body size limit.

A pure ASGI middleware (not ``BaseHTTPMiddleware``) so it can inspect the
body as it streams in, without buffering it first:

* A declared ``Content-Length`` above the limit is rejected with 413 before a
  single body byte is read.
* A body without ``Content-Length`` (chunked transfer) is counted while it is
  received; once it crosses the limit the request fails with 413. The error is
  raised as an ``HTTPException`` from ``receive()``, which FastAPI re-raises
  from its body parsing and turns into a normal JSON 413 response.

Per-endpoint caps (e.g. the public render endpoint's source length) still
apply on top of this; this is the outer bound for every route.
"""

import re

from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

_TOO_LARGE_DETAIL = "Request body too large"


class BodySizeLimitMiddleware:
    """Reject HTTP requests whose body exceeds ``max_bytes`` with a 413."""

    def __init__(
        self,
        app: ASGIApp,
        max_bytes: int,
        path_overrides: list[tuple[str, int]] | None = None,
    ) -> None:
        """
        Args:
            app: The wrapped ASGI application.
            max_bytes: Maximum accepted request body size in bytes.
            path_overrides: ``(regex, max_bytes)`` pairs for routes that accept
                larger bodies (e.g. file uploads); the first match wins.
        """
        self.app = app
        self.max_bytes = max_bytes
        self.path_overrides = [(re.compile(pattern), limit) for pattern, limit in path_overrides or []]

    def limit_for(self, path: str) -> int:
        """Body limit that applies to ``path``."""
        for pattern, limit in self.path_overrides:
            if pattern.search(path):
                return limit
        return self.max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Enforce the limit on HTTP requests; pass everything else through."""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        max_bytes = self.limit_for(scope.get("path", ""))
        declared = _content_length(scope)
        if declared == -1:
            await JSONResponse({"detail": "Invalid Content-Length header"}, status_code=400)(
                scope, receive, send
            )
            return
        if declared is not None and declared > max_bytes:
            await JSONResponse({"detail": _TOO_LARGE_DETAIL}, status_code=413)(
                scope, receive, send
            )
            return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > max_bytes:
                    raise HTTPException(status_code=413, detail=_TOO_LARGE_DETAIL)
            return message

        await self.app(scope, limited_receive, send)


def _content_length(scope: Scope) -> int | None:
    """Declared Content-Length, ``None`` when absent, ``-1`` when malformed."""
    for name, value in scope.get("headers", []):
        if name == b"content-length":
            try:
                length = int(value)
            except ValueError:
                return -1
            return length if length >= 0 else -1
    return None
