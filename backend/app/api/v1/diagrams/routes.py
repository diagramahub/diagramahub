"""
FastAPI routes for diagrams.
"""
import logging

from fastapi import APIRouter, Depends, status, HTTPException
from fastapi.responses import Response
from app.api.v1.users.routes import get_current_user_email
from app.api.v1.users.repository import UserRepository
from app.api.v1.projects.repository import ProjectRepository
from app.api.v1.ai_providers.repository import AIProviderRepository
from app.api.v1.subscriptions.usage_limiter import UsageLimiter
from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository
from app.api.v1.subscriptions.plan_repository import PlanRepository
from app.api.v1.shared_links.repository import SharedLinkRepository
from app.core.config import settings
from .repository import DiagramRepository
from .services import DiagramService
from .fix_service import (
    DiagramFixService,
    AIProviderRateLimitError,
    AIProviderTimeoutError,
    AIProviderAuthError,
    AIProviderInvalidResponseError
)
from .kroki_client import IKrokiClient, KrokiClient, KrokiRenderError, KrokiTimeoutError
from .schemas import (
    DiagramCreate,
    DiagramUpdate,
    DiagramResponse,
    FixDiagramRequest,
    FixDiagramResponse,
    RenderDiagramRequest,
    ConvertDiagramRequest,
    ConvertDiagramResponse,
)
from .conversion_service import DiagramConversionService

router = APIRouter()

# Dependency injection
def get_diagram_service() -> DiagramService:
    """Get diagram service instance."""
    return DiagramService(
        diagram_repository=DiagramRepository(),
        project_repository=ProjectRepository(),
        shared_link_repository=SharedLinkRepository(),
    )


def get_diagram_fix_service() -> DiagramFixService:
    """Get diagram fix service instance."""
    return DiagramFixService(
        diagram_repository=DiagramRepository(),
        ai_provider_repository=AIProviderRepository()
    )


def get_diagram_conversion_service() -> DiagramConversionService:
    """Get diagram conversion service instance."""
    return DiagramConversionService(
        ai_provider_repository=AIProviderRepository()
    )


def get_usage_limiter() -> UsageLimiter:
    """Get usage limiter instance."""
    return UsageLimiter(
        subscription_repository=SubscriptionRepository(),
        plan_repository=PlanRepository(),
        project_repository=ProjectRepository(),
        diagram_repository=DiagramRepository(),
        user_repository=UserRepository()
    )


async def get_current_user_id(current_user_email: str = Depends(get_current_user_email)) -> str:
    """Get current user ID from email."""
    user_repo = UserRepository()
    user = await user_repo.get_by_email(current_user_email)
    return str(user.id)


def get_kroki_client() -> KrokiClient:
    """Get a KrokiClient instance configured with the application settings."""
    return KrokiClient(base_url=settings.KROKI_URL)


logger = logging.getLogger(__name__)


def _parse_kroki_error(raw_detail: str, status_code: int) -> str:
    """
    Parse raw Kroki error into a user-friendly message.
    
    Extracts the meaningful error from the stack trace and provides
    actionable guidance to the user.
    """
    import re
    
    # Extract the core error message (before the stack trace)
    # Pattern: "Error 400: ErrorType: message\n    at ..."
    core_match = re.match(r'Error \d+:\s*(?:\w+:\s*)?(.*?)(?:\n\s+at\s|$)', raw_detail, re.DOTALL)
    core_message = core_match.group(1).strip() if core_match else raw_detail
    
    # Remove "Error 400: " prefix if present
    core_message = re.sub(r'^Error\s+\d+:\s*', '', core_message).strip()
    # Remove error class prefix like "SyntaxError: " or "Error: "
    error_class_match = re.match(r'^(\w+Error):\s*(.*)', core_message, re.DOTALL)
    error_class = error_class_match.group(1) if error_class_match else None
    if error_class_match:
        core_message = error_class_match.group(2).strip()
    
    # Truncate at first newline (stack trace)
    if '\n' in core_message:
        core_message = core_message.split('\n')[0].strip()
    
    # Provide user-friendly messages based on error patterns
    if 'does not exist' in core_message.lower():
        # e.g., "Table locations does not exist"
        return (
            f"⚠️ {core_message}. "
            "Verifica que todas las tablas referenciadas en Ref estén definidas en el diagrama."
        )
    
    if 'could not parse input' in core_message.lower():
        # Extract line info
        line_match = re.search(r'at line (\d+):(\d+)', core_message)
        if line_match:
            line_num = line_match.group(1)
            # Extract "Expected ... but ... found"
            expected_match = re.search(r'Expected (.+?) but (.+?) found', core_message)
            if expected_match:
                found = expected_match.group(2).strip('"').strip("'")
                if found == "end of input":
                    return (
                        f"⚠️ Error de sintaxis en línea {line_num}: el código está incompleto. "
                        "Verifica que todas las llaves {{ }} estén cerradas y que no falte contenido al final."
                    )
                return f"⚠️ Error de sintaxis en línea {line_num}: carácter inesperado \"{found}\". Revisa la sintaxis en esa línea."
            return f"⚠️ Error de sintaxis en línea {line_num}. Revisa la sintaxis del diagrama."
        return f"⚠️ Error de sintaxis en el diagrama. Revisa que la estructura sea correcta."
    
    if 'end of input' in core_message.lower():
        return "⚠️ El código del diagrama está incompleto. Verifica que todas las definiciones estén cerradas correctamente."
    
    # Default: return cleaned message
    if core_message:
        return f"⚠️ Error de renderizado: {core_message}"
    
    return f"Error de renderizado (código {status_code}). Verifica la sintaxis del diagrama."


# ============ Public Endpoints (no auth required) ============

@router.get("/diagrams/recent")
async def get_recent_diagrams(
    user_id: str = Depends(get_current_user_id),
    service: DiagramService = Depends(get_diagram_service),
):
    """Get the 4 most recently updated diagrams for the current user."""
    from .repository import DiagramRepository
    from ..projects.repository import ProjectRepository
    
    project_repo = ProjectRepository()
    diagram_repo = DiagramRepository()
    
    # Get all user projects
    projects = await project_repo.get_by_user_id(user_id)
    
    # Collect all diagrams across projects
    all_diagrams = []
    project_map = {}
    for p in projects:
        project_map[str(p.id)] = {"name": p.name, "emoji": p.emoji}
        diagrams = await diagram_repo.get_by_project_id(str(p.id))
        for d in diagrams:
            all_diagrams.append(d)
    
    # Sort by updated_at descending and take top 4
    all_diagrams.sort(key=lambda d: d.updated_at or d.created_at, reverse=True)
    recent = all_diagrams[:4]
    
    return [
        {
            "id": str(d.id),
            "title": d.title,
            "diagram_type": d.diagram_type,
            "project_id": d.project_id,
            "project_name": project_map.get(d.project_id, {}).get("name", ""),
            "project_emoji": project_map.get(d.project_id, {}).get("emoji", "📁"),
            "updated_at": (d.updated_at or d.created_at).isoformat(),
        }
        for d in recent
    ]


@router.post("/diagrams/render")
async def render_diagram(
    request: RenderDiagramRequest,
    kroki_client: IKrokiClient = Depends(get_kroki_client),
) -> Response:
    """
    Renderizar diagrama vía Kroki. Endpoint público (sin autenticación).

    Acepta código fuente y tipo de diagrama, delega al servicio Kroki,
    y retorna el SVG renderizado.
    """
    # Validate diagram_type against supported types
    if request.diagram_type not in KrokiClient.SUPPORTED_DIAGRAM_TYPES:
        supported = ", ".join(sorted(KrokiClient.SUPPORTED_DIAGRAM_TYPES))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Tipo de diagrama '{request.diagram_type}' no soportado. "
                f"Tipos soportados: {supported}"
            ),
        )

    try:
        svg = await kroki_client.render(
            diagram_type=request.diagram_type,
            source=request.source,
        )
        return Response(content=svg, media_type="image/svg+xml")

    except KrokiRenderError as exc:
        # Parse Kroki error to provide a user-friendly message
        user_message = _parse_kroki_error(exc.detail, exc.status_code)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST if exc.status_code == 400 else status.HTTP_502_BAD_GATEWAY,
            detail=user_message,
        )

    except KrokiTimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="El servicio de renderizado no respondió a tiempo",
        )


# ============ Diagram Endpoints (auth required) ============

@router.post("/projects/{project_id}/diagrams", response_model=DiagramResponse, status_code=status.HTTP_201_CREATED)
async def create_diagram(
    project_id: str,
    diagram_data: DiagramCreate,
    user_id: str = Depends(get_current_user_id),
    service: DiagramService = Depends(get_diagram_service),
    usage_limiter: UsageLimiter = Depends(get_usage_limiter)
):
    """Create a new diagram in a project."""
    # Validar límite de diagramas
    await usage_limiter.enforce_diagram_limit(user_id)
    
    return await service.create_diagram(diagram_data, project_id, user_id)


@router.get("/diagrams/{diagram_id}", response_model=DiagramResponse)
async def get_diagram(
    diagram_id: str,
    user_id: str = Depends(get_current_user_id),
    service: DiagramService = Depends(get_diagram_service)
):
    """Get a diagram by ID."""
    return await service.get_diagram(diagram_id, user_id)


@router.put("/diagrams/{diagram_id}", response_model=DiagramResponse)
async def update_diagram(
    diagram_id: str,
    diagram_data: DiagramUpdate,
    user_id: str = Depends(get_current_user_id),
    service: DiagramService = Depends(get_diagram_service)
):
    """Update a diagram."""
    return await service.update_diagram(diagram_id, diagram_data, user_id)


@router.delete("/diagrams/{diagram_id}")
async def delete_diagram(
    diagram_id: str,
    user_id: str = Depends(get_current_user_id),
    service: DiagramService = Depends(get_diagram_service)
):
    """Delete a diagram."""
    return await service.delete_diagram(diagram_id, user_id)


@router.post("/diagrams/{diagram_id}/fix", response_model=FixDiagramResponse)
async def fix_diagram(
    diagram_id: str,
    request: FixDiagramRequest,
    user_id: str = Depends(get_current_user_id),
    service: DiagramFixService = Depends(get_diagram_fix_service)
):
    """
    Corregir errores de sintaxis en un diagrama usando IA.
    
    Args:
        diagram_id: ID del diagrama a corregir
        request: Contexto del error y preferencias
        user_id: ID del usuario autenticado
        service: Servicio de corrección inyectado
        
    Returns:
        FixDiagramResponse con código corregido, diff y explicación
        
    Raises:
        HTTPException 401: Usuario no autenticado
        HTTPException 403: Usuario sin permisos
        HTTPException 404: Diagrama no encontrado
        HTTPException 408: Timeout de corrección
        HTTPException 422: Código corregido inválido
        HTTPException 429: Límite de tasa excedido
        HTTPException 500: Error interno del servidor
    """
    try:
        result = await service.fix_diagram(
            diagram_id=diagram_id,
            user_id=user_id,
            error_context=request.error_context,
            provider_name=request.provider,
            language=request.language
        )
        return result
        
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No tiene permisos para este diagrama: {str(e)}"
        )
    
    except ValueError as e:
        error_msg = str(e)
        
        # Diagrama no encontrado
        if "no encontrado" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg
            )
        
        # Código corregido inválido
        if "no pasó validación" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=error_msg
            )
        
        # Otros errores de validación
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    except AIProviderRateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Servicio de IA temporalmente no disponible: {str(e)}"
        )
    
    except (AIProviderTimeoutError, TimeoutError) as e:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail=f"La corrección excedió el tiempo límite: {str(e)}"
        )
    
    except AIProviderAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error de autenticación con proveedor de IA: {str(e)}"
        )
    
    except AIProviderInvalidResponseError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Respuesta inválida del proveedor de IA: {str(e)}"
        )
    
    except Exception as e:
        # Log error interno
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Unexpected error in fix_diagram endpoint: {str(e)}", exc_info=True)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno del servidor: {str(e)}"
        )


# ============ Diagram Conversion Endpoint (auth required) ============

@router.post("/diagrams/convert", response_model=ConvertDiagramResponse)
async def convert_diagram(
    request: ConvertDiagramRequest,
    user_id: str = Depends(get_current_user_id),
    service: DiagramConversionService = Depends(get_diagram_conversion_service),
):
    """
    Convertir un diagrama de un tipo a otro usando IA.

    Retorna un preview del diagrama convertido. El usuario puede aceptar
    o rechazar la conversión antes de aplicar los cambios.

    Args:
        request: Datos de conversión (código fuente, tipo origen, tipo destino)
        user_id: ID del usuario autenticado
        service: Servicio de conversión inyectado

    Returns:
        ConvertDiagramResponse con código convertido para preview

    Raises:
        HTTPException 400: Tipos no válidos o iguales
        HTTPException 401: Usuario no autenticado
        HTTPException 404: Sin proveedor de IA configurado
        HTTPException 500: Error en la conversión
    """
    return await service.convert_diagram(user_id=user_id, request=request)
