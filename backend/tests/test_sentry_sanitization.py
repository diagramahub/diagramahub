"""
Unit tests for Sentry event sanitization (sanitize_sentry_event).

Tests cover:
- Masking of sensitive headers (Authorization, Cookie)
- Masking of sensitive body params (api_key, password, token, secret, jwt)
- Masking of sensitive query string params
- Passthrough of non-sensitive data
- Graceful handling of malformed events (returns None)
- Events without request data pass through unchanged

Sensitive sample values are generated dynamically (never hardcoded) — the
sanitizer's behavior depends only on the field name, not the value.
"""
import pytest

from app.main import sanitize_sentry_event, _MASK
from tests.utils import (
    generate_test_password,
    generate_test_secret,
    generate_test_token,
)


@pytest.mark.unit
class TestSanitizeSentryEvent:
    """Tests for the sanitize_sentry_event before_send callback."""

    def test_masks_authorization_header(self):
        event = {
            "request": {
                "headers": {"Authorization": f"Bearer {generate_test_token()}"}
            }
        }
        result = sanitize_sentry_event(event, {})
        assert result is not None
        assert result["request"]["headers"]["Authorization"] == _MASK

    def test_masks_cookie_header(self):
        event = {
            "request": {
                "headers": {"Cookie": f"session={generate_test_token()}; token={generate_test_token()}"}
            }
        }
        result = sanitize_sentry_event(event, {})
        assert result is not None
        assert result["request"]["headers"]["Cookie"] == _MASK

    def test_masks_headers_case_insensitive(self):
        event = {
            "request": {
                "headers": {
                    "authorization": f"Bearer {generate_test_token()}",
                    "COOKIE": "val",
                }
            }
        }
        result = sanitize_sentry_event(event, {})
        assert result is not None
        assert result["request"]["headers"]["authorization"] == _MASK
        assert result["request"]["headers"]["COOKIE"] == _MASK

    def test_preserves_non_sensitive_headers(self):
        event = {
            "request": {
                "headers": {
                    "Content-Type": "application/json",
                    "Accept": "text/html",
                }
            }
        }
        result = sanitize_sentry_event(event, {})
        assert result is not None
        assert result["request"]["headers"]["Content-Type"] == "application/json"
        assert result["request"]["headers"]["Accept"] == "text/html"

    def test_masks_sensitive_body_params(self):
        event = {
            "request": {
                "data": {
                    "api_key": generate_test_secret(),
                    "password": generate_test_password(),
                    "token": generate_test_token(),
                    "secret": generate_test_secret(),
                    "jwt": generate_test_token("jwt"),
                    "username": "john",
                }
            }
        }
        result = sanitize_sentry_event(event, {})
        assert result is not None
        data = result["request"]["data"]
        assert data["api_key"] == _MASK
        assert data["password"] == _MASK
        assert data["token"] == _MASK
        assert data["secret"] == _MASK
        assert data["jwt"] == _MASK
        assert data["username"] == "john"

    def test_masks_body_params_case_insensitive(self):
        event = {
            "request": {
                "data": {
                    "Password": generate_test_password(),
                    "API_KEY": generate_test_secret(),
                }
            }
        }
        result = sanitize_sentry_event(event, {})
        assert result is not None
        assert result["request"]["data"]["Password"] == _MASK
        assert result["request"]["data"]["API_KEY"] == _MASK

    def test_masks_sensitive_query_string_params(self):
        event = {
            "request": {
                "query_string": f"token={generate_test_token()}&page=1&api_key={generate_test_secret()}"
            }
        }
        result = sanitize_sentry_event(event, {})
        assert result is not None
        qs = result["request"]["query_string"]
        assert "token=[Filtered]" in qs
        assert "api_key=[Filtered]" in qs
        assert "page=1" in qs

    def test_event_without_request_passes_through(self):
        event = {"level": "error", "message": "Something broke"}
        result = sanitize_sentry_event(event, {})
        assert result is not None
        assert result == event

    def test_event_with_empty_request_passes_through(self):
        event = {"request": {}}
        result = sanitize_sentry_event(event, {})
        assert result is not None

    def test_returns_none_on_sanitization_failure(self):
        """If sanitization raises, the event should be discarded (return None)."""
        # Use a dict subclass for headers that raises when iterating keys
        class ExplodingDict(dict):
            def __init__(self):
                super().__init__({"Authorization": f"Bearer {generate_test_token()}"})

            def keys(self):
                raise RuntimeError("boom")

        event = {"request": {"headers": ExplodingDict()}}
        result = sanitize_sentry_event(event, {})
        assert result is None

    def test_combined_headers_and_body_sanitization(self):
        event = {
            "request": {
                "headers": {
                    "Authorization": f"Bearer {generate_test_token()}",
                    "Content-Type": "application/json",
                },
                "data": {
                    "password": generate_test_password(),
                    "email": "user@example.com",
                },
            }
        }
        result = sanitize_sentry_event(event, {})
        assert result is not None
        assert result["request"]["headers"]["Authorization"] == _MASK
        assert result["request"]["headers"]["Content-Type"] == "application/json"
        assert result["request"]["data"]["password"] == _MASK
        assert result["request"]["data"]["email"] == "user@example.com"

    def test_hint_parameter_is_accepted(self):
        """Ensure the hint parameter doesn't cause issues."""
        event = {"request": {"headers": {"Authorization": f"Bearer {generate_test_token()}"}}}
        hint = {"exc_info": (ValueError, ValueError("test"), None)}
        result = sanitize_sentry_event(event, hint)
        assert result is not None
        assert result["request"]["headers"]["Authorization"] == _MASK
