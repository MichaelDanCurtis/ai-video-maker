"""
Video generation API router.

Provides endpoints for generating videos from text prompts using AI models.
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
from app.services.mlx.helpers import (
    get_job_or_404,
    resolve_video_model_id,
    use_mlx,
    video_response_from_job,
)
from app.services.mlx.jobs import JobKind
from app.services.mlx.registry import get_registry
from app.services.mlx.worker import enqueue_job, get_job_store
from app.services.openrouter import (
    OpenRouterAuthError,
    OpenRouterRateLimitError,
    OpenRouterAPIError,
    get_openrouter_client_async,
)

router = APIRouter(prefix="/api/v1/video", tags=["video"])

VIDEO_GENERATION_AVAILABLE = False


def _generate_job_id() -> str:
    return f"job_{uuid.uuid4().hex[:12]}"


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
    Generate a video from a text prompt.

    MLX path: text-to-video uses uncensored Flux image + Wan Lightning I2V.
    """
    settings = get_settings()
    model = resolve_video_model_id(request.model)

    if use_mlx():
        registry = get_registry()
        try:
            registry.get_video(model)
        except KeyError as exc:
            raise HTTPException(status_code=400, detail={"error": "invalid_model", "message": str(exc)}) from exc

        job_id = _generate_job_id()
        job = get_job_store().create(
            kind=JobKind.TEXT_TO_VIDEO,
            model_id=model,
            prompt=request.prompt,
            metadata={
                "duration": request.duration,
                "fps": request.fps,
                "resolution": request.resolution,
            },
            job_id=job_id,
        )
        await enqueue_job(job)
        return video_response_from_job(job, duration=request.duration)

    job_id = f"video_{uuid.uuid4().hex[:12]}"

    if not VIDEO_GENERATION_AVAILABLE:
        return VideoGenerationResponse(
            job_id=job_id,
            status=JobStatus.FAILED,
            model=model,
            prompt=request.prompt,
            duration=request.duration,
            created_at=datetime.utcnow(),
            unavailable_message=(
                "Video generation is not currently available via OpenRouter. "
                "Set INFERENCE_BACKEND=mlx for local generation on Apple Silicon."
            ),
        )

    try:
        async with get_openrouter_client_async() as client:
            result = await client.generate_video_async(
                prompt=request.prompt,
                model=model,
                duration=request.duration,
                fps=request.fps,
                resolution=request.resolution,
            )

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
            detail={"error": "authentication_error", "message": str(e)},
        )

    except OpenRouterRateLimitError as e:
        raise HTTPException(
            status_code=429,
            detail={"error": "rate_limit_exceeded", "message": str(e)},
        )

    except OpenRouterAPIError as e:
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
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": f"An unexpected error occurred: {str(e)}"},
        )


@router.get("/status/{job_id}", response_model=VideoGenerationResponse)
async def video_job_status(job_id: str) -> VideoGenerationResponse:
    job = get_job_or_404(job_id)
    duration = int(job.metadata.get("duration", 5))
    return video_response_from_job(job, duration=duration)