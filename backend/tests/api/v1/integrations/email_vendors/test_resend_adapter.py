"""
Unit tests for the ResendAdapter.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.api.v1.integrations.email_vendors.interfaces import IEmailVendor
from app.api.v1.integrations.email_vendors.resend_adapter import ResendAdapter


class TestResendAdapter:
    """Test suite for ResendAdapter."""

    def test_implements_interface(self):
        """ResendAdapter must implement IEmailVendor."""
        adapter = ResendAdapter(api_key="test-resend-api-key", from_email="noreply@example.com")
        assert isinstance(adapter, IEmailVendor)

    def test_get_vendor_name(self):
        """get_vendor_name should return 'resend'."""
        adapter = ResendAdapter(api_key="test-resend-api-key", from_email="noreply@example.com")
        assert adapter.get_vendor_name() == "resend"

    def test_constructor_stores_config(self):
        """Constructor should store api_key and from_email."""
        adapter = ResendAdapter(api_key="test-resend-config-key", from_email="sender@test.com")
        assert adapter.api_key == "test-resend-config-key"
        assert adapter.from_email == "sender@test.com"

    @pytest.mark.asyncio
    @patch("app.api.v1.integrations.email_vendors.resend_adapter.resend")
    async def test_send_email_success(self, mock_resend):
        """send_email should call resend.Emails.send_async with correct params."""
        mock_resend.Emails.send_async = AsyncMock(return_value={"id": "email_123"})
        adapter = ResendAdapter(api_key="test-resend-api-key", from_email="noreply@example.com")

        result = await adapter.send_email(
            to="user@example.com",
            subject="Test Subject",
            html_content="<p>Hello</p>",
        )

        mock_resend.Emails.send_async.assert_called_once_with(
            {
                "from": "noreply@example.com",
                "to": ["user@example.com"],
                "subject": "Test Subject",
                "html": "<p>Hello</p>",
            }
        )
        assert result == {"id": "email_123", "status": "sent"}

    @pytest.mark.asyncio
    @patch("app.api.v1.integrations.email_vendors.resend_adapter.resend")
    async def test_send_email_with_custom_from(self, mock_resend):
        """send_email should use custom from_email when provided."""
        mock_resend.Emails.send_async = AsyncMock(return_value={"id": "email_456"})
        adapter = ResendAdapter(api_key="test-resend-api-key", from_email="default@example.com")

        await adapter.send_email(
            to="user@example.com",
            subject="Test",
            html_content="<p>Hi</p>",
            from_email="custom@example.com",
        )

        call_args = mock_resend.Emails.send_async.call_args[0][0]
        assert call_args["from"] == "custom@example.com"

    @pytest.mark.asyncio
    @patch("app.api.v1.integrations.email_vendors.resend_adapter.resend")
    async def test_test_connection_success(self, mock_resend):
        """test_connection should return True when API key is valid."""
        mock_resend.Emails.send_async = AsyncMock(return_value={"id": "test_email_123"})
        adapter = ResendAdapter(api_key="test-resend-valid-key", from_email="noreply@example.com")

        result = await adapter.test_connection()
        assert result is True

    @pytest.mark.asyncio
    @patch("app.api.v1.integrations.email_vendors.resend_adapter.resend")
    async def test_test_connection_failure(self, mock_resend):
        """test_connection should return False when API key is invalid."""
        mock_resend.Emails.send_async = AsyncMock(side_effect=Exception("API connection failed"))
        adapter = ResendAdapter(api_key="test-resend-invalid-key", from_email="noreply@example.com")

        result = await adapter.test_connection()
        assert result is False
