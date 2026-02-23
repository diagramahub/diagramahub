"""
Payment provider abstraction layer.
"""
from .interfaces import IPaymentProvider
from .stripe_provider import StripePaymentProvider

__all__ = ["IPaymentProvider", "StripePaymentProvider"]
