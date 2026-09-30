"""
Stripe payment provider implementation.
"""

import logging
import os
from typing import Any, Optional
from datetime import datetime
import stripe

from .interfaces import IPaymentProvider
from ..exceptions import PaymentProviderError
from ..schemas import PlanInDB
from ..stripe_catalog_service import (
    archive_plan_in_stripe,
    reactivate_plan_in_stripe,
    sync_plan_to_stripe,
    update_price_currency_options as update_price_currency_options_in_stripe,
)

logger = logging.getLogger(__name__)


class StripePaymentProvider(IPaymentProvider):
    """Implementación de Stripe para pagos."""

    def __init__(self, secret_key: str, webhook_secret: str, publishable_key: Optional[str] = None):
        """
        Inicializa el proveedor de Stripe.

        Args:
            secret_key: Stripe secret key (sk_test_... o sk_live_...)
            webhook_secret: Stripe webhook secret (whsec_...)
            publishable_key: Stripe publishable key (opcional)
        """
        self.secret_key = secret_key
        self.webhook_secret = webhook_secret
        self.publishable_key = publishable_key
        stripe.api_key = secret_key

    @classmethod
    def from_env(cls) -> "StripePaymentProvider":
        """
        Crea instancia desde variables de entorno.

        Returns:
            StripePaymentProvider configurado

        Raises:
            ValueError: Si faltan variables de entorno
        """
        secret_key = os.getenv("STRIPE_SECRET_KEY")
        webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
        publishable_key = os.getenv("STRIPE_PUBLISHABLE_KEY")

        if not secret_key or not webhook_secret:
            raise ValueError(
                "Missing required environment variables: "
                "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET"
            )

        return cls(
            secret_key=secret_key, webhook_secret=webhook_secret, publishable_key=publishable_key
        )

    @classmethod
    async def from_db_or_env(cls) -> Optional["StripePaymentProvider"]:
        """
        Crea instancia intentando primero obtener credenciales desde la BD
        (VendorConfigInDB con category=payment, is_active_payment=True),
        y si no hay vendor activo en BD, hace fallback a variables de entorno.

        Returns:
            StripePaymentProvider configurado, o None si no hay credenciales
        """
        # 1. Intentar obtener desde BD
        try:
            from app.api.v1.integrations.repository import IntegrationsRepository

            result = await IntegrationsRepository().get_active_payment_config()

            if result:
                vendor, config = result

                secret_key = config.get("secret_key")
                webhook_secret = config.get("webhook_secret")
                publishable_key = config.get("publishable_key")

                if secret_key and webhook_secret:
                    logger.info("Stripe provider loaded from DB (vendor_id=%s)", str(vendor.id))
                    return cls(
                        secret_key=secret_key,
                        webhook_secret=webhook_secret,
                        publishable_key=publishable_key,
                    )
        except Exception as exc:
            logger.debug("Could not load Stripe config from DB, falling back to .env: %s", exc)

        # 2. Fallback a variables de entorno
        try:
            return cls.from_env()
        except ValueError:
            return None

    async def create_checkout_session(
        self,
        user_email: str,
        stripe_price_id: str,
        success_url: str,
        cancel_url: str,
        metadata: dict,
    ) -> dict:
        """
        Crea Stripe Checkout Session para suscripción.

        Requiere un stripe_price_id pre-registrado (con currency_options
        para multi-moneda). Usa customer_email para que Stripe detecte
        automáticamente la moneda del cliente por IP.

        Args:
            user_email: Email del usuario.
            stripe_price_id: ID del Price registrado en Stripe.
            success_url: URL de retorno exitoso.
            cancel_url: URL de cancelación.
            metadata: Metadata adicional (user_id, plan_id, etc.)

        Returns:
            {"session_id": str, "session_url": str}
        """
        try:
            session = stripe.checkout.Session.create(
                customer_email=user_email,
                line_items=[{"price": stripe_price_id, "quantity": 1}],
                mode="subscription",
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata,
                locale="auto",
                payment_method_collection="always",
            )

            return {
                "session_id": session.id,
                "session_url": session.url,
            }

        except stripe.error.StripeError as e:
            raise PaymentProviderError("stripe", str(e))
        except Exception as e:
            raise PaymentProviderError("stripe", f"Unexpected error: {str(e)}")

    async def create_setup_session(
        self, customer_id: str, success_url: str, cancel_url: str
    ) -> dict:
        """
        Crea Stripe Checkout Session en modo setup para actualizar método de pago.
        """
        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                mode="setup",
                payment_method_types=["card"],
                success_url=success_url,
                cancel_url=cancel_url,
            )
            return {"session_id": session.id, "session_url": session.url}
        except stripe.error.StripeError as e:
            raise PaymentProviderError("stripe", str(e))

    async def cancel_subscription(self, subscription_id: str, immediate: bool = False) -> dict:
        """
        Cancela suscripción en Stripe.

        immediate=True: elimina la suscripción (stripe.Subscription.delete).
        immediate=False: configura cancel_at_period_end=True para mantener
        acceso hasta el fin del período pagado.
        """
        try:
            if immediate:
                stripe.Subscription.delete(subscription_id)
                return {"status": "cancelled", "cancel_at": None}

            subscription = stripe.Subscription.modify(subscription_id, cancel_at_period_end=True)

            # Convertir timestamp a datetime
            cancel_at = None
            if subscription.cancel_at:
                cancel_at = datetime.fromtimestamp(subscription.cancel_at)

            return {"status": subscription.status, "cancel_at": cancel_at}

        except stripe.error.StripeError as e:
            raise PaymentProviderError("stripe", str(e))
        except Exception as e:
            raise PaymentProviderError("stripe", f"Unexpected error: {str(e)}")

    async def retrieve_subscription(self, subscription_id: str) -> Optional[Any]:
        """Obtiene una suscripción de Stripe por su ID."""
        try:
            return stripe.Subscription.retrieve(subscription_id)
        except stripe.error.StripeError as e:
            raise PaymentProviderError("stripe", str(e))

    async def retrieve_setup_intent(self, setup_intent_id: str) -> Optional[Any]:
        """Obtiene un setup intent de Stripe por su ID."""
        try:
            return stripe.SetupIntent.retrieve(setup_intent_id)
        except stripe.error.StripeError as e:
            raise PaymentProviderError("stripe", str(e))

    async def set_default_payment_method(self, customer_id: str, payment_method_id: str) -> None:
        """Establece el método de pago por defecto de un customer en Stripe."""
        try:
            stripe.Customer.modify(
                customer_id, invoice_settings={"default_payment_method": payment_method_id}
            )
        except stripe.error.StripeError as e:
            raise PaymentProviderError("stripe", str(e))

    async def get_active_subscriptions(self, customer_id: str) -> list[Any]:
        """Obtiene suscripciones activas de un customer en Stripe."""
        try:
            return stripe.Subscription.list(customer=customer_id, status="active", limit=1).data
        except stripe.error.StripeError as e:
            raise PaymentProviderError("stripe", str(e))

    async def update_subscription(self, subscription_id: str, **kwargs: Any) -> Optional[Any]:
        """Actualiza una suscripción en Stripe."""
        try:
            return stripe.Subscription.modify(subscription_id, **kwargs)
        except stripe.error.StripeError as e:
            raise PaymentProviderError("stripe", str(e))

    async def get_billing_history(self, customer_id: str, limit: int = 10) -> list[Any]:
        """
        Obtiene facturas de un customer en Stripe.

        Retorna lista vacía si Stripe falla (comportamiento tolerante).
        """
        try:
            invoices = stripe.Invoice.list(customer=customer_id, limit=limit)
            return list(invoices.data)
        except stripe.error.StripeError:
            logger.warning("No se pudieron obtener facturas para customer %s", customer_id)
            return []

    async def get_invoice_pdf(self, invoice_id: str) -> dict:
        """
        Obtiene datos de una factura de Stripe.

        Returns:
            {"customer": str, "invoice_pdf": Optional[str]}
        """
        try:
            invoice = stripe.Invoice.retrieve(invoice_id)
        except stripe.error.StripeError as e:
            raise PaymentProviderError("stripe", str(e))
        return {
            "customer": invoice.customer,
            "invoice_pdf": invoice.invoice_pdf,
        }

    async def sync_plan(self, plan: PlanInDB, prices: dict) -> tuple[str, str]:
        """Sincroniza un plan con el catálogo de Stripe (Product/Price)."""
        return await sync_plan_to_stripe(plan, prices, self.secret_key)

    async def archive_plan(self, plan: PlanInDB) -> None:
        """Archiva un plan en Stripe (Price y Product inactivos)."""
        await archive_plan_in_stripe(plan, self.secret_key)

    async def reactivate_plan(self, plan: PlanInDB) -> None:
        """Reactive un plan en Stripe."""
        await reactivate_plan_in_stripe(plan, self.secret_key)

    async def update_price_currency_options(self, plan: PlanInDB, prices: dict) -> str:
        """Actualiza currency_options creando un Price nuevo en Stripe."""
        return await update_price_currency_options_in_stripe(plan, prices, self.secret_key)

    async def validate_webhook(self, payload: bytes, signature: str) -> dict:
        """
        Valida webhook de Stripe.

        Usa stripe.Webhook.construct_event para validar firma.
        """
        try:
            event = stripe.Webhook.construct_event(payload, signature, self.webhook_secret)
        except ValueError as e:
            raise ValueError(f"Invalid webhook payload: {str(e)}")
        except stripe.error.SignatureVerificationError as e:
            raise ValueError(f"Invalid webhook signature: {str(e)}")

        return {"event_type": event.type, "data": event.data.object}

    async def validate_configuration(self) -> bool:
        """
        Valida credenciales de Stripe.

        Intenta listar customers (limit=1) para verificar que
        las credenciales sean válidas.
        """
        try:
            stripe.Customer.list(limit=1)
            return True
        except stripe.error.AuthenticationError:
            return False
        except Exception:
            return False

    def get_provider_name(self) -> str:
        """Retorna 'stripe'."""
        return "stripe"

    def is_test_mode(self) -> bool:
        """
        Detecta si está en modo test.

        Las claves de test comienzan con 'sk_test_' o 'pk_test_'.
        """
        return self.secret_key.startswith("sk_test_") if self.secret_key else False
