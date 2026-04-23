"""
Factory for creating OAuth provider instances from vendor configuration.
"""
from ..interfaces import IOAuthProvider


class OAuthProviderFactory:
    """Factory for creating OAuth provider instances from vendor config."""

    _providers: dict[str, type[IOAuthProvider]] = {}

    @classmethod
    def _ensure_defaults(cls) -> None:
        """Register built-in providers on first use."""
        if not cls._providers:
            from .google import GoogleOAuthProvider

            cls._providers["google"] = GoogleOAuthProvider

    @classmethod
    def create(cls, vendor_type: str, config: dict) -> IOAuthProvider:
        """Create a provider instance from vendor_type and decrypted config.

        Args:
            vendor_type: Provider identifier (e.g., "google").
            config: Decrypted vendor configuration dict.

        Returns:
            Initialized IOAuthProvider instance.

        Raises:
            ValueError: If vendor_type is not registered.
        """
        cls._ensure_defaults()
        provider_class = cls._providers.get(vendor_type)
        if not provider_class:
            supported = ", ".join(cls._providers.keys())
            raise ValueError(
                f"Unsupported OAuth provider: '{vendor_type}'. "
                f"Supported: {supported}"
            )
        return provider_class(**config)

    @classmethod
    def register(
        cls, vendor_type: str, provider_class: type[IOAuthProvider]
    ) -> None:
        """Register a new provider adapter. Used for extensibility."""
        cls._providers[vendor_type] = provider_class

    @classmethod
    def get_supported_providers(cls) -> list[str]:
        """Return list of registered provider type identifiers."""
        cls._ensure_defaults()
        return list(cls._providers.keys())
