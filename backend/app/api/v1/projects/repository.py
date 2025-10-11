"""
Concrete implementation of project and diagram repositories.
"""
from datetime import datetime
from typing import Optional
from beanie import PydanticObjectId
from .interfaces import IProjectRepository, IDiagramRepository
from .schemas import (
    ProjectInDB, ProjectCreate, ProjectUpdate,
    DiagramInDB, DiagramCreate, DiagramUpdate,
    FolderInDB, FolderCreate, FolderUpdate
)


class ProjectRepository(IProjectRepository):
    """MongoDB implementation of project repository using Beanie."""

    async def create(self, project_data: ProjectCreate, user_id: str) -> ProjectInDB:
        """Create a new project."""
        project = ProjectInDB(
            name=project_data.name,
            description=project_data.description,
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


class DiagramRepository(IDiagramRepository):
    """MongoDB implementation of diagram repository using Beanie."""

    async def create(self, diagram_data: DiagramCreate, project_id: str) -> DiagramInDB:
        """Create a new diagram."""
        diagram = DiagramInDB(
            title=diagram_data.title,
            content=diagram_data.content,
            description=diagram_data.description,
            diagram_type=diagram_data.diagram_type,
            project_id=project_id,
            folder_id=diagram_data.folder_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        await diagram.insert()
        return diagram

    async def get_by_id(self, diagram_id: str) -> Optional[DiagramInDB]:
        """Get diagram by ID."""
        try:
            return await DiagramInDB.get(PydanticObjectId(diagram_id))
        except Exception:
            return None

    async def get_by_project_id(self, project_id: str) -> list[DiagramInDB]:
        """Get all diagrams for a project."""
        diagrams = await DiagramInDB.find(DiagramInDB.project_id == project_id).to_list()
        return diagrams

    async def get_by_folder_id(self, folder_id: str) -> list[DiagramInDB]:
        """Get all diagrams for a folder."""
        diagrams = await DiagramInDB.find(DiagramInDB.folder_id == folder_id).to_list()
        return diagrams

    async def get_without_folder(self, project_id: str) -> list[DiagramInDB]:
        """Get all diagrams without a folder for a project."""
        diagrams = await DiagramInDB.find(
            DiagramInDB.project_id == project_id,
            DiagramInDB.folder_id == None
        ).to_list()
        return diagrams

    async def update(self, diagram_id: str, diagram_data: DiagramUpdate) -> Optional[DiagramInDB]:
        """Update diagram."""
        diagram = await self.get_by_id(diagram_id)
        if not diagram:
            return None

        update_data = diagram_data.model_dump(exclude_unset=True)
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            await diagram.set(update_data)

        return diagram

    async def delete(self, diagram_id: str) -> bool:
        """Delete diagram."""
        diagram = await self.get_by_id(diagram_id)
        if not diagram:
            return False

        await diagram.delete()
        return True


class FolderRepository:
    """MongoDB implementation of folder repository using Beanie."""

    async def create(self, folder_data: FolderCreate, project_id: str) -> FolderInDB:
        """Create a new folder."""
        folder = FolderInDB(
            name=folder_data.name,
            color=folder_data.color or "#3B82F6",
            project_id=project_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        await folder.insert()
        return folder

    async def get_by_id(self, folder_id: str) -> Optional[FolderInDB]:
        """Get folder by ID."""
        try:
            return await FolderInDB.get(PydanticObjectId(folder_id))
        except Exception:
            return None

    async def get_by_project_id(self, project_id: str) -> list[FolderInDB]:
        """Get all folders for a project, sorted alphabetically by name."""
        folders = await FolderInDB.find(FolderInDB.project_id == project_id).to_list()
        return sorted(folders, key=lambda f: f.name.lower())

    async def update(self, folder_id: str, folder_data: FolderUpdate) -> Optional[FolderInDB]:
        """Update folder."""
        folder = await self.get_by_id(folder_id)
        if not folder:
            return None

        update_data = folder_data.model_dump(exclude_unset=True)
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            await folder.set(update_data)

        return folder

    async def delete(self, folder_id: str) -> bool:
        """Delete folder."""
        folder = await self.get_by_id(folder_id)
        if not folder:
            return False

        await folder.delete()
        return True
