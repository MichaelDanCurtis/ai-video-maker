"""
Photo generation API router.

Provides endpoints for generating photos/images from text prompts using AI models.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.models.schemas import (
    ErrorResponse,
    JobStatus,
    PhotoGenerationRequest,
    PhotoGenerationResponse,
)
from app.services.mlx.helpers import (
    get_job_or_404,
    photo_response_from_job,
    resolve_image_model_id,
    use_mlx,
)
from app.services.mlx.jobs import JobKind
from app.services.mlx.worker import enqueue_job, get_job_store
from app.services.openrouter import (
    OpenRouterAuthError,
    OpenRouterRateLimitError,
    OpenRouterAPIError,
    get_openrouter_client_async,
)

router = APIRouter(prefix="/api/v1/photo", tags=["photo"])


def _generate_job_id() -> str:
    """Generate a unique job ID for photo generation."""
    return f"job_{uuid.uuid4().hex[:12]}"


@router.post(
    "/generate",
    response_model=PhotoGenerationResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request parameters"},
        401: {"model": ErrorResponse, "description": "API key not configured or invalid"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def generate_photo(request: PhotoGenerationRequest) -> PhotoGenerationResponse:
    """
    Generate a photo from a text prompt using AI.

    When inference_backend=mlx, enqueues a local generation job and returns
    status=pending — poll GET /api/v1/photo/status/{job_id} for completion.
    """
    settings = get_settings()
    model = resolve_image_model_id(request.model)

    if use_mlx():
        job_id = _generate_job_id()
        job = get_job_store().create(
            kind=JobKind.IMAGE,
            model_id=model,
            prompt=request.prompt,
            metadata={"size": request.size, "quality": request.quality, "style": request.style},
            job_id=job_id,
        )
        await enqueue_job(job)
        return photo_response_from_job(job)

    job_id = f"photo_{uuid.uuid4().hex[:12]}"

    try:
        async with get_openrouter_client_async() as client:
            result = await client.generate_image_async(
                prompt=request.prompt,
                model=model,
                size=request.size,
                quality=request.quality,
                style=request.style,
                n=request.n,
            )

            image_url = None
            image_base64 = None

            if "data" in result and len(result["data"]) > 0:
                image_data = result["data"][0]
                image_url = image_data.get("url")
                image_base64 = image_data.get("b64_json")

            return PhotoGenerationResponse(
                job_id=job_id,
                status=JobStatus.COMPLETED,
                image_url=image_url,
                image_base64=image_base64,
                model=model,
                prompt=request.prompt,
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
        return PhotoGenerationResponse(
            job_id=job_id,
            status=JobStatus.FAILED,
            model=model,
            prompt=request.prompt,
            created_at=datetime.utcnow(),
            error=str(e),
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_error",
                "message": f"An unexpected error occurred: {str(e)}",
            },
        )


@router.get("/status/{job_id}", response_model=PhotoGenerationResponse)
async def photo_job_status(job_id: str) -> PhotoGenerationResponse:
    """Poll MLX photo generation job status."""
    job = get_job_or_404(job_id)
    return photo_response_from_job(job)