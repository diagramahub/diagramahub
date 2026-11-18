"""GitHub REST API client for public repository numbers (unauthenticated)."""

import httpx

from .interfaces import IRepositoryStatsClient

GITHUB_API = "https://api.github.com"


class GitHubRepositoryClient(IRepositoryStatsClient):
    """``GET /repos/{owner}/{repo}``; no token, so a short timeout and a cache upstream."""

    def __init__(self, timeout: float = 5.0) -> None:
        self.timeout = timeout

    async def fetch(self, repository: str) -> dict:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{GITHUB_API}/repos/{repository}",
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "DiagramaHub",
                },
            )
            response.raise_for_status()
            return response.json()
