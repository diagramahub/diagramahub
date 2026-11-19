"""
Account deletion service.

Orchestrates the deletion of all user data across collections
in the correct dependency order.
"""

import logging
from typing import Optional

from app.api.v1.users.interfaces import IUserRepository
from app.api.v1.projects.interfaces import IProjectRepository
from app.api.v1.diagrams.interfaces import IDiagramRepository
from app.api.v1.folders.interfaces import IFolderRepository
from app.api.v1.subscriptions.interfaces import ISubscriptionRepository
from app.api.v1.ai_providers.interfaces import IAIProviderRepository
from app.api.v1.prompt_history.interfaces import IPromptHistoryRepository
from app.api.v1.api_tokens.interfaces import IApiTokenRepository
from app.api.v1.community.interfaces import ICommunityRepository
from app.api.v1.activity.interfaces import IActivityRepository

logger = logging.getLogger(__name__)


class AccountDeletionService:
    """Orchestrates the complete deletion of a user account and all associated data."""

    def __init__(
        self,
        user_repository: IUserRepository,
        project_repository: IProjectRepository,
        diagram_repository: IDiagramRepository,
        folder_repository: IFolderRepository,
        subscription_repository: ISubscriptionRepository,
        ai_provider_repository: IAIProviderRepository,
        prompt_history_repository: IPromptHistoryRepository,
        api_token_repository: Optional[IApiTokenRepository] = None,
        community_repository: Optional[ICommunityRepository] = None,
        activity_repository: Optional[IActivityRepository] = None,
    ):
        self.user_repository = user_repository
        self.project_repository = project_repository
        self.diagram_repository = diagram_repository
        self.folder_repository = folder_repository
        self.subscription_repository = subscription_repository
        self.ai_provider_repository = ai_provider_repository
        self.prompt_history_repository = prompt_history_repository
        self.api_token_repository = api_token_repository
        self.community_repository = community_repository
        self.activity_repository = activity_repository

    async def delete_user_account(self, user_id: str) -> None:
        """Delete all data associated with a user account.

        Deletion order:
        1. Diagrams and folders for each project
        2. Projects
        3. Subscriptions
        4. AI provider settings
        5. Prompt history
        6. User document
        """
        # 1. Get all projects for the user
        try:
            projects = await self.project_repository.get_by_user_id(user_id)
        except Exception as e:
            logger.error(
                "Failed to fetch projects for user_id=%s, collection=projects: %s", user_id, e
            )
            raise

        # 2. For each project: delete diagrams, then folders
        for project in projects:
            project_id = str(project.id)

            try:
                await self.diagram_repository.delete_by_project_id(project_id)
            except Exception as e:
                logger.error(
                    "Failed to delete diagrams for user_id=%s, collection=diagrams, "
                    "project_id=%s: %s",
                    user_id,
                    project_id,
                    e,
                )
                raise

            try:
                await self.folder_repository.delete_by_project_id(project_id)
            except Exception as e:
                logger.error(
                    "Failed to delete folders for user_id=%s, collection=folders, "
                    "project_id=%s: %s",
                    user_id,
                    project_id,
                    e,
                )
                raise

        # 3. Delete all projects
        try:
            await self.project_repository.delete_by_user_id(user_id)
        except Exception as e:
            logger.error(
                "Failed to delete data for user_id=%s, collection=projects: %s", user_id, e
            )
            raise

        # 4. Delete subscriptions
        try:
            await self.subscription_repository.delete_by_user_id(user_id)
        except Exception as e:
            logger.error(
                "Failed to delete data for user_id=%s, collection=subscriptions: %s", user_id, e
            )
            raise

        # 5. Delete AI provider settings
        try:
            await self.ai_provider_repository.delete_by_user_id(user_id)
        except Exception as e:
            logger.error(
                "Failed to delete data for user_id=%s, collection=user_ai_settings: %s",
                user_id,
                e,
            )
            raise

        # 6. Delete prompt history
        try:
            await self.prompt_history_repository.delete_by_user_id(user_id)
        except Exception as e:
            logger.error(
                "Failed to delete data for user_id=%s, collection=prompt_history: %s", user_id, e
            )
            raise

        # 7. Delete personal API tokens (they would act for a user that no longer exists)
        if self.api_token_repository is not None:
            try:
                await self.api_token_repository.delete_by_user(user_id)
            except Exception as e:
                logger.error(
                    "Failed to delete data for user_id=%s, collection=api_tokens: %s", user_id, e
                )
                raise

        # 8. Community: publications (with their stars, comments, reports), stars, comments
        if self.community_repository is not None:
            try:
                await self.community_repository.delete_user_data(user_id)
            except Exception as e:
                logger.error(
                    "Failed to delete data for user_id=%s, collection=community_*: %s", user_id, e
                )
                raise

        # 9. Activity (dashboard heatmap)
        if self.activity_repository is not None:
            try:
                await self.activity_repository.delete_by_user_id(user_id)
            except Exception as e:
                logger.error(
                    "Failed to delete data for user_id=%s, collection=diagram_activity: %s",
                    user_id,
                    e,
                )
                raise

        # 10. Delete the user document
        try:
            await self.user_repository.delete_by_id(user_id)
        except Exception as e:
            logger.error("Failed to delete data for user_id=%s, collection=users: %s", user_id, e)
            raise


def build_account_deletion_service() -> AccountDeletionService:
    """The deletion service wired to the MongoDB repositories (self-delete and admin delete)."""
    # Imported here: the concrete repositories pull in every module's schemas.
    from app.api.v1.activity.repository import ActivityRepository
    from app.api.v1.ai_providers.repository import AIProviderRepository
    from app.api.v1.api_tokens.repository import ApiTokenRepository
    from app.api.v1.community.repository import CommunityRepository
    from app.api.v1.diagrams.repository import DiagramRepository
    from app.api.v1.folders.repository import FolderRepository
    from app.api.v1.projects.repository import ProjectRepository
    from app.api.v1.prompt_history.repository import PromptHistoryRepository
    from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository
    from app.api.v1.users.repository import UserRepository

    return AccountDeletionService(
        user_repository=UserRepository(),
        project_repository=ProjectRepository(),
        diagram_repository=DiagramRepository(),
        folder_repository=FolderRepository(),
        subscription_repository=SubscriptionRepository(),
        ai_provider_repository=AIProviderRepository(),
        prompt_history_repository=PromptHistoryRepository(),
        api_token_repository=ApiTokenRepository(),
        community_repository=CommunityRepository(),
        activity_repository=ActivityRepository(),
    )
