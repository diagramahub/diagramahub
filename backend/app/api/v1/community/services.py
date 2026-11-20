"""
Business rules of the community portal.

- Only the owner of a diagram can publish it, once; text diagram types only.
- A publication always follows its diagram: title, code and description are
  re-read from it whenever publications are read (in bulk), whatever changed
  the diagram. If the diagram is deleted, its last version stays published.
- Hidden publications (moderation) are visible only to their owner and admins.
- A fork creates a diagram in one of the user's projects through the regular
  diagram service, so project ownership and plan limits apply.
- ``AUTO_HIDE_REPORTS`` open reports hide a publication or comment until an
  admin reviews it.
"""

from datetime import timedelta
from typing import Optional

from fastapi import HTTPException, status

from app.api.v1.diagrams.interfaces import IDiagramRepository
from app.api.v1.diagrams.schemas import DiagramCreate, MAX_DIAGRAM_CODE_LENGTH
from app.api.v1.diagrams.syntax_validator import SyntaxValidator
from app.api.v1.diagrams.services import DiagramService
from app.api.v1.projects.interfaces import IProjectRepository
from app.api.v1.subscriptions.usage_limiter import UsageLimiter
from app.api.v1.users.interfaces import IUserRepository
from app.core.clock import utcnow
from app.core.config import settings
from app.core.rate_limit import SlidingWindowRateLimiter

from .interfaces import ICommunityRepository
from .schemas import (
    AUTO_HIDE_REPORTS,
    COMMUNITY_LICENSE_LABEL,
    CommentRequest,
    CommentResponse,
    CommunityCommentInDB,
    CommunityForkInDB,
    CommunityImpact,
    CommunityReportInDB,
    ForkOrigin,
    ForkRequest,
    ForkResponse,
    ImpactHighlight,
    ModerationRequest,
    PublicationCard,
    PublicationDetail,
    PublicationPage,
    PublishedDiagramInDB,
    PublishedSource,
    PublishRequest,
    ReportRequest,
    ReportResponse,
    UpdatePublicationRequest,
)

PUBLISHABLE_TYPES = frozenset({"mermaid", "plantuml", "d2", "dbml"})
LIST_DESCRIPTION_LENGTH = 300

publish_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=3600)

# Lines that are comments or PlantUML's @start/@end markers say nothing about the diagram.
_COMMENT_PREFIXES = ("%%", "'", "//", "#")


def has_diagram_content(code: str, diagram_type: str) -> bool:
    """Whether the code draws something: Mermaid needs its type line plus one more."""
    lines = [
        line.strip()
        for line in code.splitlines()
        if line.strip()
        and not line.strip().startswith(_COMMENT_PREFIXES)
        and not line.strip().lower().startswith(("@start", "@end"))
    ]
    return len(lines) >= (2 if diagram_type == "mermaid" else 1)


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
        featured=p.featured,
        hidden=p.hidden,
        stars_count=max(p.stars_count, 0),
        forks_count=max(p.forks_count, 0),
        comments_count=max(p.comments_count, 0),
        allow_comments=p.allow_comments,
        starred_by_me=str(p.id) in starred,
        published_at=p.published_at,
        updated_at=p.updated_at,
    )


def fork_attribution(publication: PublishedDiagramInDB, url: str) -> str:
    """Attribution kept in a fork's description (the license requires it)."""
    return (
        f"Fork of “{publication.title}” by {publication.owner_name} "
        f"({COMMUNITY_LICENSE_LABEL}) — {url}"
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
        self, publication_id: str, user_id: Optional[str], is_admin: bool
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
        user_id: Optional[str],
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
        await self._sync(items)
        starred = (
            await self.repository.starred_ids(user_id, [str(p.id) for p in items])
            if user_id
            else set()
        )
        cards = [_card(p, starred) for p in items]
        for card in cards:  # the grid only shows a two-line excerpt
            card.description = card.description[:LIST_DESCRIPTION_LENGTH]
        return PublicationPage(items=cards, total=total, page=page, page_size=page_size)

    async def get_detail(
        self, publication_id: str, user_id: Optional[str], is_admin: bool
    ) -> PublicationDetail:
        """A publication's page (in sync with its diagram); counts the view.

        ``user_id`` is None for an anonymous visitor.
        """
        publication = await self._visible(publication_id, user_id, is_admin)
        is_owner = user_id is not None and publication.owner_id == user_id
        await self._sync([publication])

        if not is_owner:
            await self.repository.increment(publication_id, "views_count")
            publication.views_count += 1

        starred = await self.repository.starred_ids(user_id, [publication_id]) if user_id else set()
        others = [
            p
            for p in await self.repository.list_by_owner(publication.owner_id, 6)
            if str(p.id) != publication_id
        ][:5]
        await self._sync(others)
        more = [{"id": str(p.id), "title": p.title, "diagram_type": p.diagram_type} for p in others]
        card = _card(publication, starred)
        return PublicationDetail(
            **card.model_dump(),
            source_diagram_id=publication.source_diagram_id if is_owner else None,
            views_count=publication.views_count,
            is_owner=is_owner,
            more_from_owner=more,
            forked_from=await self._fork_origin(publication.source_diagram_id),
        )

    async def _fork_origin(self, diagram_id: str) -> Optional[ForkOrigin]:
        """Where a published diagram was forked from; the link only while the original is up."""
        fork = await self.repository.get_fork_by_diagram(diagram_id)
        if not fork:
            return None
        original = await self.repository.get_publication(fork.publication_id)
        return ForkOrigin(
            publication_id=fork.publication_id if original and not original.hidden else None,
            title=original.title if original else fork.publication_title,
            owner_name=original.owner_name if original else fork.publication_owner_name,
        )

    async def get_by_source_diagram(
        self, diagram_id: str, user_id: str
    ) -> Optional[PublicationCard]:
        """The user's publication of one of their diagrams, if any (for the editor)."""
        if not await self._owned_source(diagram_id, user_id):
            return None
        publication = await self.repository.get_by_source(diagram_id)
        if not publication:
            return None
        await self._sync([publication])
        return _card(publication, set())

    async def impact(self, user_id: str) -> CommunityImpact:
        """Stars, forks, views and comments the user's publications have received."""
        totals = await self.repository.owner_totals(user_id)
        publication_ids = [pid for _, pid, _ in await self.repository.published_sources(user_id)]
        recent_stars = await self.repository.count_stars_since(
            publication_ids, utcnow() - timedelta(days=30)
        )
        top_list = await self.repository.list_by_owner(user_id, 1)
        top = top_list[0] if top_list else None
        return CommunityImpact(
            **totals,
            stars_last_30_days=recent_stars,
            top=(
                ImpactHighlight(
                    id=str(top.id),
                    title=top.title,
                    diagram_type=top.diagram_type,
                    stars_count=top.stars_count,
                    forks_count=top.forks_count,
                    views_count=top.views_count,
                )
                if top
                else None
            ),
        )

    async def published_sources(self, user_id: str) -> list[PublishedSource]:
        """Which of the user's diagrams are published (no content, for list markers)."""
        return [
            PublishedSource(diagram_id=diagram_id, publication_id=publication_id, hidden=hidden)
            for diagram_id, publication_id, hidden in await self.repository.published_sources(
                user_id
            )
        ]

    async def _sync(self, publications: list[PublishedDiagramInDB]) -> None:
        """Bring publications in line with their diagrams (one lookup for all).

        Only the mirrored fields are written, so counters changed meanwhile
        (stars, forks, views) are never overwritten.
        """
        if not publications:
            return
        sources = {
            str(d.id): d
            for d in await self.diagram_repository.get_by_ids(
                [p.source_diagram_id for p in publications]
            )
        }
        for publication in publications:
            source = sources.get(publication.source_diagram_id)
            if not source:
                continue  # deleted: its last version stays published
            mirrored = {
                "title": source.title,
                "content": source.content,
                "description": source.description or "",
                "diagram_type": source.diagram_type,
            }
            if all(getattr(publication, k) == v for k, v in mirrored.items()):
                continue
            mirrored["updated_at"] = source.updated_at or utcnow()
            for field, value in mirrored.items():
                setattr(publication, field, value)
            await self.repository.set_fields(str(publication.id), mirrored)

    # ------------------------------------------------------------------ #
    #  Publish / update / unpublish
    # ------------------------------------------------------------------ #

    async def _check_publishable(self, diagram_type: str, content: str) -> None:
        """What a diagram needs to be published: it draws something, within the size cap.

        Published diagrams don't count toward the plan's limit, so empty or huge
        placeholders would turn the Community into free storage.
        """
        code = (content or "").strip()
        if len(code) > MAX_DIAGRAM_CODE_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={"error": "diagram_too_large", "limit": MAX_DIAGRAM_CODE_LENGTH},
            )
        if not has_diagram_content(code, diagram_type):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={"error": "diagram_empty"},
            )
        # Mermaid is drawn in the browser, so only its structure can be checked here; the
        # others go through the real renderer (and pass when it can't be reached).
        result = (
            await SyntaxValidator.validate_mermaid(code)
            if diagram_type == "mermaid"
            else await SyntaxValidator.kroki_verdict(diagram_type, code)
        )
        if not result.is_valid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={"error": "diagram_invalid", "message": result.error_message},
            )

    async def _enforce_daily_publications(self, user_id: str) -> None:
        limit = settings.COMMUNITY_MAX_PUBLICATIONS_PER_DAY
        if limit <= 0:
            return
        since = utcnow() - timedelta(days=1)
        if await self.repository.count_published_since(user_id, since) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"error": "publish_daily_limit", "limit": limit},
            )

    async def publish(
        self, user_id: str, request: PublishRequest, is_admin: bool = False
    ) -> PublicationDetail:
        """Publish one of the user's diagrams; it stays in sync with the diagram.

        A published (and visible) diagram doesn't count toward the plan's
        diagram limit, unless the plan says so.

        Raises:
            HTTPException 404: The diagram doesn't exist or isn't the user's
            HTTPException 409: The diagram is already published
            HTTPException 422: Sketches, empty, unrenderable or too large code
            HTTPException 429: Too many publications in the last 24 hours
            ResourceLimitError: The plan's max_public_diagrams is reached
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
        await self._check_publishable(source.diagram_type, source.content)
        if not is_admin:
            await self._enforce_daily_publications(user_id)
        await self.usage_limiter.enforce_public_limit(user_id)
        publication = await self.repository.create_publication(
            PublishedDiagramInDB(
                source_diagram_id=request.diagram_id,
                owner_id=user_id,
                owner_name=await self._display_name(user_id),
                title=source.title,
                description=source.description or "",
                diagram_type=source.diagram_type,
                content=source.content,
                category=request.category,
                tags=request.tags,
                allow_comments=request.allow_comments,
            )
        )
        return await self.get_detail(str(publication.id), user_id, False)

    async def update(
        self, publication_id: str, user_id: str, request: UpdatePublicationRequest
    ) -> PublicationDetail:
        """Change the settings (owner): category, tags, comments."""
        publication = await self._owned(publication_id, user_id)
        changes = request.model_dump(mode="json", exclude_unset=True, exclude_none=True)
        if changes:
            for field, value in changes.items():
                setattr(publication, field, value)
            await self.repository.set_fields(publication_id, changes)
        return await self.get_detail(publication_id, user_id, False)

    async def unpublish(
        self, publication_id: str, user_id: str, is_admin: bool
    ) -> PublishedDiagramInDB:
        """Remove a publication (owner or admin). Existing forks are untouched.

        Unpublishing makes the diagram private again, so the owner needs room for
        it in their plan (a hidden publication already counts as private). An
        admin removing someone else's publication may leave them over the limit:
        they keep their diagrams, but can't add private ones until back under it.

        Raises:
            ResourceLimitError: The owner has no room for one more private diagram.
        """
        publication = await self._owned(publication_id, user_id, is_admin)
        if (
            publication.owner_id == user_id
            and not publication.hidden
            and await self.diagram_repository.get_by_id(publication.source_diagram_id)
        ):
            await self.usage_limiter.enforce_can_make_private(user_id)
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
            HTTPException 403/404: The project isn't the user's (diagram service)
            HTTPException 403: Plan limit reached (usage limiter)
        """
        publication = await self._visible(publication_id, user_id, is_admin)
        await self.usage_limiter.enforce_diagram_limit(user_id)
        # Copy the diagram as it is now, not as the last page view left it.
        await self._sync([publication])
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
        await self.repository.add_fork(
            CommunityForkInDB(
                publication_id=publication_id,
                publication_title=publication.title,
                publication_owner_id=publication.owner_id,
                publication_owner_name=publication.owner_name,
                user_id=user_id,
                diagram_id=created.id,
            )
        )
        await self.repository.increment(publication_id, "forks_count")
        return ForkResponse(
            diagram_id=created.id, project_id=request.project_id, title=created.title
        )

    # ------------------------------------------------------------------ #
    #  Comments
    # ------------------------------------------------------------------ #

    async def list_comments(
        self, publication_id: str, user_id: Optional[str], is_admin: bool
    ) -> list[CommentResponse]:
        publication = await self._visible(publication_id, user_id, is_admin)
        is_owner = user_id is not None and publication.owner_id == user_id
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
                await self.repository.set_fields(
                    publication_id, {"hidden": True, "reports_count": open_reports}
                )
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
        changes = request.model_dump(exclude_none=True)
        if request.hidden is False:
            await self.repository.resolve_reports("diagram", publication_id)
            changes["reports_count"] = 0
        await self.repository.set_fields(publication_id, changes)
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
