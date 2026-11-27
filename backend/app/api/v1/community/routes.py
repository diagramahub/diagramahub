"""
Routes for the community portal.

Browsing, a publication's page and its comments are public when
``settings.COMMUNITY_PUBLIC`` is on (the default): anonymous visitors can read
them. Everything that saves (publish, star, fork, comment, report) and the
personal tabs need a signed-in user; admin routes also need the admin role.
"""

from dataclasses import dataclass
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.api.deps import get_current_user, get_optional_user_email
from app.api.v1.diagram_files.repository import DiagramFileRepository
from app.api.v1.diagram_files.routes import file_response
from app.api.v1.diagrams.repository import DiagramRepository
from app.api.v1.diagrams.routes import get_diagram_service, get_usage_limiter
from app.api.v1.projects.repository import ProjectRepository
from app.api.v1.users import audit_log
from app.api.v1.users.repository import UserRepository
from app.api.v1.users.schemas import UserRole
from app.core.config import settings

from .repository import CommunityRepository
from .schemas import (
    CommentRequest,
    CommentResponse,
    CommunityCategory,
    CommunityImpact,
    ForkRequest,
    ForkResponse,
    ModerationRequest,
    PublicationCard,
    PublicationDetail,
    PublicationPage,
    PublishedSource,
    PublishRequest,
    ReportRequest,
    ReportResponse,
    UpdatePublicationRequest,
)
from .services import CommunityService

router = APIRouter(prefix="/community", tags=["Community"])


@dataclass(frozen=True)
class Member:
    """The signed-in user, as the community routes need it."""

    user_id: str
    is_admin: bool


async def get_member(user=Depends(get_current_user)) -> Member:
    """Resolve the signed-in user (401 when the account no longer exists)."""
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return Member(user_id=str(user.id), is_admin=user.role == UserRole.ADMIN)


async def get_viewer(email: Optional[str] = Depends(get_optional_user_email)) -> Optional[Member]:
    """The signed-in user, or None for an anonymous visitor of a public community.

    Raises:
        HTTPException 401: Anonymous while the community isn't public, or the account is gone
    """
    if email is None:
        if not settings.COMMUNITY_PUBLIC:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return None
    user = await UserRepository().get_by_email(email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return Member(user_id=str(user.id), is_admin=user.role == UserRole.ADMIN)


async def get_admin(member: Member = Depends(get_member)) -> Member:
    """Require the admin role."""
    if not member.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return member


def get_community_service() -> CommunityService:
    """Dependency injection for the community service."""
    return CommunityService(
        repository=CommunityRepository(),
        diagram_repository=DiagramRepository(),
        project_repository=ProjectRepository(),
        user_repository=UserRepository(),
        diagram_service=get_diagram_service(),
        usage_limiter=get_usage_limiter(),
        frontend_url=settings.FRONTEND_URL,
        diagram_file_repository=DiagramFileRepository(),
    )


# ------------------------------------------------------------------ #
#  Browse
# ------------------------------------------------------------------ #


@router.get("/diagrams", response_model=PublicationPage)
async def list_publications(
    tab: Literal["explore", "featured", "starred", "mine"] = "explore",
    q: Optional[str] = Query(None, max_length=100),
    category: Optional[CommunityCategory] = None,
    diagram_type: Optional[Literal["mermaid", "plantuml", "d2", "dbml"]] = Query(
        None, alias="type"
    ),
    sort: Literal["trending", "stars", "forks", "recent"] = "trending",
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=60),
    viewer: Optional[Member] = Depends(get_viewer),
    service: CommunityService = Depends(get_community_service),
) -> PublicationPage:
    """Browse published diagrams (public; the starred and mine tabs need sign-in)."""
    if viewer is None and tab in ("starred", "mine"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to see this tab"
        )
    return await service.list_publications(
        viewer.user_id if viewer else None,
        viewer.is_admin if viewer else False,
        tab=tab,
        text=q,
        category=category.value if category else None,
        diagram_type=diagram_type,
        sort=sort,
        page=page,
        page_size=page_size,
    )


@router.get("/diagrams/{publication_id}", response_model=PublicationDetail)
async def get_publication(
    publication_id: str,
    viewer: Optional[Member] = Depends(get_viewer),
    service: CommunityService = Depends(get_community_service),
) -> PublicationDetail:
    """A publication's page (public; counts a view)."""
    return await service.get_detail(
        publication_id, viewer.user_id if viewer else None, viewer.is_admin if viewer else False
    )


@router.get(
    "/{publication_id}/files/{file_id}",
    response_class=Response,
    responses={200: {"content": {"image/*": {}}, "description": "The image bytes"}},
)
async def get_publication_file(
    publication_id: str,
    file_id: str,
    viewer: Optional[Member] = Depends(get_viewer),
    service: CommunityService = Depends(get_community_service),
) -> Response:
    """An image of a published freehand diagram (seen by whoever can see the publication)."""
    file, visible_to_all = await service.get_file(
        publication_id,
        file_id,
        viewer.user_id if viewer else None,
        viewer.is_admin if viewer else False,
    )
    cache = (
        "public, max-age=86400"
        if visible_to_all and settings.COMMUNITY_PUBLIC
        else "private, max-age=3600"
    )
    return file_response(file, cache)


@router.get("/my-published", response_model=list[PublishedSource])
async def my_published_diagrams(
    member: Member = Depends(get_member),
    service: CommunityService = Depends(get_community_service),
) -> list[PublishedSource]:
    """The user's published diagrams (ids only), to mark them as public in their lists."""
    return await service.published_sources(member.user_id)


@router.get("/me/impact", response_model=CommunityImpact)
async def my_impact(
    member: Member = Depends(get_member),
    service: CommunityService = Depends(get_community_service),
) -> CommunityImpact:
    """What the user's publications have received: stars, forks, views, comments."""
    return await service.impact(member.user_id)


@router.get("/by-diagram/{diagram_id}", response_model=Optional[PublicationCard])
async def get_publication_of_diagram(
    diagram_id: str,
    member: Member = Depends(get_member),
    service: CommunityService = Depends(get_community_service),
) -> Optional[PublicationCard]:
    """The user's publication of one of their diagrams, or null."""
    return await service.get_by_source_diagram(diagram_id, member.user_id)


# ------------------------------------------------------------------ #
#  Publish / update / unpublish
# ------------------------------------------------------------------ #


@router.post("/diagrams", response_model=PublicationDetail, status_code=status.HTTP_201_CREATED)
async def publish(
    request: PublishRequest,
    http_request: Request,
    member: Member = Depends(get_member),
    service: CommunityService = Depends(get_community_service),
) -> PublicationDetail:
    """Publish one of the user's diagrams."""
    publication = await service.publish(member.user_id, request, member.is_admin)
    await audit_log.log_event_for_user_id(
        audit_log.EVENT_COMMUNITY_PUBLISHED,
        member.user_id,
        http_request,
        details=f"publication={publication.id} diagram={request.diagram_id} license={publication.license}",
    )
    return publication


@router.put("/diagrams/{publication_id}", response_model=PublicationDetail)
async def update_publication(
    publication_id: str,
    request: UpdatePublicationRequest,
    member: Member = Depends(get_member),
    service: CommunityService = Depends(get_community_service),
) -> PublicationDetail:
    """Change a publication's metadata or refresh its code (owner)."""
    return await service.update(publication_id, member.user_id, request)


@router.delete("/diagrams/{publication_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unpublish(
    publication_id: str,
    http_request: Request,
    member: Member = Depends(get_member),
    service: CommunityService = Depends(get_community_service),
) -> Response:
    """Remove a publication (owner or admin). Forks already made stay."""
    publication = await service.unpublish(publication_id, member.user_id, member.is_admin)
    await audit_log.log_event_for_user_id(
        audit_log.EVENT_COMMUNITY_UNPUBLISHED,
        member.user_id,
        http_request,
        details=f"publication={publication_id} owner={publication.owner_id}",
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------ #
#  Stars and forks
# ------------------------------------------------------------------ #


@router.put("/diagrams/{publication_id}/star")
async def star(
    publication_id: str,
    member: Member = Depends(get_member),
    service: CommunityService = Depends(get_community_service),
) -> dict:
    """Star a publication (idempotent)."""
    count = await service.set_star(publication_id, member.user_id, member.is_admin, True)
    return {"starred": True, "stars_count": count}


@router.delete("/diagrams/{publication_id}/star")
async def unstar(
    publication_id: str,
    member: Member = Depends(get_member),
    service: CommunityService = Depends(get_community_service),
) -> dict:
    """Remove the user's star (idempotent)."""
    count = await service.set_star(publication_id, member.user_id, member.is_admin, False)
    return {"starred": False, "stars_count": count}


@router.post(
    "/diagrams/{publication_id}/fork",
    response_model=ForkResponse,
    status_code=status.HTTP_201_CREATED,
)
async def fork(
    publication_id: str,
    request: ForkRequest,
    member: Member = Depends(get_member),
    service: CommunityService = Depends(get_community_service),
) -> ForkResponse:
    """Copy a publication into one of the user's projects."""
    return await service.fork(publication_id, member.user_id, member.is_admin, request)


# ------------------------------------------------------------------ #
#  Comments
# ------------------------------------------------------------------ #


@router.get("/diagrams/{publication_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    publication_id: str,
    viewer: Optional[Member] = Depends(get_viewer),
    service: CommunityService = Depends(get_community_service),
) -> list[CommentResponse]:
    """A publication's visible comments, oldest first (public)."""
    return await service.list_comments(
        publication_id, viewer.user_id if viewer else None, viewer.is_admin if viewer else False
    )


@router.post(
    "/diagrams/{publication_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_comment(
    publication_id: str,
    request: CommentRequest,
    member: Member = Depends(get_member),
    service: CommunityService = Depends(get_community_service),
) -> CommentResponse:
    """Comment on (or reply in) a publication."""
    return await service.add_comment(publication_id, member.user_id, member.is_admin, request)


@router.delete(
    "/diagrams/{publication_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_comment(
    publication_id: str,
    comment_id: str,
    member: Member = Depends(get_member),
    service: CommunityService = Depends(get_community_service),
) -> Response:
    """Delete a comment (its author, the publication's owner or an admin)."""
    await service.delete_comment(publication_id, comment_id, member.user_id, member.is_admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------ #
#  Reports and moderation
# ------------------------------------------------------------------ #


@router.post("/reports", status_code=status.HTTP_204_NO_CONTENT)
async def report(
    request: ReportRequest,
    member: Member = Depends(get_member),
    service: CommunityService = Depends(get_community_service),
) -> Response:
    """Report a publication or a comment."""
    await service.report(member.user_id, member.is_admin, request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/admin/reports", response_model=list[ReportResponse])
async def open_reports(
    admin: Member = Depends(get_admin),
    service: CommunityService = Depends(get_community_service),
) -> list[ReportResponse]:
    """Open reports (admin)."""
    return await service.open_reports()


@router.put("/admin/diagrams/{publication_id}", response_model=PublicationDetail)
async def moderate_publication(
    publication_id: str,
    request: ModerationRequest,
    http_request: Request,
    admin: Member = Depends(get_admin),
    service: CommunityService = Depends(get_community_service),
) -> PublicationDetail:
    """Feature or hide/restore a publication (admin)."""
    result = await service.moderate_publication(publication_id, request)
    changed = ",".join(f"{k}={v}" for k, v in request.model_dump(exclude_none=True).items())
    await audit_log.log_event_for_user_id(
        audit_log.EVENT_COMMUNITY_MODERATED,
        admin.user_id,
        http_request,
        details=f"publication={publication_id} {changed or '-'}",
    )
    return result


@router.put("/admin/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def moderate_comment(
    comment_id: str,
    request: ModerationRequest,
    http_request: Request,
    admin: Member = Depends(get_admin),
    service: CommunityService = Depends(get_community_service),
) -> Response:
    """Hide or restore a comment (admin)."""
    if request.hidden is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="hidden is required"
        )
    await service.moderate_comment(comment_id, request.hidden)
    await audit_log.log_event_for_user_id(
        audit_log.EVENT_COMMUNITY_MODERATED,
        admin.user_id,
        http_request,
        details=f"comment={comment_id} hidden={request.hidden}",
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/admin/reports/dismiss", status_code=status.HTTP_204_NO_CONTENT)
async def dismiss_reports(
    request: ReportRequest,
    admin: Member = Depends(get_admin),
    service: CommunityService = Depends(get_community_service),
) -> Response:
    """Close the open reports on a target without changing it (admin)."""
    await service.dismiss_reports(request.target_type, request.target_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
