"""
Kroki client module for server-side diagram rendering.

Encapsulates HTTP communication with the Kroki service.
Follows the Dependency Inversion Principle (SOLID) with an abstract
interface and a concrete implementation using httpx.AsyncClient.
"""
from abc import ABC, abstractmethod

import httpx


class KrokiRenderError(Exception):
    """Error returned by the Kroki service during rendering."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Kroki error {status_code}: {detail}")


class KrokiTimeoutError(Exception):
    """Timeout or connection error when communicating with Kroki."""

    pass


class IKrokiClient(ABC):
    """Abstract interface for the Kroki rendering client."""

    SUPPORTED_DIAGRAM_TYPES: list[str]

    @abstractmethod
    async def render(self, diagram_type: str, source: str) -> str:
        """
        Render a diagram and return the SVG output as a string.

        Args:
            diagram_type: Kroki-supported diagram type (e.g. "plantuml", "d2").
            source: Plain-text source code of the diagram.

        Returns:
            SVG content as a string.

        Raises:
            KrokiRenderError: If Kroki returns an HTTP error.
            KrokiTimeoutError: If Kroki is unreachable or the request times out.
        """
        pass


class KrokiClient(IKrokiClient):
    """Concrete HTTP client for the Kroki rendering service."""

    SUPPORTED_DIAGRAM_TYPES: list[str] = [
        "actdiag",
        "blockdiag",
        "bpmn",
        "bytefield",
        "c4plantuml",
        "d2",
        "dbml",
        "ditaa",
        "erd",
        "excalidraw",
        "graphviz",
        "nomnoml",
        "nwdiag",
        "packetdiag",
        "pikchr",
        "plantuml",
        "rackdiag",
        "seqdiag",
        "structurizr",
        "svgbob",
        "symbolator",
        "umlet",
        "vega",
        "vegalite",
        "wavedrom",
        "wireviz",
    ]

    def __init__(self, base_url: str, timeout: float = 30.0) -> None:
        """
        Initialize the Kroki client.

        Args:
            base_url: Base URL of the Kroki service (e.g. "http://kroki:8000").
            timeout: Request timeout in seconds. Defaults to 30.
        """
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    async def render(self, diagram_type: str, source: str) -> str:
        """
        Send diagram source to Kroki and return the rendered SVG.

        Sends ``POST {base_url}/{diagram_type}/svg`` with
        ``Content-Type: text/plain`` and the source code as body.

        Args:
            diagram_type: Kroki-supported diagram type.
            source: Plain-text source code of the diagram.

        Returns:
            SVG content as a string.

        Raises:
            KrokiRenderError: If Kroki returns a non-2xx HTTP status.
            KrokiTimeoutError: If the request times out or Kroki is unreachable.
        """
        url = f"{self.base_url}/{diagram_type}/svg"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    content=source,
                    headers={"Content-Type": "text/plain"},
                )

            if response.status_code >= 400:
                raise KrokiRenderError(
                    status_code=response.status_code,
                    detail=response.text,
                )

            return response.text

        except KrokiRenderError:
            raise
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            raise KrokiTimeoutError(
                f"Kroki service unreachable or timed out: {exc}"
            ) from exc
