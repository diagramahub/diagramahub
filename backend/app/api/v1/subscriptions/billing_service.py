"""
Billing service for payment history and invoices.
"""
from datetime import datetime
from typing import Optional
import stripe

from .interfaces import ISubscriptionRepository
from .schemas import InvoiceResponse, BillingHistoryResponse
from .exceptions import NotFoundError


class BillingService:
    """Servicio para gestión de historial de pagos."""
    
    def __init__(
        self,
        subscription_repository: ISubscriptionRepository,
        stripe_api_key: str
    ):
        self.subscription_repository = subscription_repository
        stripe.api_key = stripe_api_key
    
    async def get_billing_history(
        self,
        user_id: str,
        limit: int = 10
    ) -> BillingHistoryResponse:
        """
        Obtiene historial de pagos del usuario desde Stripe.
        
        Args:
            user_id: ID del usuario
            limit: Número máximo de facturas a retornar
        
        Returns:
            BillingHistoryResponse con lista de facturas
        """
        # Obtener suscripción activa del usuario
        subscription = await self.subscription_repository.get_active_by_user(user_id)
        if not subscription:
            raise NotFoundError("Subscription", user_id)
        
        # Si no tiene stripe_customer_id, no hay historial
        if not subscription.stripe_customer_id:
            return BillingHistoryResponse(
                invoices=[],
                total_count=0
            )
        
        # Obtener facturas de Stripe
        try:
            invoices = stripe.Invoice.list(
                customer=subscription.stripe_customer_id,
                limit=limit
            )
            
            invoice_responses = []
            for invoice in invoices.data:
                invoice_responses.append(
                    InvoiceResponse(
                        id=invoice.id,
                        amount=invoice.amount_paid / 100,  # Convertir de centavos a dólares
                        currency=invoice.currency.upper(),
                        status=invoice.status,
                        description=self._get_invoice_description(invoice),
                        invoice_pdf=invoice.invoice_pdf,
                        hosted_invoice_url=invoice.hosted_invoice_url,
                        created_at=datetime.fromtimestamp(invoice.created),
                        paid_at=datetime.fromtimestamp(invoice.status_transitions.paid_at) if invoice.status_transitions.paid_at else None
                    )
                )
            
            return BillingHistoryResponse(
                invoices=invoice_responses,
                total_count=len(invoice_responses)
            )
        
        except stripe.error.StripeError as e:
            # Si hay error con Stripe, retornar lista vacía
            return BillingHistoryResponse(
                invoices=[],
                total_count=0
            )
    
    def _get_invoice_description(self, invoice) -> str:
        """
        Genera descripción legible de la factura.
        
        Args:
            invoice: Objeto Invoice de Stripe
        
        Returns:
            Descripción de la factura
        """
        if invoice.lines and invoice.lines.data:
            line = invoice.lines.data[0]
            if line.description:
                return line.description
            if line.plan and line.plan.nickname:
                return f"Subscription: {line.plan.nickname}"
        
        return "Subscription payment"
    
    async def get_invoice_pdf_url(
        self,
        user_id: str,
        invoice_id: str
    ) -> str:
        """
        Obtiene URL del PDF de una factura específica.
        
        Args:
            user_id: ID del usuario
            invoice_id: ID de la factura en Stripe
        
        Returns:
            URL del PDF
        
        Raises:
            NotFoundError: Si la factura no existe o no pertenece al usuario
        """
        # Obtener suscripción activa del usuario
        subscription = await self.subscription_repository.get_active_by_user(user_id)
        if not subscription or not subscription.stripe_customer_id:
            raise NotFoundError("Subscription", user_id)
        
        try:
            # Obtener factura de Stripe
            invoice = stripe.Invoice.retrieve(invoice_id)
            
            # Verificar que la factura pertenece al usuario
            if invoice.customer != subscription.stripe_customer_id:
                raise NotFoundError("Invoice", invoice_id)
            
            # Retornar URL del PDF
            if invoice.invoice_pdf:
                return invoice.invoice_pdf
            else:
                raise NotFoundError("Invoice PDF", invoice_id)
        
        except stripe.error.StripeError as e:
            raise NotFoundError("Invoice", invoice_id)
