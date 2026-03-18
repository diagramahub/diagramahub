"""
Usage limiter service for resource restrictions.
"""
from typing import Optional

from .interfaces import ISubscriptionRepository, IPlanRepository
from .exceptions import ResourceLimitError, NotFoundError
from .constants import FREE_PLAN_NAME, FREE_PLAN_CODE, STATUS_ACTIVE, RESOURCE_TYPE_PROJECT, RESOURCE_TYPE_DIAGRAM
from ..projects.interfaces import IProjectRepository
from ..diagrams.interfaces import IDiagramRepository
from ..users.interfaces import IUserRepository
from .logger import SubscriptionLogger


class UsageLimiter:
    """Servicio para validar límites de recursos."""
    
    def __init__(
        self,
        subscription_repository: ISubscriptionRepository,
        plan_repository: IPlanRepository,
        project_repository: IProjectRepository,
        diagram_repository: IDiagramRepository,
        user_repository: Optional[IUserRepository] = None
    ):
        self.subscription_repository = subscription_repository
        self.plan_repository = plan_repository
        self.project_repository = project_repository
        self.diagram_repository = diagram_repository
        self.user_repository = user_repository
    
    async def _is_admin(self, user_id: str) -> bool:
        """Verifica si el usuario es administrador."""
        if not self.user_repository:
            return False
        try:
            user = await self.user_repository.get_by_id(user_id)
            return user is not None and user.role == "admin"
        except Exception:
            return False
    
    async def check_project_limit(self, user_id: str) -> dict:
        """
        Verifica si el usuario puede crear un proyecto.
        
        Admin users have no limits.
        
        Returns:
            {
                "allowed": bool,
                "current_usage": int,
                "limit": int | None,
                "plan_name": str
            }
        """
        # Admin sin límites
        if await self._is_admin(user_id):
            projects = await self.project_repository.get_by_user_id(user_id)
            return {
                "allowed": True,
                "current_usage": len(projects),
                "limit": None,
                "plan_name": "Administrador"
            }
        
        subscription = await self.subscription_repository.get_active_by_user(user_id)
        
        # Si no hay suscripción activa, usar FREE
        if not subscription or subscription.status != STATUS_ACTIVE:
            plan = await self._get_free_plan()
        else:
            plan = await self.plan_repository.get_by_id(subscription.plan_id)
            if not plan:
                plan = await self._get_free_plan()
        
        max_projects = plan.max_projects
        
        # Ilimitado
        if max_projects is None or max_projects == -1:
            return {
                "allowed": True,
                "current_usage": 0,
                "limit": None,
                "plan_name": plan.name
            }
        
        # Contar proyectos activos
        projects = await self.project_repository.get_by_user_id(user_id)
        current_count = len(projects)
        
        allowed = current_count < max_projects
        
        return {
            "allowed": allowed,
            "current_usage": current_count,
            "limit": max_projects,
            "plan_name": plan.name
        }
    
    async def check_diagram_limit(self, user_id: str) -> dict:
        """
        Verifica si el usuario puede crear un diagrama.
        
        Admin users have no limits.
        
        Returns:
            {
                "allowed": bool,
                "current_usage": int,
                "limit": int | None,
                "plan_name": str
            }
        """
        # Admin sin límites
        if await self._is_admin(user_id):
            projects = await self.project_repository.get_by_user_id(user_id)
            total_diagrams = 0
            for project in projects:
                diagrams = await self.diagram_repository.get_by_project_id(str(project.id))
                total_diagrams += len(diagrams)
            return {
                "allowed": True,
                "current_usage": total_diagrams,
                "limit": None,
                "plan_name": "Administrador"
            }
        
        subscription = await self.subscription_repository.get_active_by_user(user_id)
        
        # Si no hay suscripción activa, usar FREE
        if not subscription or subscription.status != STATUS_ACTIVE:
            plan = await self._get_free_plan()
        else:
            plan = await self.plan_repository.get_by_id(subscription.plan_id)
            if not plan:
                plan = await self._get_free_plan()
        
        max_diagrams = plan.max_diagrams
        
        # Ilimitado
        if max_diagrams is None or max_diagrams == -1:
            return {
                "allowed": True,
                "current_usage": 0,
                "limit": None,
                "plan_name": plan.name
            }
        
        # Contar diagramas activos del usuario
        # Necesitamos contar todos los diagramas de todos los proyectos del usuario
        projects = await self.project_repository.get_by_user_id(user_id)
        total_diagrams = 0
        for project in projects:
            diagrams = await self.diagram_repository.get_by_project_id(str(project.id))
            total_diagrams += len(diagrams)
        
        allowed = total_diagrams < max_diagrams
        
        return {
            "allowed": allowed,
            "current_usage": total_diagrams,
            "limit": max_diagrams,
            "plan_name": plan.name
        }
    
    async def get_usage_summary(self, user_id: str) -> dict:
        """
        Obtiene resumen de uso de recursos.
        
        Returns:
            {
                "plan_name": str,
                "projects": {"current": int, "limit": int | None},
                "diagrams": {"current": int, "limit": int | None},
                "usage_percentage": {"projects": float, "diagrams": float}
            }
        """
        project_check = await self.check_project_limit(user_id)
        diagram_check = await self.check_diagram_limit(user_id)
        
        # Calcular porcentajes
        project_pct = 0.0
        if project_check["limit"]:
            project_pct = (project_check["current_usage"] / project_check["limit"]) * 100
        
        diagram_pct = 0.0
        if diagram_check["limit"]:
            diagram_pct = (diagram_check["current_usage"] / diagram_check["limit"]) * 100
        
        return {
            "plan_name": project_check["plan_name"],
            "projects": {
                "current": project_check["current_usage"],
                "limit": project_check["limit"]
            },
            "diagrams": {
                "current": diagram_check["current_usage"],
                "limit": diagram_check["limit"]
            },
            "usage_percentage": {
                "projects": project_pct,
                "diagrams": diagram_pct
            }
        }
    
    async def enforce_project_limit(self, user_id: str):
        """
        Valida límite de proyectos y lanza excepción si se alcanzó.
        
        Raises:
            ResourceLimitError: Si el límite fue alcanzado
        """
        check = await self.check_project_limit(user_id)
        if not check["allowed"]:
            # Log limit exceeded
            SubscriptionLogger.resource_limit_exceeded(
                user_id=user_id,
                resource_type=RESOURCE_TYPE_PROJECT,
                current_usage=check["current_usage"],
                limit=check["limit"],
                plan_name=check["plan_name"]
            )
            raise ResourceLimitError(
                resource_type=RESOURCE_TYPE_PROJECT,
                current=check["current_usage"],
                limit=check["limit"]
            )
    
    async def enforce_diagram_limit(self, user_id: str):
        """
        Valida límite de diagramas y lanza excepción si se alcanzó.
        
        Raises:
            ResourceLimitError: Si el límite fue alcanzado
        """
        check = await self.check_diagram_limit(user_id)
        if not check["allowed"]:
            # Log limit exceeded
            SubscriptionLogger.resource_limit_exceeded(
                user_id=user_id,
                resource_type=RESOURCE_TYPE_DIAGRAM,
                current_usage=check["current_usage"],
                limit=check["limit"],
                plan_name=check["plan_name"]
            )
            raise ResourceLimitError(
                resource_type=RESOURCE_TYPE_DIAGRAM,
                current=check["current_usage"],
                limit=check["limit"]
            )
    
    async def _get_free_plan(self):
        """Obtiene el plan FREE por código, con fallback por nombre."""
        plan = await self.plan_repository.get_by_code(FREE_PLAN_CODE)
        if not plan:
            plan = await self.plan_repository.get_by_name(FREE_PLAN_NAME)
        if not plan:
            raise NotFoundError("Plan", FREE_PLAN_CODE)
        return plan
