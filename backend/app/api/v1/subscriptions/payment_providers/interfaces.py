"""
Payment provider interface definition.
"""
from abc import ABC, abstractmethod
from typing import Optional


class IPaymentProvider(ABC):
    """Interfaz abstracta para proveedores de pago."""
    
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
    async def cancel_subscription(
        self,
        subscription_id: str
    ) -> dict:
        """
        Cancela una suscripción.
        
        Args:
            subscription_id: ID de la suscripción en el proveedor
        
        Returns:
            {"status": str, "cancel_at": datetime}
        """
        pass
    
    @abstractmethod
    async def validate_webhook(
        self,
        payload: bytes,
        signature: str
    ) -> dict:
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
