"""Health check endpoint."""

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    """Return service health status for load balancers and connectivity checks."""
    settings = get_settings()
    return {
        "status": "ok",
        "service": "archivision-ai-api",
        "version": "0.0.1",
        "environment": settings.environment,
    }
