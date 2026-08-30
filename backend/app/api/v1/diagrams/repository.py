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
            config=diagram_data.config,
            project_id=project_id,
            folder_id=diagram_data.folder_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        await diagram.insert()
        return diagram

    async def duplicate(self, source: DiagramInDB, new_title: str) -> DiagramInDB:
        """Duplicate a diagram into the same project and folder with a new title.

        The copy keeps content, description, type, config and user preferences;
        the viewport is reset so the clone opens with a fresh view.
        """
        diagram = DiagramInDB(
            title=new_title,
            content=source.content,
            description=source.description,
            diagram_type=source.diagram_type,
            config=source.config,
            user_preferences=source.user_preferences,
            project_id=source.project_id,
            folder_id=source.folder_id,
            viewport_zoom=1.0,
            viewport_x=0.0,
            viewport_y=0.0,
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

    async def move(self, diagram_id: str, target_project_id: str) -> Optional[DiagramInDB]:
        """Move a diagram to another project and remove its folder assignment."""
        diagram = await self.get_by_id(diagram_id)
        if not diagram:
            return None

        await diagram.set(
            {
                "project_id": target_project_id,
                "folder_id": None,
                "updated_at": datetime.utcnow(),
            }
        )
        return diagram

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
