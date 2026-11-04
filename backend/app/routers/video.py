"""
Video generation API router.

Provides endpoints for generating videos from text prompts using AI models.
Note: Video generation capability on OpenRouter is UNVERIFIED and may not be available.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.models.schemas import (
    ErrorResponse,
    JobStatus,
    VideoGenerationRequest,
    VideoGenerationResponse,
)
from app.services.openrouter import (
    OpenRouterClient,
    OpenRouterAuthError,
    OpenRouterRateLimitError,
    OpenRouterAPIError,
    get_openrouter_client_async,
)

router = APIRouter(prefix="/api/v1/video", tags=["video"])

# Flag indicating video generation availability on OpenRouter
# This is set to False since video generation via OpenRouter is unverified
VIDEO_GENERATION_AVAILABLE = False


def _generate_job_id() -> str:
    """Generate a unique job ID for video generation."""
    return f"video_{uuid.uuid4().hex[:12]}"


@router.post(
    "/generate",
    response_model=VideoGenerationResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request parameters"},
        401: {"model": ErrorResponse, "description": "API key not configured or invalid"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def generate_video(request: VideoGenerationRequest) -> VideoGenerationResponse:
    """
    Generate a video from a text prompt using AI.

    This endpoint uses AI models to create videos from text descriptions.
    Video generation may take significantly longer than image generation.

    Note: Video generation capability is currently UNVERIFIED on OpenRouter.
    If video models are unavailable, a response with an unavailable_message
    will be returned instead of actual video content.

    Args:
        request: Video generation request containing the prompt and options.

    Returns:
        VideoGenerationResponse with the generated video URL or unavailable message.

    Raises:
        HTTPException: On validation errors, authentication failures, or API errors.
    """
    settings = get_settings()
    job_id = _generate_job_id()

    # Use default model if not specified
    model = request.model or settings.default_video_model

    # Check if video generation is available
    if not VIDEO_GENERATION_AVAILABLE:
        return VideoGenerationResponse(
            job_id=job_id,
            status=JobStatus.FAILED,
            model=model,
            prompt=request.prompt,
            duration=request.duration,
            created_at=datetime.utcnow(),
            unavailable_message=(
                "Video generation is not currently available. "
                "The video generation models on OpenRouter have not been verified. "
                "Please check back later or use the photo generation endpoint instead."
            ),
        )

    try:
        async with get_openrouter_client_async() as client:
            # Attempt to call video generation API
            # Note: This code path may not work as video generation on OpenRouter
            # is unverified. Keeping the implementation for future compatibility.
            result = await client.generate_video_async(
                prompt=request.prompt,
                model=model,
                duration=request.duration,
                fps=request.fps,
                resolution=request.resolution,
            )

            # Extract video data from response
            video_url = None
            thumbnail_url = None

            if "data" in result and len(result["data"]) > 0:
                video_data = result["data"][0]
                video_url = video_data.get("url")
                thumbnail_url = video_data.get("thumbnail_url")

            return VideoGenerationResponse(
                job_id=job_id,
                status=JobStatus.COMPLETED,
                video_url=video_url,
                thumbnail_url=thumbnail_url,
                model=model,
                prompt=request.prompt,
                duration=request.duration,
                created_at=datetime.utcnow(),
            )

    except OpenRouterAuthError as e:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "authentication_error",
                "message": str(e),
            },
        )

    except OpenRouterRateLimitError as e:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limit_exceeded",
                "message": str(e),
            },
        )

    except OpenRouterAPIError as e:
        # Return a failed response for API errors instead of raising
        return VideoGenerationResponse(
            job_id=job_id,
            status=JobStatus.FAILED,
            model=model,
            prompt=request.prompt,
            duration=request.duration,
            created_at=datetime.utcnow(),
            error=str(e),
        )

    except Exception as e:
        # Unexpected errors
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_error",
                "message": f"An unexpected error occurred: {str(e)}",
            },
        )
