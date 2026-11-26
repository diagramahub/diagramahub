"""
MongoDB implementation of the diagram file repository (Beanie).
"""

from datetime import datetime
from typing import Any, Optional

from beanie.operators import In
from pymongo.errors import DuplicateKeyError

from app.core.clock import utcnow

from .interfaces import IDiagramFileRepository
from .schemas import DiagramFileInDB, DiagramFileMeta, FileScope


def _scope_filter(scope: FileScope, scope_id: str) -> dict[str, Any]:
    """Raw filter for the files of one scope."""
    return {"scope": scope.value, "scope_id": scope_id}


class DiagramFileRepository(IDiagramFileRepository):
    """Diagram files stored in the ``diagram_files`` collection."""

    async def get(self, scope: FileScope, scope_id: str, file_id: str) -> Optional[DiagramFileInDB]:
        """A file of a scope, with its bytes (None when missing)."""
        return await DiagramFileInDB.find_one(
            {**_scope_filter(scope, scope_id), "file_id": file_id}
        )

    async def get_meta(
        self, scope: FileScope, scope_id: str, file_id: str
    ) -> Optional[DiagramFileMeta]:
        """A file of a scope without its bytes (None when missing)."""
        return await DiagramFileInDB.find_one(
            {**_scope_filter(scope, scope_id), "file_id": file_id},
            projection_model=DiagramFileMeta,
        )

    async def create(self, file: DiagramFileInDB) -> tuple[DiagramFileMeta, bool]:
        """Store a file; when the same file already exists in its scope, keep that one.

        Two uploads of the same image at once both end up here: the unique index
        lets one insert win and the other read it back.
        """
        try:
            await file.insert()
        except DuplicateKeyError:
            existing = await self.get_meta(file.scope, file.scope_id, file.file_id)
            if existing is None:  # deleted in between: nothing sensible to return
                raise
            return existing, False
        return (
            DiagramFileMeta(
                file_id=file.file_id,
                mime_type=file.mime_type,
                size=file.size,
                created_at=file.created_at,
            ),
            True,
        )

    async def list_meta(self, scope: FileScope, scope_id: str) -> list[DiagramFileMeta]:
        """Every file of a scope, without bytes."""
        return await DiagramFileInDB.find(
            _scope_filter(scope, scope_id), projection_model=DiagramFileMeta
        ).to_list()

    async def count(self, scope: FileScope, scope_id: str) -> int:
        """How many files a scope has (counted by MongoDB)."""
        return await DiagramFileInDB.find(_scope_filter(scope, scope_id)).count()

    async def copy(
        self,
        source_scope: FileScope,
        source_id: str,
        target_scope: FileScope,
        target_id: str,
        owner_id: str,
        file_ids: list[str],
    ) -> None:
        """Copy files between scopes inside MongoDB (the bytes never reach the app).

        ``$merge`` on the unique (scope, scope_id, file_id) index keeps any file
        the target already has, so copying twice is harmless.
        """
        if not file_ids:
            return
        collection = DiagramFileInDB.get_pymongo_collection()
        pipeline: list[dict[str, Any]] = [
            {"$match": {**_scope_filter(source_scope, source_id), "file_id": {"$in": file_ids}}},
            {
                "$project": {
                    "_id": 0,
                    "scope": {"$literal": target_scope.value},
                    "scope_id": {"$literal": target_id},
                    "owner_id": {"$literal": owner_id},
                    "file_id": 1,
                    "mime_type": 1,
                    "size": 1,
                    "data": 1,
                    "created_at": {"$literal": utcnow()},
                }
            },
            {
                "$merge": {
                    "into": collection.name,
                    "on": ["scope", "scope_id", "file_id"],
                    "whenMatched": "keepExisting",
                    "whenNotMatched": "insert",
                }
            },
        ]
        cursor = await collection.aggregate(pipeline)
        await cursor.to_list(None)

    async def delete_files(
        self,
        scope: FileScope,
        scope_id: str,
        file_ids: list[str],
        created_before: Optional[datetime] = None,
    ) -> int:
        """Delete some files of a scope (optionally only those stored before a time)."""
        if not file_ids:
            return 0
        query: dict[str, Any] = {**_scope_filter(scope, scope_id), "file_id": {"$in": file_ids}}
        if created_before is not None:
            query["created_at"] = {"$lt": created_before}
        result = await DiagramFileInDB.find(query).delete()
        return result.deleted_count if result else 0

    async def delete_scopes(self, scope: FileScope, scope_ids: list[str]) -> int:
        """Delete every file of these scopes."""
        if not scope_ids:
            return 0
        result = await DiagramFileInDB.find(
            DiagramFileInDB.scope == scope, In(DiagramFileInDB.scope_id, scope_ids)
        ).delete()
        return result.deleted_count if result else 0

    async def delete_by_owner(self, owner_id: str) -> int:
        """Delete every file a user owns."""
        result = await DiagramFileInDB.find(DiagramFileInDB.owner_id == owner_id).delete()
        return result.deleted_count if result else 0
