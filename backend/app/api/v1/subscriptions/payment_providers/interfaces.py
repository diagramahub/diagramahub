"""
Payment provider interface definition.
"""

from abc import ABC, abstractmethod
from typing import Any, Optional

from ..schemas import PlanInDB


class IPaymentProvider(ABC):
    """Interfaz abstracta para proveedores de pago."""

    # Contrato: llave secreta del gateway (sk_test_... o sk_live_...).
    secret_key: str

    @abstractmethod
    async def create_checkout_session(
        self,
        user_email: str,
        stripe_price_id: str,
        success_url: str,
        cancel_url: str,
        metadata: dict,
    ) -> dict:
        """
        Crea sesión de checkout para suscripción.

        Args:
            user_email: Email del usuario
            stripe_price_id: ID del Price pre-registrado en el gateway
            success_url: URL de retorno exitoso
            cancel_url: URL de cancelación
            metadata: Metadata adicional (user_id, plan_id, etc.)

        Returns:
            {"session_id": str, "session_url": str}
        """
        pass

    @abstractmethod
    async def create_setup_session(
        self,
        customer_id: str,
        success_url: str,
        cancel_url: str,
    ) -> dict:
        """
        Crea sesión de checkout en modo setup para actualizar método de pago.

        Args:
            customer_id: ID del customer en el proveedor
            success_url: URL de retorno exitoso
            cancel_url: URL de cancelación

        Returns:
            {"session_id": str, "session_url": str}
        """
        pass

    @abstractmethod
    async def cancel_subscription(
        self,
        subscription_id: str,
        immediate: bool = False,
    ) -> dict:
        """
        Cancela una suscripción.

        Args:
            subscription_id: ID de la suscripción en el proveedor
            immediate: Si es True, cancela inmediatamente; si es False,
                mantiene acceso hasta el fin del período pagado

        Returns:
            {"status": str, "cancel_at": datetime}
        """
        pass

    @abstractmethod
    async def retrieve_subscription(self, subscription_id: str) -> Optional[Any]:
        """Obtiene una suscripción del proveedor por su ID."""
        pass

    @abstractmethod
    async def retrieve_setup_intent(self, setup_intent_id: str) -> Optional[Any]:
        """Obtiene un setup intent del proveedor por su ID."""
        pass

    @abstractmethod
    async def set_default_payment_method(self, customer_id: str, payment_method_id: str) -> None:
        """Establece el método de pago por defecto de un customer."""
        pass

    @abstractmethod
    async def get_active_subscriptions(self, customer_id: str) -> list[Any]:
        """Obtiene suscripciones activas de un customer."""
        pass

    @abstractmethod
    async def update_subscription(self, subscription_id: str, **kwargs: Any) -> Optional[Any]:
        """Actualiza una suscripción en el proveedor."""
        pass

    @abstractmethod
    async def get_billing_history(self, customer_id: str, limit: int = 10) -> list[Any]:
        """Obtiene facturas (historial de pagos) de un customer."""
        pass

    @abstractmethod
    async def get_invoice_pdf(self, invoice_id: str) -> dict:
        """
        Obtiene datos de una factura del proveedor.

        Returns:
            {"customer": str, "invoice_pdf": Optional[str]}
        """
        pass

    @abstractmethod
    async def sync_plan(self, plan: PlanInDB, prices: dict) -> tuple[str, str]:
        """Sincroniza un plan con el catálogo del proveedor."""
        pass

    @abstractmethod
    async def archive_plan(self, plan: PlanInDB) -> None:
        """Archiva un plan en el catálogo del proveedor."""
        pass

    @abstractmethod
    async def reactivate_plan(self, plan: PlanInDB) -> None:
        """Reactive un plan en el catálogo del proveedor."""
        pass

    @abstractmethod
    async def update_price_currency_options(self, plan: PlanInDB, prices: dict) -> str:
        """Actualiza currency_options de un plan creando un Price nuevo."""
        pass

    @abstractmethod
    async def validate_webhook(self, payload: bytes, signature: str) -> dict:
        """
        Valida y parsea webhook.

        Args:
            payload: Payload del webhook
            signature: Firma del webhook

        Returns:
            {"event_type": str, "data": dict}

        Raises:
            ValueError: Si la firma es inválida
        """
        pass

    @abstractmethod
    async def validate_configuration(self) -> bool:
        """
        Valida que las credenciales sean correctas.

        Returns:
            True si las credenciales son válidas
        """
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Retorna nombre del proveedor (e.g., 'stripe')."""
        pass

    @abstractmethod
    def is_test_mode(self) -> bool:
        """
        Detecta si el proveedor está en modo test.

        Returns:
            True si está en modo test
        """
        pass
