"""
Abstract interfaces for the About module.
Follows the Dependency Inversion Principle (SOLID).
"""

from abc import ABC, abstractmethod


class IRepositoryStatsClient(ABC):
    """Reads a public repository's numbers from its hosting service."""

    @abstractmethod
    async def fetch(self, repository: str) -> dict:
        """Raw repository data (``stargazers_count``, ``forks_count``…).

        Raises:
            Exception: when the service can't be reached or answers an error
        """
        pass
