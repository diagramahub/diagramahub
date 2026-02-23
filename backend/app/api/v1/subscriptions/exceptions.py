"""
Custom exceptions for subscription system.
"""
from fastapi import HTTPException


class ValidationError(HTTPException):
    """Validation error (HTTP 400)."""
    def __init__(self, detail: str):
        super().__init__(status_code=400, detail=detail)


class ResourceLimitError(HTTPException):
    """Resource limit exceeded error (HTTP 403)."""
    def __init__(self, resource_type: str, current: int, limit: int):
        detail = {
            "error": "resource_limit_exceeded",
            "resource_type": resource_type,
            "current_usage": current,
            "limit": limit,
            "message": f"You have reached your {resource_type} limit ({current}/{limit})"
        }
        super().__init__(status_code=403, detail=detail)


class NotFoundError(HTTPException):
    """Resource not found error (HTTP 404)."""
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            status_code=404,
            detail=f"{resource} with id {resource_id} not found"
        )


class PaymentProviderError(HTTPException):
    """Payment provider error (HTTP 502)."""
    def __init__(self, provider: str, detail: str):
        super().__init__(
            status_code=502,
            detail=f"Payment provider ({provider}) error: {detail}"
        )


class ConfigurationError(HTTPException):
    """Configuration error (HTTP 500)."""
    def __init__(self, detail: str):
        super().__init__(
            status_code=500,
            detail=f"Configuration error: {detail}"
        )


class FreePlanProtectionError(ValidationError):
    """Error when trying to modify FREE plan."""
    def __init__(self):
        super().__init__("FREE plan cannot be modified or deactivated")


class DuplicatePlanNameError(ValidationError):
    """Error when plan name already exists."""
    def __init__(self, name: str):
        super().__init__(f"Plan with name '{name}' already exists")
