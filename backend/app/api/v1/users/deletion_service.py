"""
Account deletion service.

Orchestrates the deletion of all user data across collections
in the correct dependency order.
"""
import logging

from app.api.v1.users.interfaces import IUserRepository
from app.api.v1.projects.repository import ProjectRepository
from app.api.v1.diagrams.repository import DiagramRepository
from app.api.v1.folders.repository import FolderRepository
from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository
from app.api.v1.ai_providers.repository import AIProviderRepository
from app.api.v1.prompt_history.repository import PromptHistoryRepository

from app.api.v1.diagrams.schemas import DiagramInDB
from app.api.v1.folders.schemas import FolderInDB
from app.api.v1.projects.schemas import ProjectInDB
from app.api.v1.subscriptions.schemas import SubscriptionInDB
from app.api.v1.ai_providers.schemas import UserAISettingsInDB
from app.api.v1.prompt_history.schemas import PromptHistoryInDB

logger = logging.getLogger(__name__)


class AccountDeletionService:
    """Orchestrates the complete deletion of a user account and all associated data."""

    def __init__(
        self,
        user_repository: IUserRepository,
        project_repository: ProjectRepository,
        diagram_repository: DiagramRepository,
        folder_repository: FolderRepository,
        subscription_repository: SubscriptionRepository,
        ai_provider_repository: AIProviderRepository,
        prompt_history_repository: PromptHistoryRepository,
    ):
        self.user_repository = user_repository
        self.project_repository = project_repository
        self.diagram_repository = diagram_repository
        self.folder_repository = folder_repository
        self.subscription_repository = subscription_repository
        self.ai_provider_repository = ai_provider_repository
        self.prompt_history_repository = prompt_history_repository

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
            logger.error("Failed to fetch projects for user_id=%s, collection=projects: %s", user_id, e)
            raise

        # 2. For each project: delete diagrams, then folders
        for project in projects:
            project_id = str(project.id)

            try:
                await DiagramInDB.find(DiagramInDB.project_id == project_id).delete()
            except Exception as e:
                logger.error("Failed to delete diagrams for user_id=%s, collection=diagrams, project_id=%s: %s", user_id, project_id, e)
                raise

            try:
                await FolderInDB.find(FolderInDB.project_id == project_id).delete()
            except Exception as e:
                logger.error("Failed to delete folders for user_id=%s, collection=folders, project_id=%s: %s", user_id, project_id, e)
                raise

        # 3. Delete all projects
        try:
            await ProjectInDB.find(ProjectInDB.user_id == user_id).delete()
        except Exception as e:
            logger.error("Failed to delete data for user_id=%s, collection=projects: %s", user_id, e)
            raise

        # 4. Delete subscriptions
        try:
            await SubscriptionInDB.find(SubscriptionInDB.user_id == user_id).delete()
        except Exception as e:
            logger.error("Failed to delete data for user_id=%s, collection=subscriptions: %s", user_id, e)
            raise

        # 5. Delete AI provider settings
        try:
            await UserAISettingsInDB.find(UserAISettingsInDB.user_id == user_id).delete()
        except Exception as e:
            logger.error("Failed to delete data for user_id=%s, collection=user_ai_settings: %s", user_id, e)
            raise

        # 6. Delete prompt history
        try:
            await PromptHistoryInDB.find(PromptHistoryInDB.user_id == user_id).delete()
        except Exception as e:
            logger.error("Failed to delete data for user_id=%s, collection=prompt_history: %s", user_id, e)
            raise

        # 7. Delete the user document
        try:
            user = await self.user_repository.get_by_id(user_id)
            if user:
                await user.delete()
        except Exception as e:
            logger.error("Failed to delete data for user_id=%s, collection=users: %s", user_id, e)
            raise
