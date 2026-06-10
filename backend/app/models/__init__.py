"""
Models module containing Pydantic schemas for API request/response types.
"""

from app.models.schemas import (
    # Enums
    JobStatus,
    MediaType,
    # Photo schemas
    PhotoGenerationRequest,
    PhotoGenerationResponse,
    PhotoEditRequest,
    PhotoEditResponse,
    # Video schemas
    VideoGenerationRequest,
    VideoGenerationResponse,
    VideoEditRequest,
    VideoEditResponse,
    # Transform schemas
    PhotoToVideoRequest,
    PhotoToVideoResponse,
    # Common schemas
    HealthResponse,
    ErrorResponse,
    ModelInfo,
    ModelListResponse,
)

__all__ = [
    # Enums
    "JobStatus",
    "MediaType",
    # Photo schemas
    "PhotoGenerationRequest",
    "PhotoGenerationResponse",
    "PhotoEditRequest",
    "PhotoEditResponse",
    # Video schemas
    "VideoGenerationRequest",
    "VideoGenerationResponse",
    "VideoEditRequest",
    "VideoEditResponse",
    # Transform schemas
    "PhotoToVideoRequest",
    "PhotoToVideoResponse",
    # Common schemas
    "HealthResponse",
    "ErrorResponse",
    "ModelInfo",
    "ModelListResponse",
]
