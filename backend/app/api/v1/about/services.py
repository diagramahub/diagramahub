"""
Repository facts for the About page, cached so GitHub is asked at most once an hour.

The server asks (not the browser), so the CSP stays closed to third parties and an
instance without internet access just hides the numbers.
"""

import logging
import time
from typing import Optional

from app.core.config import settings

from .interfaces import IRepositoryStatsClient
from .schemas import RepositoryStats

logger = logging.getLogger(__name__)

# Stats change slowly; a failure is retried sooner.
CACHE_SECONDS = 3600
FAILURE_CACHE_SECONDS = 300


class AboutService:
    """GitHub stars and forks of the project's repository."""

    # Shared by every request of this process: {repository: (expires_at, stats)}
    _cache: dict[str, tuple[float, RepositoryStats]] = {}

    def __init__(self, client: IRepositoryStatsClient) -> None:
        self.client = client

    async def repository_stats(self) -> RepositoryStats:
        repository = settings.GITHUB_REPOSITORY
        url = f"https://github.com/{repository}"
        if not settings.GITHUB_STATS_ENABLED:
            return RepositoryStats(available=False, repository=repository, url=url)

        cached = self._cache.get(repository)
        now = time.monotonic()
        if cached and cached[0] > now:
            return cached[1]

        stats, ttl = await self._fetch(repository, url)
        self._cache[repository] = (now + ttl, stats)
        return stats

    async def _fetch(self, repository: str, url: str) -> tuple[RepositoryStats, int]:
        try:
            data = await self.client.fetch(repository)
            stars: Optional[int] = data.get("stargazers_count")
            forks: Optional[int] = data.get("forks_count")
            if not isinstance(stars, int):
                raise ValueError("no stargazers_count in the answer")
            stats = RepositoryStats(
                available=True, repository=repository, url=url, stars=stars, forks=forks
            )
            return stats, CACHE_SECONDS
        except Exception as exc:  # noqa: BLE001 - the page just hides the numbers
            logger.info("GitHub stats for %s unavailable: %s", repository, exc)
            return RepositoryStats(available=False, repository=repository, url=url), (
                FAILURE_CACHE_SECONDS
            )
