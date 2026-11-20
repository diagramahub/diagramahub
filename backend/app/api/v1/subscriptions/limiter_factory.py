"""The usage limiter wired to the MongoDB repositories (one place for every route module)."""

from .usage_limiter import UsageLimiter


def build_usage_limiter() -> UsageLimiter:
    """Usage limiter that knows the Community publications (public diagrams don't count)."""
    # Imported here: the concrete repositories pull in other modules' schemas, and the
    # community module itself depends on the limiter.
    from app.api.v1.community.repository import CommunityRepository
    from app.api.v1.diagrams.repository import DiagramRepository
    from app.api.v1.projects.repository import ProjectRepository
    from app.api.v1.users.repository import UserRepository

    from .plan_repository import PlanRepository
    from .subscription_repository import SubscriptionRepository

    return UsageLimiter(
        subscription_repository=SubscriptionRepository(),
        plan_repository=PlanRepository(),
        project_repository=ProjectRepository(),
        diagram_repository=DiagramRepository(),
        user_repository=UserRepository(),
        publication_source=CommunityRepository(),
    )
