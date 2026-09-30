"""
Migration service for existing users.
"""

import logging
from typing import Dict, Optional

from ..users.interfaces import IUserRepository
from ..users.repository import UserRepository
from .subscription_service import SubscriptionService

logger = logging.getLogger(__name__)


class MigrationService:
    """Servicio para migrar usuarios existentes al sistema de suscripciones."""

    def __init__(
        self,
        subscription_service: SubscriptionService,
        user_repository: Optional[IUserRepository] = None,
    ):
        self.subscription_service = subscription_service
        self.user_repository = user_repository or UserRepository()

    async def migrate_existing_users(self) -> Dict[str, int]:
        """
        Migra usuarios existentes al sistema de suscripciones.

        Proceso:
        1. Obtener todos los usuarios
        2. Para cada usuario:
           a. Verificar si ya tiene suscripción
           b. Si no tiene, crear suscripción FREE
           c. Registrar en log
        3. Retornar estadísticas

        Returns:
            {
                "total_users": int,
                "migrated": int,
                "already_had_subscription": int,
                "errors": int
            }
        """
        # Obtener todos los usuarios a través de la interfaz de repositorio
        users = await self.user_repository.list_all()

        stats = {
            "total_users": len(users),
            "migrated": 0,
            "already_had_subscription": 0,
            "errors": 0,
        }

        for user in users:
            try:
                # Verificar si ya tiene suscripción
                existing = await self.subscription_service.has_active_subscription(str(user.id))

                if existing:
                    stats["already_had_subscription"] += 1
                    logger.info(f"User {user.email} already has subscription")
                    continue

                # Crear suscripción FREE
                await self.subscription_service.create_free_subscription(str(user.id))

                stats["migrated"] += 1
                logger.info(f"Migrated user {user.email} to FREE plan")

            except Exception as e:
                stats["errors"] += 1
                logger.error(f"Error migrating user {user.email}: {str(e)}")

        return stats
