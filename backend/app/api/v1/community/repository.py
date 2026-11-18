"""
MongoDB implementation of the community repository (Beanie / PyMongo).
"""

import re
from datetime import datetime
from typing import Any, Optional

from beanie import PydanticObjectId
from beanie.odm.enums import SortDirection
from pymongo.errors import DuplicateKeyError

from .interfaces import ICommunityRepository
from .schemas import (
    CommunityCommentInDB,
    CommunityForkInDB,
    CommunityReportInDB,
    CommunityStarInDB,
    PublishedDiagramInDB,
)

COUNTERS = {"stars_count", "forks_count", "views_count", "comments_count", "reports_count"}


def _object_id(value: str) -> Optional[PydanticObjectId]:
    try:
        return PydanticObjectId(value)
    except Exception:
        return None


class CommunityRepository(ICommunityRepository):
    """Publications in ``community_diagrams`` plus stars, comments and reports."""

    # ------------------------------------------------------------------ #
    #  Publications
    # ------------------------------------------------------------------ #

    async def create_publication(self, publication: PublishedDiagramInDB) -> PublishedDiagramInDB:
        await publication.insert()
        return publication

    async def get_publication(self, publication_id: str) -> Optional[PublishedDiagramInDB]:
        object_id = _object_id(publication_id)
        return await PublishedDiagramInDB.get(object_id) if object_id else None

    async def get_by_source(self, source_diagram_id: str) -> Optional[PublishedDiagramInDB]:
        return await PublishedDiagramInDB.find_one(
            PublishedDiagramInDB.source_diagram_id == source_diagram_id
        )

    async def set_fields(self, publication_id: str, fields: dict) -> None:
        object_id = _object_id(publication_id)
        if object_id and fields:
            await PublishedDiagramInDB.get_pymongo_collection().update_one(
                {"_id": object_id}, {"$set": fields}
            )

    async def delete_publication(self, publication_id: str) -> None:
        await CommunityStarInDB.find(CommunityStarInDB.publication_id == publication_id).delete()
        await CommunityCommentInDB.find(
            CommunityCommentInDB.publication_id == publication_id
        ).delete()
        await CommunityReportInDB.find(
            CommunityReportInDB.publication_id == publication_id
        ).delete()
        publication = await self.get_publication(publication_id)
        if publication:
            await publication.delete()

    async def search_publications(
        self,
        *,
        text: Optional[str],
        category: Optional[str],
        diagram_type: Optional[str],
        only_ids: Optional[list[str]],
        owner_id: Optional[str],
        featured: bool,
        include_hidden: bool,
        sort: str,
        skip: int,
        limit: int,
    ) -> tuple[list[PublishedDiagramInDB], int]:
        match: dict[str, Any] = {}
        if not include_hidden:
            match["hidden"] = False
        if category:
            match["category"] = category
        if diagram_type:
            match["diagram_type"] = diagram_type
        if owner_id:
            match["owner_id"] = owner_id
        if featured:
            match["featured"] = True
        if only_ids is not None:
            match["_id"] = {"$in": [oid for oid in map(_object_id, only_ids) if oid]}
        if text:
            pattern = {"$regex": re.escape(text), "$options": "i"}
            match["$or"] = [
                {"title": pattern},
                {"owner_name": pattern},
                {"tags": pattern},
                {"description": pattern},
            ]

        collection = PublishedDiagramInDB.get_pymongo_collection()
        total = await collection.count_documents(match)
        pipeline: list[dict[str, Any]] = [{"$match": match}]
        if sort == "trending":
            # Stars per day of age, damped: recent popular diagrams first.
            pipeline += [
                {
                    "$addFields": {
                        "_age_days": {
                            "$divide": [{"$subtract": ["$$NOW", "$published_at"]}, 86_400_000]
                        }
                    }
                },
                {
                    "$addFields": {
                        "_score": {
                            "$divide": [
                                {"$add": ["$stars_count", {"$multiply": ["$forks_count", 2]}, 1]},
                                {"$pow": [{"$add": ["$_age_days", 2]}, 1.5]},
                            ]
                        }
                    }
                },
                {"$sort": {"_score": -1, "published_at": -1}},
            ]
        else:
            field = {"stars": "stars_count", "forks": "forks_count"}.get(sort, "published_at")
            pipeline.append({"$sort": {field: -1, "published_at": -1}})
        pipeline += [
            {"$skip": skip},
            {"$limit": limit},
            {"$project": {"_age_days": 0, "_score": 0}},
        ]
        cursor = await collection.aggregate(pipeline)
        docs = await cursor.to_list(None)
        return [PublishedDiagramInDB.model_validate(doc) for doc in docs], total

    async def list_by_owner(self, owner_id: str, limit: int) -> list[PublishedDiagramInDB]:
        return (
            await PublishedDiagramInDB.find(
                PublishedDiagramInDB.owner_id == owner_id,
                PublishedDiagramInDB.hidden == False,  # noqa: E712
            )
            .sort([("stars_count", SortDirection.DESCENDING)])
            .limit(limit)
            .to_list()
        )

    async def published_sources(self, owner_id: str) -> list[tuple[str, str, bool]]:
        cursor = PublishedDiagramInDB.get_pymongo_collection().find(
            {"owner_id": owner_id}, {"source_diagram_id": 1, "hidden": 1}
        )
        return [
            (doc["source_diagram_id"], str(doc["_id"]), bool(doc.get("hidden", False)))
            async for doc in cursor
        ]

    async def owner_totals(self, owner_id: str) -> dict[str, int]:
        rows = await (
            await PublishedDiagramInDB.get_pymongo_collection().aggregate(
                [
                    {"$match": {"owner_id": owner_id}},
                    {
                        "$group": {
                            "_id": None,
                            "publications": {"$sum": 1},
                            "stars": {"$sum": "$stars_count"},
                            "forks": {"$sum": "$forks_count"},
                            "views": {"$sum": "$views_count"},
                            "comments": {"$sum": "$comments_count"},
                        }
                    },
                ]
            )
        ).to_list(None)
        keys = ("publications", "stars", "forks", "views", "comments")
        row = rows[0] if rows else {}
        return {key: int(row.get(key) or 0) for key in keys}

    async def count_stars_since(self, publication_ids: list[str], since: datetime) -> int:
        if not publication_ids:
            return 0
        return await CommunityStarInDB.get_pymongo_collection().count_documents(
            {"publication_id": {"$in": publication_ids}, "created_at": {"$gte": since}}
        )

    async def increment(self, publication_id: str, field: str, amount: int = 1) -> None:
        if field not in COUNTERS:
            raise ValueError(f"Unknown counter {field}")
        object_id = _object_id(publication_id)
        if object_id:
            await PublishedDiagramInDB.get_pymongo_collection().update_one(
                {"_id": object_id}, {"$inc": {field: amount}}
            )

    # ------------------------------------------------------------------ #
    #  Stars
    # ------------------------------------------------------------------ #

    async def add_star(self, publication_id: str, user_id: str) -> bool:
        try:
            await CommunityStarInDB(publication_id=publication_id, user_id=user_id).insert()
        except DuplicateKeyError:
            return False
        return True

    async def remove_star(self, publication_id: str, user_id: str) -> bool:
        result = await CommunityStarInDB.find(
            CommunityStarInDB.publication_id == publication_id,
            CommunityStarInDB.user_id == user_id,
        ).delete()
        return bool(result and result.deleted_count)

    async def starred_ids(
        self, user_id: str, publication_ids: Optional[list[str]] = None
    ) -> set[str]:
        query: dict[str, Any] = {"user_id": user_id}
        if publication_ids is not None:
            query["publication_id"] = {"$in": publication_ids}
        stars = await CommunityStarInDB.find(query).to_list()
        return {s.publication_id for s in stars}

    # ------------------------------------------------------------------ #
    #  Forks
    # ------------------------------------------------------------------ #

    async def add_fork(self, fork: CommunityForkInDB) -> CommunityForkInDB:
        await fork.insert()
        return fork

    async def get_fork_by_diagram(self, diagram_id: str) -> Optional[CommunityForkInDB]:
        return await CommunityForkInDB.find_one(CommunityForkInDB.diagram_id == diagram_id)

    # ------------------------------------------------------------------ #
    #  Comments
    # ------------------------------------------------------------------ #

    async def add_comment(self, comment: CommunityCommentInDB) -> CommunityCommentInDB:
        await comment.insert()
        return comment

    async def get_comment(self, comment_id: str) -> Optional[CommunityCommentInDB]:
        object_id = _object_id(comment_id)
        return await CommunityCommentInDB.get(object_id) if object_id else None

    async def list_comments(self, publication_id: str) -> list[CommunityCommentInDB]:
        return (
            await CommunityCommentInDB.find(
                CommunityCommentInDB.publication_id == publication_id,
                CommunityCommentInDB.hidden == False,  # noqa: E712
            )
            .sort([("created_at", SortDirection.ASCENDING)])
            .to_list()
        )

    async def delete_comment(self, comment_id: str) -> int:
        replies = await CommunityCommentInDB.find(
            CommunityCommentInDB.parent_id == comment_id
        ).delete()
        comment = await self.get_comment(comment_id)
        deleted = replies.deleted_count if replies else 0
        if comment:
            await comment.delete()
            deleted += 1
        return deleted

    async def set_comment_hidden(self, comment_id: str, hidden: bool) -> None:
        object_id = _object_id(comment_id)
        if object_id:
            await CommunityCommentInDB.get_pymongo_collection().update_one(
                {"_id": object_id}, {"$set": {"hidden": hidden}}
            )

    # ------------------------------------------------------------------ #
    #  Reports
    # ------------------------------------------------------------------ #

    async def add_report(self, report: CommunityReportInDB) -> bool:
        try:
            await report.insert()
        except DuplicateKeyError:
            return False
        return True

    async def open_reports(self, limit: int) -> list[CommunityReportInDB]:
        return (
            await CommunityReportInDB.find(CommunityReportInDB.resolved == False)  # noqa: E712
            .sort([("created_at", SortDirection.DESCENDING)])
            .limit(limit)
            .to_list()
        )

    async def resolve_reports(self, target_type: str, target_id: str) -> None:
        await CommunityReportInDB.get_pymongo_collection().update_many(
            {"target_type": target_type, "target_id": target_id}, {"$set": {"resolved": True}}
        )

    async def count_open_reports(self, target_type: str, target_id: str) -> int:
        return await CommunityReportInDB.find(
            CommunityReportInDB.target_type == target_type,
            CommunityReportInDB.target_id == target_id,
            CommunityReportInDB.resolved == False,  # noqa: E712
        ).count()

    # ------------------------------------------------------------------ #
    #  Account deletion
    # ------------------------------------------------------------------ #

    async def delete_user_data(self, user_id: str) -> None:
        for publication in await PublishedDiagramInDB.find(
            PublishedDiagramInDB.owner_id == user_id
        ).to_list():
            await self.delete_publication(str(publication.id))
        # Keep counters right on the publications they starred / commented.
        for star in await CommunityStarInDB.find(CommunityStarInDB.user_id == user_id).to_list():
            await self.increment(star.publication_id, "stars_count", -1)
        await CommunityStarInDB.find(CommunityStarInDB.user_id == user_id).delete()
        for comment in await CommunityCommentInDB.find(
            CommunityCommentInDB.user_id == user_id
        ).to_list():
            await self.increment(comment.publication_id, "comments_count", -1)
        await CommunityCommentInDB.find(CommunityCommentInDB.user_id == user_id).delete()
        await CommunityReportInDB.find(CommunityReportInDB.reporter_id == user_id).delete()
        # Fork records name both people: drop the ones made by or credited to the user.
        await CommunityForkInDB.find(
            {"$or": [{"user_id": user_id}, {"publication_owner_id": user_id}]}
        ).delete()
