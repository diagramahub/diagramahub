"""
Unit tests for Sentry event sanitization (sanitize_sentry_event).

Tests cover:
- Masking of sensitive headers (Authorization, Cookie)
- Masking of sensitive body params (api_key, password, token, secret, jwt)
- Masking of sensitive query string params
- Passthrough of non-sensitive data
- Graceful handling of malformed events (returns None)
- Events without request data pass through unchanged
"""
import pytest

from app.main import sanitize_sentry_event, _MASK


@pytest.mark.unit
class TestSanitizeSentryEvent:
    """Tests for the sanitize_sentry_event before_send callback."""

    def test_masks_authorization_header(self):
        event = {
            "request": {
                "headers": {"Authorization": "Bearer secret-token-123"}
            }
        }
        result = sanitize_sentry_event(event, {})
        assert result is not None
        assert result["request"]["headers"]["Authorization"] == _MASK

    def test_masks_cookie_header(self):
        event = {
            "request": {
                "headers": {"Cookie": "session=abc123; token=xyz"}
            }
        }
        result = sanitize_sentry_event(event, {})
        assert result is not None
        assert result["request"]["headers"]["Cookie"] == _MASK

    def test_masks_headers_case_insensitive(self):
        event = {
            "request": {
                "headers": {
                    "authorization": "Bearer key",
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
                    "api_key": "sk-12345",
                    "password": "hunter2",
                    "token": "jwt-token",
                    "secret": "my-secret",
                    "jwt": "eyJhbGciOi...",
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
                    "Password": "hunter2",
                    "API_KEY": "sk-12345",
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
                "query_string": "token=abc123&page=1&api_key=sk-xyz"
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
                super().__init__({"Authorization": "Bearer x"})

            def keys(self):
                raise RuntimeError("boom")

        event = {"request": {"headers": ExplodingDict()}}
        result = sanitize_sentry_event(event, {})
        assert result is None

    def test_combined_headers_and_body_sanitization(self):
        event = {
            "request": {
                "headers": {
                    "Authorization": "Bearer xyz",
                    "Content-Type": "application/json",
                },
                "data": {
                    "password": "secret123",
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
        event = {"request": {"headers": {"Authorization": "Bearer x"}}}
        hint = {"exc_info": (ValueError, ValueError("test"), None)}
        result = sanitize_sentry_event(event, hint)
        assert result is not None
        assert result["request"]["headers"]["Authorization"] == _MASK
