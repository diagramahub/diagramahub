"""
Stripe payment provider implementation.
"""
import logging
import os
from typing import Optional
from datetime import datetime
import stripe

from .interfaces import IPaymentProvider
from ..exceptions import PaymentProviderError

logger = logging.getLogger(__name__)


class StripePaymentProvider(IPaymentProvider):
    """Implementación de Stripe para pagos."""
    
    def __init__(
        self,
        secret_key: str,
        webhook_secret: str,
        publishable_key: Optional[str] = None
    ):
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
            secret_key=secret_key,
            webhook_secret=webhook_secret,
            publishable_key=publishable_key
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
            from app.api.v1.integrations.schemas import VendorCategory, VendorConfigInDB
            from app.api.v1.integrations.repository import IntegrationsRepository

            active_vendors = await VendorConfigInDB.find(
                VendorConfigInDB.category == VendorCategory.PAYMENT,
                VendorConfigInDB.is_active_payment == True,  # noqa: E712
            ).to_list()

            if active_vendors:
                vendor = active_vendors[0]
                repo = IntegrationsRepository()
                config = repo._decrypt_config(vendor.encrypted_config)

                secret_key = config.get("secret_key")
                webhook_secret = config.get("webhook_secret")
                publishable_key = config.get("publishable_key")

                if secret_key and webhook_secret:
                    logger.info(
                        "Stripe provider loaded from DB (vendor_id=%s)", str(vendor.id)
                    )
                    return cls(
                        secret_key=secret_key,
                        webhook_secret=webhook_secret,
                        publishable_key=publishable_key,
                    )
        except Exception as exc:
            logger.debug(
                "Could not load Stripe config from DB, falling back to .env: %s", exc
            )

        # 2. Fallback a variables de entorno
        try:
            return cls.from_env()
        except ValueError:
            return None

    async def create_checkout_session(
        self,
        user_email: str,
        plan_name: str,
        plan_price: float,
        success_url: str,
        cancel_url: str,
        metadata: dict,
        plan_description: Optional[str] = None
    ) -> dict:
        """
        Crea Stripe Checkout Session.
        
        Proceso:
        1. Buscar o crear Stripe Customer por email
        2. Crear Checkout Session con mode='subscription'
        3. Retornar session_id y session_url
        """
        try:
            # Buscar customer existente
            customers = stripe.Customer.list(email=user_email, limit=1)
            if customers.data:
                customer = customers.data[0]
            else:
                # Crear nuevo customer
                customer = stripe.Customer.create(email=user_email)
            
            # Construir product_data con descripción opcional
            product_data: dict = {'name': plan_name}
            if plan_description:
                product_data['description'] = plan_description

            # Crear sesión de checkout
            session = stripe.checkout.Session.create(
                customer=customer.id,
                line_items=[{
                    'price_data': {
                        'currency': 'usd',
                        'product_data': product_data,
                        'unit_amount': int(plan_price * 100),  # Convertir a centavos
                        'recurring': {'interval': 'month'}
                    },
                    'quantity': 1
                }],
                mode='subscription',
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata
            )
            
            return {
                "session_id": session.id,
                "session_url": session.url
            }
        
        except stripe.error.StripeError as e:
            raise PaymentProviderError("stripe", str(e))
        except Exception as e:
            raise PaymentProviderError("stripe", f"Unexpected error: {str(e)}")
    
    async def create_setup_session(
        self,
        customer_id: str,
        success_url: str,
        cancel_url: str
    ) -> dict:
        """
        Crea Stripe Checkout Session en modo setup para actualizar método de pago.
        """
        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                mode='setup',
                payment_method_types=['card'],
                success_url=success_url,
                cancel_url=cancel_url,
            )
            return {
                "session_id": session.id,
                "session_url": session.url
            }
        except stripe.error.StripeError as e:
            raise PaymentProviderError("stripe", str(e))

    async def cancel_subscription(
        self,
        subscription_id: str
    ) -> dict:
        """
        Cancela suscripción en Stripe.
        
        Configura cancel_at_period_end=True para mantener acceso
        hasta el fin del período pagado.
        """
        try:
            subscription = stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=True
            )
            
            # Convertir timestamp a datetime
            cancel_at = None
            if subscription.cancel_at:
                cancel_at = datetime.fromtimestamp(subscription.cancel_at)
            
            return {
                "status": subscription.status,
                "cancel_at": cancel_at
            }
        
        except stripe.error.StripeError as e:
            raise PaymentProviderError("stripe", str(e))
        except Exception as e:
            raise PaymentProviderError("stripe", f"Unexpected error: {str(e)}")
    
    async def validate_webhook(
        self,
        payload: bytes,
        signature: str
    ) -> dict:
        """
        Valida webhook de Stripe.
        
        Usa stripe.Webhook.construct_event para validar firma.
        """
        try:
            event = stripe.Webhook.construct_event(
                payload, signature, self.webhook_secret
            )
        except ValueError as e:
            raise ValueError(f"Invalid webhook payload: {str(e)}")
        except stripe.error.SignatureVerificationError as e:
            raise ValueError(f"Invalid webhook signature: {str(e)}")
        
        return {
            "event_type": event.type,
            "data": event.data.object
        }
    
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
        return (
            self.secret_key.startswith("sk_test_") if self.secret_key else False
        )
