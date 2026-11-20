"""
Usage limiter service for resource restrictions.
"""

from typing import Optional

from .interfaces import IPlanRepository, IPublicationSource, ISubscriptionRepository
from .exceptions import ResourceLimitError, NotFoundError
from .constants import (
    FREE_PLAN_NAME,
    FREE_PLAN_CODE,
    STATUS_ACTIVE,
    RESOURCE_TYPE_PROJECT,
    RESOURCE_TYPE_DIAGRAM,
    RESOURCE_TYPE_PRIVATE_DIAGRAM,
    RESOURCE_TYPE_PUBLIC_DIAGRAM,
)
from .schemas import PlanInDB
from ..projects.interfaces import IProjectRepository
from ..diagrams.interfaces import IDiagramRepository
from ..users.interfaces import IUserRepository
from ..users.schemas import UserRole
from .logger import SubscriptionLogger


def _limit(value: Optional[int]) -> Optional[int]:
    """A plan limit, or None when unlimited (None or -1)."""
    return None if value is None or value == -1 else value


class UsageLimiter:
    """Servicio para validar límites de recursos."""

    def __init__(
        self,
        subscription_repository: ISubscriptionRepository,
        plan_repository: IPlanRepository,
        project_repository: IProjectRepository,
        diagram_repository: IDiagramRepository,
        user_repository: Optional[IUserRepository] = None,
        publication_source: Optional[IPublicationSource] = None,
    ):
        self.subscription_repository = subscription_repository
        self.plan_repository = plan_repository
        self.project_repository = project_repository
        self.diagram_repository = diagram_repository
        self.user_repository = user_repository
        # Community publications: without it every diagram counts as private.
        self.publication_source = publication_source

    async def _is_admin(self, user_id: str) -> bool:
        """Verifica si el usuario es administrador."""
        if not self.user_repository:
            return False
        try:
            user = await self.user_repository.get_by_id(user_id)
            return user is not None and user.role == UserRole.ADMIN
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
                "plan_name": "Administrador",
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
            return {"allowed": True, "current_usage": 0, "limit": None, "plan_name": plan.name}

        # Contar proyectos activos
        projects = await self.project_repository.get_by_user_id(user_id)
        current_count = len(projects)

        allowed = current_count < max_projects

        return {
            "allowed": allowed,
            "current_usage": current_count,
            "limit": max_projects,
            "plan_name": plan.name,
        }

    async def _plan_for(self, user_id: str) -> PlanInDB:
        """The plan of the user's active subscription, or FREE."""
        subscription = await self.subscription_repository.get_active_by_user(user_id)
        if subscription and subscription.status == STATUS_ACTIVE:
            plan = await self.plan_repository.get_by_id(subscription.plan_id)
            if plan:
                return plan
        return await self._get_free_plan()

    async def _diagram_counts(self, user_id: str) -> tuple[int, int]:
        """(all the user's diagrams, those published and visible in the Community)."""
        projects = await self.project_repository.get_by_user_id(user_id)
        project_ids = [str(p.id) for p in projects]
        total = await self.diagram_repository.count_by_project_ids(project_ids)
        if self.publication_source is None or not total:
            return total, 0
        visible = [
            diagram_id
            for diagram_id, _publication_id, hidden in await self.publication_source.published_sources(
                user_id
            )
            if not hidden
        ]
        # A publication outlives its deleted diagram: count only diagrams that still exist.
        public = await self.diagram_repository.count_in_projects(project_ids, visible)
        return total, public

    async def check_diagram_limit(self, user_id: str) -> dict:
        """
        Whether the user can add a private diagram (create, duplicate, fork, import).

        By default the plan's ``max_diagrams`` counts only **private** diagrams:
        those published and visible in the Community don't count (a publication
        hidden by moderation does). A plan with ``public_diagrams_count`` counts
        every diagram. Admin users have no limits.

        Returns:
            {
                "allowed": bool,
                "current_usage": int,  # diagrams that count toward the limit
                "limit": int | None,
                "plan_name": str,
                "public_usage": int,  # published and visible
                "public_counts": bool,
                "public_limit": int | None,
            }
        """
        total, public = await self._diagram_counts(user_id)
        if await self._is_admin(user_id):
            return {
                "allowed": True,
                "current_usage": total - public,
                "limit": None,
                "plan_name": "Administrador",
                "public_usage": public,
                "public_counts": False,
                "public_limit": None,
            }

        plan = await self._plan_for(user_id)
        counts_public = bool(plan.public_diagrams_count)
        current = total if counts_public else total - public
        limit = _limit(plan.max_diagrams)
        return {
            "allowed": limit is None or current < limit,
            "current_usage": current,
            "limit": limit,
            "plan_name": plan.name,
            "public_usage": public,
            "public_counts": counts_public,
            "public_limit": _limit(plan.max_public_diagrams),
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
                "limit": project_check["limit"],
            },
            "diagrams": {
                "current": diagram_check["current_usage"],
                "limit": diagram_check["limit"],
                "public": diagram_check["public_usage"],
                "public_counts": diagram_check["public_counts"],
                "public_limit": diagram_check["public_limit"],
            },
            "usage_percentage": {"projects": project_pct, "diagrams": diagram_pct},
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
                plan_name=check["plan_name"],
            )
            raise ResourceLimitError(
                resource_type=RESOURCE_TYPE_PROJECT,
                current=check["current_usage"],
                limit=check["limit"],
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
                plan_name=check["plan_name"],
            )
            raise ResourceLimitError(
                resource_type=RESOURCE_TYPE_DIAGRAM,
                current=check["current_usage"],
                limit=check["limit"],
                # False: publishing a diagram in the Community would free a slot.
                public_counts=check.get("public_counts", False),
            )

    async def enforce_can_make_private(self, user_id: str) -> None:
        """Before the owner unpublishes a visible publication: it becomes a private diagram.

        Raises:
            ResourceLimitError: The plan has no room for one more private diagram
                (``resource_type="private_diagrams"``).
        """
        check = await self.check_diagram_limit(user_id)
        if check["public_counts"] or check["allowed"]:
            return
        SubscriptionLogger.resource_limit_exceeded(
            user_id=user_id,
            resource_type=RESOURCE_TYPE_PRIVATE_DIAGRAM,
            current_usage=check["current_usage"],
            limit=check["limit"],
            plan_name=check["plan_name"],
        )
        raise ResourceLimitError(
            resource_type=RESOURCE_TYPE_PRIVATE_DIAGRAM,
            current=check["current_usage"],
            limit=check["limit"],
        )

    async def enforce_public_limit(self, user_id: str) -> None:
        """Before publishing: the plan's ``max_public_diagrams``, when it sets one.

        Raises:
            ResourceLimitError: ``resource_type="public_diagrams"``.
        """
        check = await self.check_diagram_limit(user_id)
        limit = check["public_limit"]
        if limit is None or check["public_usage"] < limit:
            return
        SubscriptionLogger.resource_limit_exceeded(
            user_id=user_id,
            resource_type=RESOURCE_TYPE_PUBLIC_DIAGRAM,
            current_usage=check["public_usage"],
            limit=limit,
            plan_name=check["plan_name"],
        )
        raise ResourceLimitError(
            resource_type=RESOURCE_TYPE_PUBLIC_DIAGRAM, current=check["public_usage"], limit=limit
        )

    async def _get_free_plan(self):
        """Obtiene el plan FREE por código, con fallback por nombre."""
        plan = await self.plan_repository.get_by_code(FREE_PLAN_CODE)
        if not plan:
            plan = await self.plan_repository.get_by_name(FREE_PLAN_NAME)
        if not plan:
            raise NotFoundError("Plan", FREE_PLAN_CODE)
        return plan
