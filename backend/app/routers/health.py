"""
Health check API router.

Provides endpoints for monitoring the API's health status.
"""

from datetime import datetime

from fastapi import APIRouter

from app.config import get_settings
from app.models.schemas import HealthResponse

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Check the health status of the API.

    Returns the current health status, API version, and timestamp.
    This endpoint is used for monitoring and load balancer health checks.
    """
    settings = get_settings()

    return HealthResponse(
        status="healthy",
        version=settings.app_version,
        timestamp=datetime.utcnow(),
    )
