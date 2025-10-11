"""
Concrete implementation of project repository.
"""
from datetime import datetime
from typing import Optional
from beanie import PydanticObjectId
from .interfaces import IProjectRepository
from .schemas import ProjectInDB, ProjectCreate, ProjectUpdate


class ProjectRepository(IProjectRepository):
    """MongoDB implementation of project repository using Beanie."""

    async def create(self, project_data: ProjectCreate, user_id: str) -> ProjectInDB:
        """Create a new project."""
        project = ProjectInDB(
            name=project_data.name,
            description=project_data.description,
            emoji=project_data.emoji or "📊",
            user_id=user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        await project.insert()
        return project

    async def get_by_id(self, project_id: str) -> Optional[ProjectInDB]:
        """Get project by ID."""
        try:
            return await ProjectInDB.get(PydanticObjectId(project_id))
        except Exception:
            return None

    async def get_by_user_id(self, user_id: str) -> list[ProjectInDB]:
        """Get all projects for a user."""
        projects = await ProjectInDB.find(ProjectInDB.user_id == user_id).to_list()
        return projects

    async def update(self, project_id: str, project_data: ProjectUpdate) -> Optional[ProjectInDB]:
        """Update project."""
        project = await self.get_by_id(project_id)
        if not project:
            return None

        update_data = project_data.model_dump(exclude_unset=True)
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            await project.set(update_data)

        return project

    async def delete(self, project_id: str) -> bool:
        """Delete project."""
        project = await self.get_by_id(project_id)
        if not project:
            return False

        await project.delete()
        return True
