"""
Abstract interface for OAuth provider adapters.

Defines the contract that all OAuth provider implementations must follow,
enabling a provider-agnostic architecture.
"""
from abc import ABC, abstractmethod

from .schemas import ProviderUserInfo


class IOAuthProvider(ABC):
    """Abstract interface for OAuth provider adapters."""

    @abstractmethod
    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        """Build the OAuth authorization URL for user redirect.

        Args:
            state: Cryptographically random state token for CSRF protection.
            redirect_uri: The callback URL registered with the provider.

        Returns:
            Full authorization URL with query parameters.
        """
        pass

    @abstractmethod
    async def exchange_code(self, code: str, redirect_uri: str) -> dict:
        """Exchange an authorization code for access/ID tokens.

        Args:
            code: Authorization code from the provider callback.
            redirect_uri: Must match the redirect_uri used in authorization.

        Returns:
            Token response dict containing access_token, id_token, etc.

        Raises:
            OAuthTokenExchangeError: If the exchange fails.
        """
        pass

    @abstractmethod
    async def get_user_info(self, token_response: dict) -> ProviderUserInfo:
        """Retrieve user profile information from the provider.

        For OpenID Connect providers, this may decode the id_token.
        For others, it calls the userinfo endpoint.

        Args:
            token_response: The token dict from exchange_code.

        Returns:
            Normalized ProviderUserInfo with email, name, picture.

        Raises:
            OAuthUserInfoError: If retrieval fails or email is unverified.
        """
        pass

    @abstractmethod
    async def test_connection(self) -> bool:
        """Validate that credentials can reach the provider's discovery endpoint.

        Returns:
            True if the provider responds successfully.
        """
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the provider identifier (e.g., 'google')."""
        pass
