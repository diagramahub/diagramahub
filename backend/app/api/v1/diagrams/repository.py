"""
Concrete implementation of diagram repository.
"""
from datetime import datetime
from typing import Optional
from beanie import PydanticObjectId
from .interfaces import IDiagramRepository
from .schemas import DiagramInDB, DiagramCreate, DiagramUpdate


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
