"""
OpenAI GPT client implementation (placeholder for future implementation).
"""
from typing import Dict, Any
from .base import BaseAIClient


class OpenAIClient(BaseAIClient):
    """Client for OpenAI GPT (to be implemented in the future)."""

    def __init__(self, api_key: str, model: str = "gpt-4", parameters: Dict[str, Any] = None):
        """
        Initialize OpenAI client.

        Args:
            api_key: OpenAI API key
            model: GPT model to use
            parameters: Generation parameters

        Raises:
            NotImplementedError: This client is not yet implemented
        """
        super().__init__(api_key, model, parameters or {})
        raise NotImplementedError("OpenAI client will be implemented in the future")

    async def generate_description(
        self,
        diagram_code: str,
        diagram_type: str,
        language: str = "es"
    ) -> str:
        """Not yet implemented."""
        raise NotImplementedError("OpenAI client will be implemented in the future")

    async def validate_api_key(self) -> bool:
        """Not yet implemented."""
        raise NotImplementedError("OpenAI client will be implemented in the future")

    @property
    def provider_name(self) -> str:
        """Provider name."""
        return "OpenAI GPT"
