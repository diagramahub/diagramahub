"""Tests for settings parsing (CORS origins)."""

import pytest

from app.core.config import Settings


def _settings(cors: str) -> Settings:
    """Settings with a fixed FRONTEND_URL and the given BACKEND_CORS_ORIGINS."""
    return Settings(
        JWT_SECRET="x" * 32,
        FRONTEND_URL="http://front.test",
        BACKEND_CORS_ORIGINS=cors,
    )


@pytest.mark.unit
@pytest.mark.parametrize("cors", ["", "   ", "[]", ",", '[""]'])
def test_cors_origins_fall_back_to_frontend_url(cors: str) -> None:
    assert _settings(cors).cors_origins == ["http://front.test"]


@pytest.mark.unit
def test_cors_origins_comma_separated() -> None:
    assert _settings("https://a.com, https://b.com ,").cors_origins == [
        "https://a.com",
        "https://b.com",
    ]


@pytest.mark.unit
@pytest.mark.parametrize(
    "cors",
    [
        '["http://localhost:5173","http://localhost:3000"]',
        '["http://localhost:5173", "http://localhost:3000"]',
        "['http://localhost:5173', 'http://localhost:3000']",
    ],
)
def test_cors_origins_accept_json_style_list(cors: str) -> None:
    """The format older .env templates shipped must not leak brackets or quotes."""
    assert _settings(cors).cors_origins == [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
