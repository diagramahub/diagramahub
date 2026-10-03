"""
Concrete implementation of diagram repository.
"""

from typing import Optional
from beanie import PydanticObjectId
from beanie.operators import In
from .interfaces import IDiagramRepository
from .schemas import DiagramInDB, DiagramCreate, DiagramSummary, DiagramUpdate
from app.core.clock import utcnow


# Fields that only describe how a diagram is being viewed, not its content.
PRESENTATION_FIELDS = frozenset({"viewport_zoom", "viewport_x", "viewport_y", "user_preferences"})


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
            created_at=utcnow(),
            updated_at=utcnow(),
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
            created_at=utcnow(),
            updated_at=utcnow(),
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

    async def count_by_project_ids(self, project_ids: list[str]) -> int:
        """Number of diagrams across projects, counted by MongoDB (no documents loaded)."""
        if not project_ids:
            return 0
        return await DiagramInDB.find(In(DiagramInDB.project_id, project_ids)).count()

    async def type_counts_by_project(self, project_ids: list[str]) -> dict[str, dict[str, int]]:
        """``{project_id: {diagram_type: count}}`` from one aggregation (no content loaded)."""
        if not project_ids:
            return {}
        rows = await DiagramInDB.find(In(DiagramInDB.project_id, project_ids)).aggregate(
            [
                {
                    "$group": {
                        "_id": {"p": "$project_id", "t": {"$ifNull": ["$diagram_type", "mermaid"]}},
                        "n": {"$sum": 1},
                    }
                }
            ]
        ).to_list()
        counts: dict[str, dict[str, int]] = {}
        for row in rows:
            counts.setdefault(row["_id"]["p"], {})[row["_id"]["t"] or "mermaid"] = row["n"]
        return counts

    async def get_recent_by_project_ids(
        self, project_ids: list[str], limit: int
    ) -> list[DiagramSummary]:
        """Most recently updated diagrams across projects in one indexed query.

        Sorting, limiting and projecting happen in MongoDB, so only ``limit``
        small documents come back instead of every diagram with its content.
        """
        if not project_ids or limit <= 0:
            return []
        return (
            await DiagramInDB.find(In(DiagramInDB.project_id, project_ids))
            # Sort on updated_at alone (always set) so MongoDB can SORT_MERGE the
            # per-project ranges of the (project_id, updated_at) index: it examines
            # only `limit` documents instead of sorting every match in memory.
            .sort(-DiagramInDB.updated_at)
            .limit(limit)
            .project(DiagramSummary)
            .to_list()
        )

    async def get_by_folder_id(self, folder_id: str, project_id: str) -> list[DiagramInDB]:
        """Get the diagrams of a folder, scoped to the folder's project.

        The project filter keeps a diagram of another project out even if its
        ``folder_id`` points here (defense in depth for cross-project ids).
        """
        return await DiagramInDB.find(
            DiagramInDB.folder_id == folder_id, DiagramInDB.project_id == project_id
        ).to_list()

    async def get_without_folder(self, project_id: str) -> list[DiagramInDB]:
        """Get all diagrams without a folder for a project."""
        # NOTE: ``== None`` is required here — beanie's query DSL overloads
        # equality into a Mongo expression, while ``is None`` would evaluate to
        # a Python bool at call time and break the query builder.
        diagrams = await DiagramInDB.find(
            DiagramInDB.project_id == project_id, DiagramInDB.folder_id == None  # noqa: E711
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
                "updated_at": utcnow(),
            }
        )
        return diagram

    async def update(self, diagram_id: str, diagram_data: DiagramUpdate) -> Optional[DiagramInDB]:
        """Update diagram."""
        diagram = await self.get_by_id(diagram_id)
        if not diagram:
            return None

        update_data = diagram_data.model_dump(exclude_unset=True)
        if not update_data:
            return diagram

        # updated_at tracks edits, not viewing: the editor saves viewport and
        # panel preferences on its own and always sends the full payload, so
        # only a real change to a non-presentation field moves the timestamp
        # (it orders the dashboard's Recent list).
        current = diagram.model_dump(include=set(update_data))
        edited = any(
            current.get(field) != value
            for field, value in update_data.items()
            if field not in PRESENTATION_FIELDS
        )
        if edited:
            update_data["updated_at"] = utcnow()
        await diagram.set(update_data)

        return diagram

    async def delete(self, diagram_id: str) -> bool:
        """Delete diagram."""
        diagram = await self.get_by_id(diagram_id)
        if not diagram:
            return False

        await diagram.delete()
        return True

    async def delete_by_project_id(self, project_id: str) -> int:
        """Delete all diagrams for a project."""
        result = await DiagramInDB.find(DiagramInDB.project_id == project_id).delete()
        return result.deleted_count if result else 0

    async def delete_by_folder_id(self, folder_id: str, project_id: str) -> int:
        """Delete the diagrams of a folder, scoped to the folder's project."""
        result = await DiagramInDB.find(
            DiagramInDB.folder_id == folder_id, DiagramInDB.project_id == project_id
        ).delete()
        return result.deleted_count if result else 0

    async def clear_folder(self, folder_id: str, project_id: str) -> int:
        """Move the diagrams of a folder to the project root, scoped to the folder's project."""
        result = await DiagramInDB.find(
            DiagramInDB.folder_id == folder_id, DiagramInDB.project_id == project_id
        ).update(
            {"$set": {"folder_id": None, "updated_at": utcnow()}}
        )
        return result.modified_count if result else 0
