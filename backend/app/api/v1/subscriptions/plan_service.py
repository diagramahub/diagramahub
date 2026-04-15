"""
Plan service with business logic.
"""
from datetime import datetime
from typing import Optional

from .interfaces import IPlanRepository
from .payment_providers.interfaces import IPaymentProvider
from .schemas import PlanCreate, PlanUpdate, PlanResponse, PlanInDB
from .stripe_catalog_service import sync_plan_to_stripe, archive_plan_in_stripe, reactivate_plan_in_stripe, create_currency_price, deactivate_currency_price
from .exceptions import (
    ValidationError,
    FreePlanProtectionError,
    DuplicatePlanNameError,
    NotFoundError
)
from .constants import FREE_PLAN_CODE
from .logger import SubscriptionLogger


class PlanService:
    """Servicio para gestión de planes de suscripción."""

    def __init__(self, repository: IPlanRepository, payment_provider: Optional[IPaymentProvider] = None):
        self.repository = repository
        self.payment_provider = payment_provider

    async def create_plan(
        self,
        plan_data: PlanCreate,
        admin_user_id: str
    ) -> PlanResponse:
        """
        Crea un nuevo plan de suscripción.

        Validaciones:
        - Nombre único
        - Código único (mayúsculas, sin espacios)
        - Solo puede existir un plan con código FREE
        """
        # Verificar nombre único
        existing = await self.repository.get_by_name(plan_data.name)
        if existing:
            raise DuplicatePlanNameError(plan_data.name)

        # Verificar código único
        existing_code = await self.repository.get_by_code(plan_data.code)
        if existing_code:
            raise ValidationError(f"Ya existe un plan con el código '{plan_data.code}'")

        # Validar que planes de pago requieren Stripe configurado
        if plan_data.price_usd > 0 and self.payment_provider is None:
            raise ValidationError(
                "Se requiere una vinculación activa con Stripe para crear planes de pago"
            )

        # Crear plan
        plan = await self.repository.create(plan_data)

        # Sincronizar con Stripe si es plan de pago
        if plan_data.price_usd > 0 and self.payment_provider:
            stripe_product_id, stripe_prices = await sync_plan_to_stripe(
                plan, plan_data.price_usd, self.payment_provider.secret_key
            )
            await plan.set({
                "stripe_product_id": stripe_product_id,
                "stripe_prices": [entry.model_dump() for entry in stripe_prices],
                "updated_at": datetime.utcnow()
            })
            # Re-fetch to get updated data
            plan = await self.repository.get_by_id(str(plan.id))

        # Log creation
        SubscriptionLogger.plan_created(
            plan_id=str(plan.id),
            plan_name=plan.name,
            price=plan.price_usd,
            created_by=admin_user_id
        )

        active_subs = await self.repository.count_active_subscriptions(str(plan.id))
        return self._to_response(plan, active_subs)

    async def update_plan(
        self,
        plan_id: str,
        plan_data: PlanUpdate,
        admin_user_id: str
    ) -> PlanResponse:
        """
        Actualiza un plan existente.

        Validaciones:
        - Si se cambia el nombre, debe ser único
        - Si se cambia el código, debe ser único
        - No se puede cambiar el código del plan FREE
        - No se puede asignar el código FREE a otro plan
        - El precio solo se puede cambiar si no tiene suscriptores activos
        """
        plan = await self.repository.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Plan", plan_id)

        active_subs = await self.repository.count_active_subscriptions(plan_id)

        # Precio solo editable sin suscriptores
        current_price = plan.price_usd  # computed from stripe_prices
        if plan_data.price_usd is not None and plan_data.price_usd != current_price:
            if active_subs > 0:
                raise ValidationError(
                    "No se puede cambiar el precio de un plan con suscriptores activos"
                )

        # Proteger código del plan FREE
        if plan.is_free:
            if plan_data.code is not None and plan_data.code != FREE_PLAN_CODE:
                raise ValidationError("No se puede cambiar el código del plan gratuito")

        # No permitir que otro plan use el código FREE
        if plan_data.code == FREE_PLAN_CODE and not plan.is_free:
            raise ValidationError("El código 'FREE' está reservado para el plan gratuito")

        # Nombre único
        if plan_data.name and plan_data.name != plan.name:
            existing = await self.repository.get_by_name(plan_data.name)
            if existing:
                raise DuplicatePlanNameError(plan_data.name)

        # Código único
        if plan_data.code and plan_data.code != plan.code:
            existing_code = await self.repository.get_by_code(plan_data.code)
            if existing_code:
                raise ValidationError(f"Ya existe un plan con el código '{plan_data.code}'")

        updated_plan = await self.repository.update(plan_id, plan_data)
        if not updated_plan:
            raise NotFoundError("Plan", plan_id)

        # Sincronizar con Stripe si es plan de pago y cambió algo relevante
        current_price = plan.price_usd  # computed from stripe_prices
        new_price = plan_data.price_usd
        is_paid = current_price > 0 or (new_price is not None and new_price > 0)

        if self.payment_provider and is_paid:
            name_changed = plan_data.name is not None and plan_data.name != plan.name
            desc_changed = plan_data.description is not None and plan_data.description != plan.description
            price_usd_changed = new_price is not None and new_price != current_price

            if name_changed or desc_changed or price_usd_changed:
                effective_price_usd = new_price if new_price is not None else current_price

                stripe_product_id, stripe_prices = await sync_plan_to_stripe(
                    updated_plan, effective_price_usd, self.payment_provider.secret_key
                )
                await updated_plan.set({
                    "stripe_product_id": stripe_product_id,
                    "stripe_prices": [entry.model_dump() for entry in stripe_prices],
                    "updated_at": datetime.utcnow()
                })
                # Re-fetch to get updated data
                updated_plan = await self.repository.get_by_id(plan_id)

        # Reactivar en Stripe si el plan pasó de inactivo a activo
        if self.payment_provider and plan_data.is_active is True and not plan.is_active:
            if updated_plan.stripe_product_id:
                try:
                    await reactivate_plan_in_stripe(updated_plan, self.payment_provider.secret_key)
                except Exception as exc:
                    import logging
                    logging.getLogger(__name__).error(
                        "Failed to reactivate plan %s in Stripe: %s", plan_id, exc
                    )

        changes = plan_data.model_dump(exclude_unset=True)
        SubscriptionLogger.plan_updated(
            plan_id=plan_id,
            plan_name=updated_plan.name,
            updated_by=admin_user_id,
            changes=changes
        )

        active_subs = await self.repository.count_active_subscriptions(plan_id)
        return self._to_response(updated_plan, active_subs)

    async def deactivate_plan(
        self,
        plan_id: str,
        admin_user_id: str
    ) -> dict:
        """Desactiva un plan (soft delete) y archiva en Stripe. No aplica al plan FREE."""
        plan = await self.repository.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Plan", plan_id)

        if plan.is_free:
            raise FreePlanProtectionError()

        deactivated_plan = await self.repository.deactivate(plan_id)
        if not deactivated_plan:
            raise NotFoundError("Plan", plan_id)

        # Archivar en Stripe (Product inactive + Prices inactive)
        if self.payment_provider and plan.stripe_product_id:
            try:
                await archive_plan_in_stripe(plan, self.payment_provider.secret_key)
            except Exception as exc:
                import logging
                logging.getLogger(__name__).error(
                    "Failed to archive plan %s in Stripe: %s", plan_id, exc
                )

        SubscriptionLogger.plan_deactivated(
            plan_id=plan_id,
            plan_name=deactivated_plan.name,
            deactivated_by=admin_user_id
        )

        active_subs = await self.repository.count_active_subscriptions(plan_id)
        return {
            "message": "Plan deactivated successfully",
            "plan_id": plan_id,
            "active_subscriptions_maintained": active_subs
        }

    async def delete_plan(
        self,
        plan_id: str,
        admin_user_id: str
    ) -> dict:
        """
        Elimina o desactiva un plan según tenga suscriptores.

        - Sin suscriptores: hard delete en MongoDB + archivar en Stripe
        - Con suscriptores: solo desactivar (soft delete + archivar en Stripe)
        - No aplica al plan FREE
        """
        plan = await self.repository.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Plan", plan_id)

        if plan.is_free:
            raise FreePlanProtectionError()

        active_subs = await self.repository.count_active_subscriptions(plan_id)

        if active_subs > 0:
            # Tiene suscriptores: solo desactivar
            return await self.deactivate_plan(plan_id, admin_user_id)

        # Sin suscriptores: archivar en Stripe y eliminar de MongoDB
        if self.payment_provider and plan.stripe_product_id:
            try:
                await archive_plan_in_stripe(plan, self.payment_provider.secret_key)
            except Exception as exc:
                import logging
                logging.getLogger(__name__).error(
                    "Failed to archive plan %s in Stripe: %s", plan_id, exc
                )

        deleted = await self.repository.delete(plan_id)
        if not deleted:
            raise NotFoundError("Plan", plan_id)

        SubscriptionLogger.plan_deactivated(
            plan_id=plan_id,
            plan_name=plan.name,
            deactivated_by=admin_user_id
        )

        return {
            "message": "Plan deleted successfully",
            "plan_id": plan_id,
            "deleted": True
        }

    async def add_currency_price(
        self,
        plan_id: str,
        currency: str,
        amount: float,
        admin_user_id: str
    ) -> PlanResponse:
        """Add a price in a specific currency to a plan."""
        from .constants import SUPPORTED_CURRENCIES
        from .stripe_catalog_service import create_currency_price

        plan = await self.repository.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Plan", plan_id)

        # Validations
        currency = currency.lower()
        if currency not in SUPPORTED_CURRENCIES:
            raise ValidationError(
                f"Currency '{currency}' is not supported. Supported: {', '.join(SUPPORTED_CURRENCIES)}"
            )
        if currency == "usd":
            raise ValidationError("USD price is managed through the plan edit flow")
        if not plan.stripe_product_id:
            raise ValidationError("Plan must be synced with Stripe before adding currency prices")

        existing_currencies = {e.currency for e in plan.stripe_prices}
        if currency in existing_currencies:
            raise ValidationError(f"A price for currency '{currency}' already exists on this plan")

        if not self.payment_provider:
            raise ValidationError("Payment provider not configured")

        # Create Stripe Price
        new_entry = await create_currency_price(
            plan, currency, amount, self.payment_provider.secret_key
        )

        # Append to MongoDB
        updated_prices = [e.model_dump() for e in plan.stripe_prices] + [new_entry.model_dump()]
        await plan.set({
            "stripe_prices": updated_prices,
            "updated_at": datetime.utcnow()
        })

        plan = await self.repository.get_by_id(plan_id)
        active_subs = await self.repository.count_active_subscriptions(plan_id)
        return self._to_response(plan, active_subs)

    async def remove_currency_price(
        self,
        plan_id: str,
        currency: str,
        admin_user_id: str
    ) -> PlanResponse:
        """
        Remove a currency price from a plan.

        Archives the Price in Stripe (active=False) and removes the entry
        from the stripe_prices array in MongoDB. Existing subscriptions
        using this Price continue to work — Stripe keeps archived Prices
        functional for active subscriptions.

        Cannot remove the USD base price.
        """
        plan = await self.repository.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Plan", plan_id)

        currency = currency.lower()
        if currency == "usd":
            raise ValidationError("Cannot remove the USD base price")

        # Find the entry
        target_entry = None
        for entry in plan.stripe_prices:
            if entry.currency == currency:
                target_entry = entry
                break

        if not target_entry:
            raise ValidationError(f"No price found for currency '{currency}' on this plan")

        if not self.payment_provider:
            raise ValidationError("Payment provider not configured")

        # Archive in Stripe
        await deactivate_currency_price(
            target_entry.stripe_price_id, self.payment_provider.secret_key
        )

        # Always remove from MongoDB — the Price is archived in Stripe
        updated_prices = [e.model_dump() for e in plan.stripe_prices if e.currency != currency]
        await plan.set({
            "stripe_prices": updated_prices,
            "updated_at": datetime.utcnow()
        })

        plan = await self.repository.get_by_id(plan_id)
        active_subs = await self.repository.count_active_subscriptions(plan_id)
        return self._to_response(plan, active_subs)

    async def get_active_plans(self) -> list[PlanResponse]:
        """Obtiene todos los planes activos."""
        plans = await self.repository.get_all_active()
        responses = []
        for plan in plans:
            active_subs = await self.repository.count_active_subscriptions(str(plan.id))
            responses.append(self._to_response(plan, active_subs))
        return responses

    async def get_all_plans(self) -> list[PlanResponse]:
        """Obtiene todos los planes (incluyendo inactivos)."""
        plans = await self.repository.get_all()
        responses = []
        for plan in plans:
            active_subs = await self.repository.count_active_subscriptions(str(plan.id))
            responses.append(self._to_response(plan, active_subs))
        return responses

    async def get_plan_by_id(self, plan_id: str) -> PlanResponse:
        """Obtiene un plan por ID."""
        plan = await self.repository.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Plan", plan_id)
        active_subs = await self.repository.count_active_subscriptions(plan_id)
        return self._to_response(plan, active_subs)

    async def get_plan_by_name(self, name: str) -> Optional[PlanResponse]:
        """Obtiene un plan por nombre."""
        plan = await self.repository.get_by_name(name)
        if not plan:
            return None
        active_subs = await self.repository.count_active_subscriptions(str(plan.id))
        return self._to_response(plan, active_subs)

    def _to_response(self, plan: PlanInDB, active_subscriptions: int = 0) -> PlanResponse:
        """Convierte PlanInDB a PlanResponse."""
        return PlanResponse(
            id=str(plan.id),
            name=plan.name,
            code=plan.code or plan.name.upper().replace(" ", "_"),
            description=plan.description,
            price_usd=plan.price_usd,
            max_projects=plan.max_projects,
            max_diagrams=plan.max_diagrams,
            is_active=plan.is_active,
            is_free=plan.is_free,
            active_subscriptions=active_subscriptions,
            stripe_product_id=plan.stripe_product_id,
            stripe_prices=plan.stripe_prices,
            created_at=plan.created_at,
            updated_at=plan.updated_at
        )
