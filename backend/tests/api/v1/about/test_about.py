"""About page: the repository's GitHub stars, asked by the server and cached."""

from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.api.v1.about import services
from app.api.v1.about.interfaces import IRepositoryStatsClient
from app.api.v1.about.routes import get_about_service
from app.api.v1.about.services import AboutService
from app.core.config import settings
from app.main import app


class FakeClient(IRepositoryStatsClient):
    def __init__(self, data: dict | None = None, error: Exception | None = None) -> None:
        self.data, self.error, self.calls = data or {}, error, 0

    async def fetch(self, repository: str) -> dict:
        self.calls += 1
        if self.error:
            raise self.error
        return self.data


@pytest.fixture(autouse=True)
def _fresh_cache():
    AboutService._cache.clear()
    yield
    AboutService._cache.clear()


@pytest.mark.unit
async def test_stars_are_cached_for_an_hour() -> None:
    client = FakeClient({"stargazers_count": 1234, "forks_count": 56})

    first = await AboutService(client).repository_stats()
    again = await AboutService(client).repository_stats()

    assert first.available and first.stars == 1234 and first.forks == 56
    assert first.url == f"https://github.com/{settings.GITHUB_REPOSITORY}"
    assert again == first and client.calls == 1


@pytest.mark.unit
async def test_github_down_hides_the_numbers_and_retries_sooner() -> None:
    client = FakeClient(error=RuntimeError("no network"))

    with patch.object(services.time, "monotonic", return_value=1000.0):
        stats = await AboutService(client).repository_stats()
    with patch.object(services.time, "monotonic", return_value=1000.0 + 301):
        await AboutService(client).repository_stats()

    assert stats.available is False and stats.stars is None
    assert client.calls == 2


@pytest.mark.unit
async def test_turned_off_means_no_outbound_call(monkeypatch) -> None:
    monkeypatch.setattr(settings, "GITHUB_STATS_ENABLED", False)
    client = FakeClient({"stargazers_count": 1})

    stats = await AboutService(client).repository_stats()

    assert stats.available is False and client.calls == 0


@pytest.mark.integration
async def test_route_is_public(client: AsyncClient) -> None:
    app.dependency_overrides[get_about_service] = lambda: AboutService(
        FakeClient({"stargazers_count": 7, "forks_count": 2})
    )
    try:
        response = await client.get("/api/v1/about/repository")
    finally:
        app.dependency_overrides.pop(get_about_service, None)

    assert response.status_code == 200
    assert response.json()["stars"] == 7
