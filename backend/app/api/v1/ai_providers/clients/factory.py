"""
Factory for creating AI client instances.
"""
from typing import Dict, Any
from .base import BaseAIClient
from .gemini_client import GeminiClient
from .openai_client import OpenAIClient
from ..schemas import AIProviderType


class AIClientFactory:
    """Factory for creating AI client instances."""

    # Map of provider types to client classes
    _clients_map = {
        AIProviderType.GEMINI: GeminiClient,
        AIProviderType.OPENAI: OpenAIClient,
        # Add more providers here as they're implemented
    }

    @classmethod
    def create_client(
        cls,
        provider: AIProviderType,
        api_key: str,
        model: str,
        parameters: Dict[str, Any]
    ) -> BaseAIClient:
        """
        Create instance of the appropriate AI client.

        Args:
            provider: Provider type (gemini, openai, etc.)
            api_key: API key for the provider
            model: Model name to use
            parameters: Provider-specific parameters

        Returns:
            Initialized AI client instance

        Raises:
            ValueError: If provider is not supported
            NotImplementedError: If provider is not yet implemented
        """
        client_class = cls._clients_map.get(provider)

        if not client_class:
            raise ValueError(f"Unsupported provider: {provider}")

        return client_class(api_key=api_key, model=model, parameters=parameters)

    @classmethod
    def get_supported_providers(cls) -> list[AIProviderType]:
        """
        Get list of supported providers.

        Returns:
            List of supported provider types
        """
        return list(cls._clients_map.keys())
