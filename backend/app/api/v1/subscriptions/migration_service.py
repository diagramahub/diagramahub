"""
Migration service for existing users.
"""
import logging
from typing import Dict

from ..users.schemas import UserInDB
from .subscription_service import SubscriptionService

logger = logging.getLogger(__name__)


class MigrationService:
    """Servicio para migrar usuarios existentes al sistema de suscripciones."""
    
    def __init__(
        self,
        subscription_service: SubscriptionService
    ):
        self.subscription_service = subscription_service
    
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
        # Obtener todos los usuarios directamente de Beanie
        users = await UserInDB.find_all().to_list()
        
        stats = {
            "total_users": len(users),
            "migrated": 0,
            "already_had_subscription": 0,
            "errors": 0
        }
        
        for user in users:
            try:
                # Verificar si ya tiene suscripción
                existing = await self.subscription_service.repository.get_active_by_user(
                    str(user.id)
                )
                
                if existing:
                    stats["already_had_subscription"] += 1
                    logger.info(f"User {user.email} already has subscription")
                    continue
                
                # Crear suscripción FREE
                await self.subscription_service.create_free_subscription(
                    str(user.id)
                )
                
                stats["migrated"] += 1
                logger.info(f"Migrated user {user.email} to FREE plan")
                
            except Exception as e:
                stats["errors"] += 1
                logger.error(f"Error migrating user {user.email}: {str(e)}")
        
        return stats
