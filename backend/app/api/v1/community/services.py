"""
Business rules of the community portal.

- Only the owner of a diagram can publish it, once; text diagram types only.
- A publication is a snapshot: it changes when the owner refreshes it or, with
  ``auto_update``, when its page is opened after the source diagram changed.
- Hidden publications (moderation) are visible only to their owner and admins.
- A fork creates a diagram in one of the user's projects through the regular
  diagram service, so project ownership and plan limits apply.
- ``AUTO_HIDE_REPORTS`` open reports hide a publication or comment until an
  admin reviews it.
"""

from typing import Optional

from fastapi import HTTPException, status

from app.api.v1.diagrams.interfaces import IDiagramRepository
from app.api.v1.diagrams.schemas import DiagramCreate
from app.api.v1.diagrams.services import DiagramService
from app.api.v1.projects.interfaces import IProjectRepository
from app.api.v1.subscriptions.usage_limiter import UsageLimiter
from app.api.v1.users.interfaces import IUserRepository
from app.core.clock import utcnow
from app.core.rate_limit import SlidingWindowRateLimiter

from .interfaces import ICommunityRepository
from .schemas import (
    AUTO_HIDE_REPORTS,
    CommentRequest,
    CommentResponse,
    CommunityCommentInDB,
    CommunityLicense,
    CommunityReportInDB,
    ForkRequest,
    ForkResponse,
    ModerationRequest,
    PublicationCard,
    PublicationDetail,
    PublicationPage,
    PublishedDiagramInDB,
    PublishRequest,
    ReportRequest,
    ReportResponse,
    UpdatePublicationRequest,
)

PUBLISHABLE_TYPES = frozenset({"mermaid", "plantuml", "d2", "dbml"})
LICENSE_LABELS = {
    CommunityLicense.CC_BY: "CC BY 4.0",
    CommunityLicense.CC0: "CC0 1.0",
    CommunityLicense.CC_BY_SA: "CC BY-SA 4.0",
    CommunityLicense.ALL_RIGHTS_RESERVED: "All rights reserved",
}

publish_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=3600)
comment_limiter = SlidingWindowRateLimiter(max_requests=20, window_seconds=600)
report_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=3600)


def _enforce(limiter: SlidingWindowRateLimiter, user_id: str) -> None:
    allowed, retry_after = limiter.is_allowed(user_id)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests, try again later",
            headers={"Retry-After": str(retry_after)},
        )


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Publication not found")


def _card(p: PublishedDiagramInDB, starred: set[str]) -> PublicationCard:
    return PublicationCard(
        id=str(p.id),
        title=p.title,
        description=p.description,
        diagram_type=p.diagram_type,
        content=p.content,
        category=p.category,
        tags=p.tags,
        owner_id=p.owner_id,
        owner_name=p.owner_name,
        license=p.license,
        featured=p.featured,
        hidden=p.hidden,
        stars_count=max(p.stars_count, 0),
        forks_count=max(p.forks_count, 0),
        comments_count=max(p.comments_count, 0),
        starred_by_me=str(p.id) in starred,
        published_at=p.published_at,
        updated_at=p.updated_at,
    )


def fork_attribution(publication: PublishedDiagramInDB, url: str) -> str:
    """Attribution kept in a fork's description (CC licenses require it)."""
    return (
        f"Fork of “{publication.title}” by {publication.owner_name} "
        f"({LICENSE_LABELS[publication.license]}) — {url}"
    )


class CommunityService:
    """Publish, browse, star, fork, comment on and moderate community diagrams."""

    def __init__(
        self,
        repository: ICommunityRepository,
        diagram_repository: IDiagramRepository,
        project_repository: IProjectRepository,
        user_repository: IUserRepository,
        diagram_service: DiagramService,
        usage_limiter: UsageLimiter,
        frontend_url: str = "",
    ):
        self.repository = repository
        self.diagram_repository = diagram_repository
        self.project_repository = project_repository
        self.user_repository = user_repository
        self.diagram_service = diagram_service
        self.usage_limiter = usage_limiter
        self.frontend_url = frontend_url.rstrip("/")

    # ------------------------------------------------------------------ #
    #  Helpers
    # ------------------------------------------------------------------ #

    async def _display_name(self, user_id: str) -> str:
        user = await self.user_repository.get_by_id(user_id)
        if not user:
            return "?"
        # Never expose the email address: its local part at most.
        return (user.full_name or "").strip() or user.email.split("@")[0]

    async def _owned_source(self, diagram_id: str, user_id: str):
        diagram = await self.diagram_repository.get_by_id(diagram_id)
        if not diagram:
            return None
        project = await self.project_repository.get_by_id(diagram.project_id)
        return diagram if project and project.user_id == user_id else None

    async def _visible(
        self, publication_id: str, user_id: str, is_admin: bool
    ) -> PublishedDiagramInDB:
        publication = await self.repository.get_publication(publication_id)
        if not publication or (
            publication.hidden and not is_admin and publication.owner_id != user_id
        ):
            raise _not_found()
        return publication

    async def _owned(
        self, publication_id: str, user_id: str, is_admin: bool = False
    ) -> PublishedDiagramInDB:
        publication = await self.repository.get_publication(publication_id)
        if not publication or (publication.owner_id != user_id and not is_admin):
            raise _not_found()
        return publication

    def publication_url(self, publication_id: str) -> str:
        return f"{self.frontend_url}/community/{publication_id}"

    # ------------------------------------------------------------------ #
    #  Browse
    # ------------------------------------------------------------------ #

    async def list_publications(
        self,
        user_id: str,
        is_admin: bool,
        *,
        tab: str = "explore",
        text: Optional[str] = None,
        category: Optional[str] = None,
        diagram_type: Optional[str] = None,
        sort: str = "trending",
        page: int = 1,
        page_size: int = 24,
    ) -> PublicationPage:
        """A page of publications for a tab (explore, featured, starred, mine)."""
        only_ids = None
        if tab == "starred":
            only_ids = sorted(await self.repository.starred_ids(user_id))
        items, total = await self.repository.search_publications(
            text=(text or "").strip() or None,
            category=category,
            diagram_type=diagram_type,
            only_ids=only_ids,
            owner_id=user_id if tab == "mine" else None,
            featured=tab == "featured",
            include_hidden=is_admin or tab == "mine",
            sort=sort,
            skip=(page - 1) * page_size,
            limit=page_size,
        )
        starred = await self.repository.starred_ids(user_id, [str(p.id) for p in items])
        return PublicationPage(
            items=[_card(p, starred) for p in items], total=total, page=page, page_size=page_size
        )

    async def get_detail(
        self, publication_id: str, user_id: str, is_admin: bool
    ) -> PublicationDetail:
        """A publication's page; refreshes an auto-updating snapshot and counts the view."""
        publication = await self._visible(publication_id, user_id, is_admin)
        is_owner = publication.owner_id == user_id

        if publication.auto_update:
            source = await self._owned_source(publication.source_diagram_id, publication.owner_id)
            source_changed = (
                source and (source.updated_at or source.created_at) > publication.updated_at
            )
            if source and source_changed:
                publication.content = source.content
                publication.title = source.title
                publication.updated_at = utcnow()
                await self.repository.save_publication(publication)

        if not is_owner:
            await self.repository.increment(publication_id, "views_count")
            publication.views_count += 1

        starred = await self.repository.starred_ids(user_id, [publication_id])
        more = [
            {"id": str(p.id), "title": p.title, "diagram_type": p.diagram_type}
            for p in await self.repository.list_by_owner(publication.owner_id, 6)
            if str(p.id) != publication_id
        ][:5]
        card = _card(publication, starred)
        return PublicationDetail(
            **card.model_dump(),
            source_diagram_id=publication.source_diagram_id if is_owner else None,
            views_count=publication.views_count,
            allow_forks=publication.allow_forks,
            allow_comments=publication.allow_comments,
            auto_update=publication.auto_update,
            is_owner=is_owner,
            more_from_owner=more,
        )

    async def get_by_source_diagram(
        self, diagram_id: str, user_id: str
    ) -> Optional[PublicationCard]:
        """The user's publication of one of their diagrams, if any (for the editor)."""
        if not await self._owned_source(diagram_id, user_id):
            return None
        publication = await self.repository.get_by_source(diagram_id)
        return _card(publication, set()) if publication else None

    # ------------------------------------------------------------------ #
    #  Publish / update / unpublish
    # ------------------------------------------------------------------ #

    async def publish(self, user_id: str, request: PublishRequest) -> PublicationDetail:
        """Publish one of the user's diagrams (snapshot of its current code).

        Raises:
            HTTPException 404: The diagram doesn't exist or isn't the user's
            HTTPException 409: The diagram is already published
            HTTPException 422: The diagram type can't be published (sketches)
        """
        _enforce(publish_limiter, user_id)
        source = await self._owned_source(request.diagram_id, user_id)
        if not source:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagram not found")
        if source.diagram_type not in PUBLISHABLE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={"error": "type_not_publishable"},
            )
        if await self.repository.get_by_source(request.diagram_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail={"error": "already_published"}
            )
        publication = await self.repository.create_publication(
            PublishedDiagramInDB(
                source_diagram_id=request.diagram_id,
                owner_id=user_id,
                owner_name=await self._display_name(user_id),
                title=source.title,
                description=(
                    request.description
                    if request.description is not None
                    else (source.description or "")
                )[:5000],
                diagram_type=source.diagram_type,
                content=source.content,
                category=request.category,
                tags=request.tags,
                license=request.license,
                allow_forks=request.allow_forks
                and request.license != CommunityLicense.ALL_RIGHTS_RESERVED,
                allow_comments=request.allow_comments,
                auto_update=request.auto_update,
            )
        )
        return await self.get_detail(str(publication.id), user_id, False)

    async def update(
        self, publication_id: str, user_id: str, request: UpdatePublicationRequest
    ) -> PublicationDetail:
        """Change metadata (owner); ``refresh_content`` re-snapshots the source diagram."""
        publication = await self._owned(publication_id, user_id)
        changes = request.model_dump(exclude_unset=True, exclude={"refresh_content"})
        for field, value in changes.items():
            setattr(publication, field, value)
        if publication.license == CommunityLicense.ALL_RIGHTS_RESERVED:
            publication.allow_forks = False
        if request.refresh_content:
            source = await self._owned_source(publication.source_diagram_id, user_id)
            if not source:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, detail={"error": "source_deleted"}
                )
            publication.content = source.content
            publication.title = source.title
        publication.updated_at = utcnow()
        await self.repository.save_publication(publication)
        return await self.get_detail(publication_id, user_id, False)

    async def unpublish(
        self, publication_id: str, user_id: str, is_admin: bool
    ) -> PublishedDiagramInDB:
        """Remove a publication (owner or admin). Existing forks are untouched."""
        publication = await self._owned(publication_id, user_id, is_admin)
        await self.repository.delete_publication(publication_id)
        return publication

    # ------------------------------------------------------------------ #
    #  Stars and forks
    # ------------------------------------------------------------------ #

    async def set_star(
        self, publication_id: str, user_id: str, is_admin: bool, starred: bool
    ) -> int:
        """Star or unstar; returns the new star count."""
        publication = await self._visible(publication_id, user_id, is_admin)
        if starred:
            changed = await self.repository.add_star(publication_id, user_id)
        else:
            changed = await self.repository.remove_star(publication_id, user_id)
        if changed:
            await self.repository.increment(publication_id, "stars_count", 1 if starred else -1)
        return max(publication.stars_count + ((1 if starred else -1) if changed else 0), 0)

    async def fork(
        self, publication_id: str, user_id: str, is_admin: bool, request: ForkRequest
    ) -> ForkResponse:
        """Copy a publication into one of the user's projects (counts for the plan).

        Raises:
            HTTPException 403: Forks are off for this publication
            HTTPException 403/404: The project isn't the user's (diagram service)
            HTTPException 403: Plan limit reached (usage limiter)
        """
        publication = await self._visible(publication_id, user_id, is_admin)
        if (
            not publication.allow_forks
            or publication.license == CommunityLicense.ALL_RIGHTS_RESERVED
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail={"error": "forks_disabled"}
            )
        await self.usage_limiter.enforce_diagram_limit(user_id)
        attribution = fork_attribution(publication, self.publication_url(publication_id))
        description = f"{publication.description}\n\n---\n{attribution}".strip()
        created = await self.diagram_service.create_diagram(
            DiagramCreate(
                title=(request.title or publication.title)[:100],
                content=publication.content,
                description=description[:50000],
                diagram_type=publication.diagram_type,
                folder_id=request.folder_id,
            ),
            request.project_id,
            user_id,
        )
        await self.repository.increment(publication_id, "forks_count")
        return ForkResponse(
            diagram_id=created.id, project_id=request.project_id, title=created.title
        )

    # ------------------------------------------------------------------ #
    #  Comments
    # ------------------------------------------------------------------ #

    async def list_comments(
        self, publication_id: str, user_id: str, is_admin: bool
    ) -> list[CommentResponse]:
        publication = await self._visible(publication_id, user_id, is_admin)
        is_owner = publication.owner_id == user_id
        return [
            CommentResponse(
                id=str(c.id),
                user_id=c.user_id,
                author_name=c.author_name,
                text=c.text,
                parent_id=c.parent_id,
                is_publication_owner=c.user_id == publication.owner_id,
                can_delete=is_admin or is_owner or c.user_id == user_id,
                created_at=c.created_at,
            )
            for c in await self.repository.list_comments(publication_id)
        ]

    async def add_comment(
        self, publication_id: str, user_id: str, is_admin: bool, request: CommentRequest
    ) -> CommentResponse:
        """Comment or reply (one level) on a publication that allows comments."""
        publication = await self._visible(publication_id, user_id, is_admin)
        if not publication.allow_comments:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail={"error": "comments_disabled"}
            )
        _enforce(comment_limiter, user_id)
        parent_id = None
        if request.parent_id:
            parent = await self.repository.get_comment(request.parent_id)
            if not parent or parent.publication_id != publication_id or parent.hidden:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
                )
            parent_id = parent.parent_id or str(parent.id)  # replies stay one level deep
        comment = await self.repository.add_comment(
            CommunityCommentInDB(
                publication_id=publication_id,
                user_id=user_id,
                author_name=await self._display_name(user_id),
                text=request.text.strip(),
                parent_id=parent_id,
            )
        )
        await self.repository.increment(publication_id, "comments_count")
        return CommentResponse(
            id=str(comment.id),
            user_id=user_id,
            author_name=comment.author_name,
            text=comment.text,
            parent_id=parent_id,
            is_publication_owner=user_id == publication.owner_id,
            can_delete=True,
            created_at=comment.created_at,
        )

    async def delete_comment(
        self, publication_id: str, comment_id: str, user_id: str, is_admin: bool
    ) -> None:
        """Delete a comment (its author, the publication's owner or an admin) and its replies."""
        publication = await self._visible(publication_id, user_id, is_admin)
        comment = await self.repository.get_comment(comment_id)
        if not comment or comment.publication_id != publication_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        if not (is_admin or comment.user_id == user_id or publication.owner_id == user_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
        deleted = await self.repository.delete_comment(comment_id)
        if deleted:
            await self.repository.increment(publication_id, "comments_count", -deleted)

    # ------------------------------------------------------------------ #
    #  Reports and moderation
    # ------------------------------------------------------------------ #

    async def report(self, user_id: str, is_admin: bool, request: ReportRequest) -> None:
        """Report a publication or comment; enough open reports hide it for review."""
        _enforce(report_limiter, user_id)
        if request.target_type == "diagram":
            publication = await self._visible(request.target_id, user_id, is_admin)
            publication_id = request.target_id
        else:
            comment = await self.repository.get_comment(request.target_id)
            if not comment or comment.hidden:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
                )
            publication = await self._visible(comment.publication_id, user_id, is_admin)
            publication_id = comment.publication_id
        added = await self.repository.add_report(
            CommunityReportInDB(
                target_type=request.target_type,
                target_id=request.target_id,
                publication_id=publication_id,
                reporter_id=user_id,
                reason=request.reason.strip(),
            )
        )
        if not added:
            return  # already reported by this user
        open_reports = await self.repository.count_open_reports(
            request.target_type, request.target_id
        )
        if request.target_type == "diagram":
            await self.repository.increment(publication_id, "reports_count")
            if open_reports >= AUTO_HIDE_REPORTS and not publication.hidden:
                publication.hidden = True
                publication.reports_count = open_reports
                await self.repository.save_publication(publication)
        elif open_reports >= AUTO_HIDE_REPORTS:
            await self.repository.set_comment_hidden(request.target_id, True)
            await self.repository.increment(publication_id, "comments_count", -1)

    async def open_reports(self) -> list[ReportResponse]:
        """Open reports, newest first (admin)."""
        reports = await self.repository.open_reports(100)
        titles: dict[str, str] = {}
        for r in reports:
            if r.publication_id not in titles:
                publication = await self.repository.get_publication(r.publication_id)
                titles[r.publication_id] = publication.title if publication else "—"
        return [
            ReportResponse(
                id=str(r.id),
                target_type=r.target_type,
                target_id=r.target_id,
                publication_id=r.publication_id,
                publication_title=titles[r.publication_id],
                reason=r.reason,
                created_at=r.created_at,
            )
            for r in reports
        ]

    async def moderate_publication(
        self, publication_id: str, request: ModerationRequest
    ) -> PublicationDetail:
        """Feature/unfeature or hide/restore a publication (admin). Restoring closes its reports."""
        publication = await self.repository.get_publication(publication_id)
        if not publication:
            raise _not_found()
        if request.featured is not None:
            publication.featured = request.featured
        if request.hidden is not None:
            publication.hidden = request.hidden
            if not request.hidden:
                await self.repository.resolve_reports("diagram", publication_id)
                publication.reports_count = 0
        await self.repository.save_publication(publication)
        return await self.get_detail(publication_id, publication.owner_id, True)

    async def moderate_comment(self, comment_id: str, hidden: bool) -> None:
        """Hide or restore a comment (admin). Restoring closes its reports."""
        comment = await self.repository.get_comment(comment_id)
        if not comment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        if comment.hidden != hidden:
            await self.repository.set_comment_hidden(comment_id, hidden)
            await self.repository.increment(
                comment.publication_id, "comments_count", -1 if hidden else 1
            )
        if not hidden:
            await self.repository.resolve_reports("comment", comment_id)

    async def dismiss_reports(self, target_type: str, target_id: str) -> None:
        """Close the reports on a target without changing it (admin)."""
        await self.repository.resolve_reports(target_type, target_id)
