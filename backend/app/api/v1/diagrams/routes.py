"""
FastAPI routes for diagrams.
"""
from fastapi import APIRouter, Depends, status, HTTPException
from app.api.v1.users.routes import get_current_user_email
from app.api.v1.users.repository import UserRepository
from app.api.v1.projects.repository import ProjectRepository
from app.api.v1.ai_providers.repository import AIProviderRepository
from .repository import DiagramRepository
from .services import DiagramService
from .fix_service import (
    DiagramFixService,
    AIProviderRateLimitError,
    AIProviderTimeoutError,
    AIProviderAuthError,
    AIProviderInvalidResponseError
)
from .schemas import DiagramCreate, DiagramUpdate, DiagramResponse, FixDiagramRequest, FixDiagramResponse

router = APIRouter()

# Dependency injection
def get_diagram_service() -> DiagramService:
    """Get diagram service instance."""
    return DiagramService(
        diagram_repository=DiagramRepository(),
        project_repository=ProjectRepository()
    )


def get_diagram_fix_service() -> DiagramFixService:
    """Get diagram fix service instance."""
    return DiagramFixService(
        diagram_repository=DiagramRepository(),
        ai_provider_repository=AIProviderRepository()
    )


async def get_current_user_id(current_user_email: str = Depends(get_current_user_email)) -> str:
    """Get current user ID from email."""
    user_repo = UserRepository()
    user = await user_repo.get_by_email(current_user_email)
    return str(user.id)


# ============ Diagram Endpoints ============

@router.post("/projects/{project_id}/diagrams", response_model=DiagramResponse, status_code=status.HTTP_201_CREATED)
async def create_diagram(
    project_id: str,
    diagram_data: DiagramCreate,
    user_id: str = Depends(get_current_user_id),
    service: DiagramService = Depends(get_diagram_service)
):
    """Create a new diagram in a project."""
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
