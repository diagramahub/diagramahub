"""
Factory for creating vendor instances (email and payment).
"""
from .email_vendors.interfaces import IEmailVendor
from .email_vendors.resend_adapter import ResendAdapter
from ..subscriptions.payment_providers.interfaces import IPaymentProvider
from ..subscriptions.payment_providers.stripe_provider import StripePaymentProvider


class VendorFactory:
    """Factory for creating vendor instances by type and configuration."""

    _email_vendors: dict[str, type[IEmailVendor]] = {
        "resend": ResendAdapter,
    }

    _payment_vendors: dict[str, type[IPaymentProvider]] = {
        "stripe": StripePaymentProvider,
    }

    @classmethod
    def create_email_vendor(cls, vendor_type: str, config: dict) -> IEmailVendor:
        """
        Create an email vendor instance from type and config.

        Args:
            vendor_type: Vendor identifier (e.g. "resend")
            config: Vendor-specific configuration dict.
                    For resend: {"api_key": str, "from_email": str}

        Returns:
            Initialized email vendor instance

        Raises:
            ValueError: If vendor_type is not supported
        """
        vendor_class = cls._email_vendors.get(vendor_type)
        if not vendor_class:
            supported = ", ".join(cls._email_vendors.keys())
            raise ValueError(
                f"Unsupported email vendor: '{vendor_type}'. "
                f"Supported vendors: {supported}"
            )
        return vendor_class(**config)

    @classmethod
    def create_payment_vendor(cls, vendor_type: str, config: dict) -> IPaymentProvider:
        """
        Create a payment vendor instance from type and config.

        Args:
            vendor_type: Vendor identifier (e.g. "stripe")
            config: Vendor-specific configuration dict.
                    For stripe: {"secret_key": str, "publishable_key": str, "webhook_secret": str}

        Returns:
            Initialized payment vendor instance

        Raises:
            ValueError: If vendor_type is not supported
        """
        vendor_class = cls._payment_vendors.get(vendor_type)
        if not vendor_class:
            supported = ", ".join(cls._payment_vendors.keys())
            raise ValueError(
                f"Unsupported payment vendor: '{vendor_type}'. "
                f"Supported vendors: {supported}"
            )
        return vendor_class(**config)

    @classmethod
    def get_supported_email_vendors(cls) -> list[str]:
        """Get list of supported email vendor types."""
        return list(cls._email_vendors.keys())

    @classmethod
    def get_supported_payment_vendors(cls) -> list[str]:
        """Get list of supported payment vendor types."""
        return list(cls._payment_vendors.keys())
