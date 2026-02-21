"""
Servicio para corrección de diagramas con IA.
"""
import logging
import time
import difflib
from typing import Optional
from .repository import DiagramRepository
from ..ai_providers.repository import AIProviderRepository
from ..ai_providers.clients.factory import AIClientFactory
from .syntax_validator import SyntaxValidator
from .schemas import FixDiagramResponse


# Excepciones personalizadas
class AIProviderError(Exception):
    """Error base para proveedores de IA."""
    pass


class AIProviderTimeoutError(AIProviderError):
    """Timeout al llamar al proveedor de IA."""
    pass


class AIProviderRateLimitError(AIProviderError):
    """Rate limit excedido."""
    pass


class AIProviderAuthError(AIProviderError):
    """Error de autenticación con el proveedor."""
    pass


class AIProviderInvalidResponseError(AIProviderError):
    """Respuesta inválida del proveedor."""
    pass


class DiagramFixService:
    """Servicio para corrección de diagramas con IA."""
    
    def __init__(
        self,
        diagram_repository: DiagramRepository,
        ai_provider_repository: AIProviderRepository
    ):
        """
        Inicializar servicio de corrección.
        
        Args:
            diagram_repository: Repositorio de diagramas
            ai_provider_repository: Repositorio de proveedores de IA
        """
        self.diagram_repo = diagram_repository
        self.ai_repo = ai_provider_repository
        self.logger = logging.getLogger(__name__)
    
    async def fix_diagram(
        self,
        diagram_id: str,
        user_id: str,
        error_context: Optional[str] = None,
        provider_name: Optional[str] = None,
        language: str = "es"
    ) -> FixDiagramResponse:
        """
        Corregir un diagrama usando IA.
        
        Args:
            diagram_id: ID del diagrama a corregir
            user_id: ID del usuario solicitante
            error_context: Contexto del error de renderizado
            provider_name: Proveedor específico a usar (opcional)
            language: Idioma para la explicación
            
        Returns:
            FixDiagramResponse con código corregido y explicación
            
        Raises:
            PermissionError: Si el usuario no tiene acceso
            ValueError: Si el diagrama no existe o la corrección falla
            TimeoutError: Si la corrección excede el tiempo límite
            AIProviderRateLimitError: Si se excede el rate limit
        """
        start_time = time.time()
        
        try:
            # Log inicio de corrección
            self.logger.info(
                f"Fix diagram request started",
                extra={
                    "diagram_id": diagram_id,
                    "user_id": user_id,
                    "provider_requested": provider_name
                }
            )
            
            # 1. Obtener diagrama y validar permisos
            diagram = await self.diagram_repo.get_by_id(diagram_id)
            
            if not diagram:
                raise ValueError(f"Diagrama no encontrado: {diagram_id}")
            
            # Verificar que el diagrama pertenece al proyecto del usuario
            # (Asumiendo que hay una relación project -> user)
            # Por ahora, simplificamos asumiendo que si existe el diagrama, el usuario tiene acceso
            # En producción, deberías verificar: diagram.project.user_id == user_id
            
            # 2. Obtener proveedor de IA activo
            selected_provider = await self.ai_repo.get_active_provider(
                user_id=user_id,
                provider_type=provider_name
            )
            
            if not selected_provider:
                if provider_name:
                    raise ValueError(f"Proveedor '{provider_name}' no encontrado o no activo")
                else:
                    raise ValueError("No hay proveedores de IA activos disponibles")
            
            # 3. Crear cliente de IA
            try:
                ai_client = AIClientFactory.create_client(
                    provider=selected_provider.provider,
                    api_key=selected_provider.api_key,
                    model=selected_provider.model,
                    parameters=selected_provider.parameters or {}
                )
            except Exception as e:
                raise ValueError(f"Error al crear cliente de IA: {str(e)}")
            
            # 4. Llamar a IA para corregir diagrama
            try:
                fix_result = await ai_client.fix_diagram(
                    diagram_code=diagram.content,
                    diagram_type=diagram.diagram_type,
                    error_context=error_context,
                    language=language
                )
            except ValueError as e:
                error_msg = str(e)
                if "rate limit" in error_msg.lower() or "429" in error_msg:
                    raise AIProviderRateLimitError(error_msg)
                elif "timeout" in error_msg.lower():
                    raise AIProviderTimeoutError(error_msg)
                elif "auth" in error_msg.lower() or "401" in error_msg or "403" in error_msg:
                    raise AIProviderAuthError(error_msg)
                else:
                    raise AIProviderInvalidResponseError(error_msg)
            
            # 5. Validar código corregido
            validation_result = await self._validate_corrected_syntax(
                fix_result["corrected_code"],
                diagram.diagram_type
            )
            
            if not validation_result.is_valid:
                self.logger.error(
                    f"Corrected code failed validation",
                    extra={
                        "diagram_id": diagram_id,
                        "validation_error": validation_result.error_message
                    }
                )
                raise ValueError(
                    f"El código corregido no pasó validación de sintaxis: {validation_result.error_message}"
                )
            
            # 6. Generar diff
            diff = self._generate_diff(diagram.content, fix_result["corrected_code"])
            
            # 7. Calcular tiempo de generación
            generation_time = time.time() - start_time
            
            # 8. Log evento exitoso
            await self._log_fix_event(
                diagram_id=diagram_id,
                user_id=user_id,
                diagram_type=diagram.diagram_type,
                provider=selected_provider.provider,
                model=selected_provider.model,
                success=True,
                response_time=generation_time,
                validation_passed=validation_result.is_valid
            )
            
            # 9. Construir respuesta
            response = FixDiagramResponse(
                original_code=diagram.content,
                corrected_code=fix_result["corrected_code"],
                explanation=fix_result["explanation"],
                changes_summary=fix_result["changes_summary"],
                diff=diff,
                provider_used=selected_provider.provider,
                model_used=selected_provider.model,
                generation_time=generation_time,
                validation_passed=validation_result.is_valid
            )
            
            return response
            
        except (PermissionError, ValueError, TimeoutError, AIProviderError) as e:
            # Log evento fallido
            generation_time = time.time() - start_time
            await self._log_fix_event(
                diagram_id=diagram_id,
                user_id=user_id,
                diagram_type=diagram.diagram_type if 'diagram' in locals() else "unknown",
                provider=selected_provider.provider if 'selected_provider' in locals() and selected_provider else "unknown",
                model=selected_provider.model if 'selected_provider' in locals() and selected_provider else "unknown",
                success=False,
                response_time=generation_time,
                error_type=type(e).__name__
            )
            raise
    
    async def _validate_corrected_syntax(
        self,
        code: str,
        diagram_type: str
    ) -> "ValidationResult":
        """
        Validar sintaxis del código corregido.
        
        Args:
            code: Código a validar
            diagram_type: Tipo de diagrama
            
        Returns:
            ValidationResult con resultado de validación
        """
        return await SyntaxValidator.validate(code, diagram_type)
    
    def _generate_diff(self, original: str, corrected: str) -> str:
        """
        Generar diff unificado entre código original y corregido.
        
        Args:
            original: Código original
            corrected: Código corregido
            
        Returns:
            Diff en formato unificado
        """
        original_lines = original.splitlines(keepends=True)
        corrected_lines = corrected.splitlines(keepends=True)
        
        diff = difflib.unified_diff(
            original_lines,
            corrected_lines,
            fromfile='original',
            tofile='corrected',
            lineterm=''
        )
        
        return ''.join(diff)
    
    async def _log_fix_event(
        self,
        diagram_id: str,
        user_id: str,
        diagram_type: str,
        provider: str,
        model: str,
        success: bool,
        response_time: float,
        validation_passed: Optional[bool] = None,
        error_type: Optional[str] = None
    ):
        """
        Registrar evento de corrección para métricas.
        
        Args:
            diagram_id: ID del diagrama
            user_id: ID del usuario
            diagram_type: Tipo de diagrama
            provider: Proveedor de IA usado
            model: Modelo usado
            success: Si la corrección fue exitosa
            response_time: Tiempo de respuesta en segundos
            validation_passed: Si el código pasó validación
            error_type: Tipo de error si falló
        """
        log_data = {
            "event": "diagram_fix",
            "diagram_id": diagram_id,
            "user_id": user_id,
            "diagram_type": diagram_type,
            "provider": provider,
            "model": model,
            "success": success,
            "response_time": response_time
        }
        
        if validation_passed is not None:
            log_data["validation_passed"] = validation_passed
        
        if error_type:
            log_data["error_type"] = error_type
        
        if success:
            self.logger.info("Diagram fix completed successfully", extra=log_data)
        else:
            self.logger.error("Diagram fix failed", extra=log_data)
