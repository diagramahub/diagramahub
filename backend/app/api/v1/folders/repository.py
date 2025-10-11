"""
Concrete implementation of folder repository.
"""
from datetime import datetime
from typing import Optional
from beanie import PydanticObjectId
from .interfaces import IFolderRepository
from .schemas import FolderInDB, FolderCreate, FolderUpdate


class FolderRepository(IFolderRepository):
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
