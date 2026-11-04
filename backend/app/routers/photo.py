"""
Photo generation API router.

Provides endpoints for generating photos/images from text prompts using AI models.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import PhotoToVideoResponse

from app.config import get_settings
from app.models.schemas import (
    ErrorResponse,
    ImageRefineRequest,
    JobStatus,
    PhotoGenerationRequest,
    PhotoGenerationResponse,
    StillAnimateRequest,
)
from app.services.mlx.helpers import (
    get_job_or_404,
    photo_response_from_job,
    photo_to_video_response_from_job,
    resolve_completed_image_path,
    resolve_image_model_id,
    resolve_video_model_id,
    use_mlx,
)
from app.services.mlx.nsfw import ensure_nsfw_model_id
from app.services.mlx.registry import get_registry
from app.services.mlx.jobs import JobKind
from app.services.mlx.worker import enqueue_job, get_job_store, save_upload_for_job
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
    nsfw_mode = (
        request.nsfw_mode if request.nsfw_mode is not None else settings.default_nsfw_mode
    )
    model = resolve_image_model_id(request.model)

    if use_mlx():
        registry = get_registry()
        image_by_id = {m["id"]: m for m in registry.image_models()}
        model = ensure_nsfw_model_id(
            model,
            nsfw_mode=nsfw_mode,
            default_nsfw_model=settings.default_image_model,
            image_models_by_id=image_by_id,
        )
        job_id = _generate_job_id()
        job = get_job_store().create(
            kind=JobKind.IMAGE,
            model_id=model,
            prompt=request.prompt,
            metadata={
                "size": request.size,
                "quality": request.quality,
                "style": request.style,
                "nsfw_mode": nsfw_mode,
                "negative_prompt": request.negative_prompt,
                "seed": request.seed,
                "seed_walk": request.seed_walk,
                "n": request.n,
                "steps": request.steps,
                "guidance": request.guidance,
                "lora_scale": request.lora_scale,
            },
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


def _p2v_metadata_from_still_request(request: StillAnimateRequest, *, image_path: str) -> dict:
    return {
        "input_image_path": image_path,
        "duration": request.duration,
        "fps": request.fps,
        "aspect_ratio": request.aspect_ratio,
        "motion_strength": request.motion_strength,
        "seed": request.seed,
        "negative_prompt": request.negative_prompt,
        "motion_negative_prompt": request.motion_negative_prompt,
        "refine_prompt": request.refine_prompt,
        "refine_strength": request.refine_strength,
        "source_image_job_id": request.source_image_job_id,
        "original_filename": f"still_{request.source_image_job_id}.png",
    }


@router.post(
    "/animate",
    response_model=PhotoToVideoResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request"},
        404: {"model": ErrorResponse, "description": "Source job not found"},
    },
)
async def animate_still(request: StillAnimateRequest) -> PhotoToVideoResponse:
    """Animate a completed still image job without re-uploading."""
    from app.services.mlx.jobs import JobKind

    if not use_mlx():
        raise HTTPException(
            status_code=400,
            detail={"error": "unavailable", "message": "Still animation requires local MLX inference."},
        )

    source = get_job_or_404(request.source_image_job_id)
    image_path = resolve_completed_image_path(source)
    model = resolve_video_model_id(request.model)

    job_id = _generate_job_id()
    upload_path = save_upload_for_job(job_id, "source_still.png", image_path.read_bytes())
    prompt_text = request.motion_prompt or source.prompt or "Subtle natural motion and cinematic movement"

    job = get_job_store().create(
        kind=JobKind.PHOTO_TO_VIDEO,
        model_id=model,
        prompt=prompt_text,
        metadata=_p2v_metadata_from_still_request(request, image_path=str(upload_path)),
        job_id=job_id,
    )
    await enqueue_job(job)
    return photo_to_video_response_from_job(
        job,
        duration=request.duration,
        filename=f"still_{request.source_image_job_id}.png",
    )


@router.post(
    "/refine",
    response_model=PhotoGenerationResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request"},
        404: {"model": ErrorResponse, "description": "Source job not found"},
    },
)
async def refine_still(request: ImageRefineRequest) -> PhotoGenerationResponse:
    """Refine a completed still with Flux Redux (img2img-style) before animation."""
    from app.services.mlx.jobs import JobKind

    if not use_mlx():
        raise HTTPException(
            status_code=400,
            detail={"error": "unavailable", "message": "Image refine requires local MLX inference."},
        )

    settings = get_settings()
    source = get_job_or_404(request.source_image_job_id)
    image_path = resolve_completed_image_path(source)
    nsfw_mode = (
        request.nsfw_mode if request.nsfw_mode is not None else settings.default_nsfw_mode
    )
    model = resolve_image_model_id(request.model or source.model_id)

    job_id = _generate_job_id()
    job = get_job_store().create(
        kind=JobKind.IMAGE,
        model_id=model,
        prompt=request.refine_prompt,
        metadata={
            "nsfw_mode": nsfw_mode,
            "negative_prompt": request.negative_prompt,
            "seed": request.seed,
            "refine_source_path": str(image_path),
            "refine_strength": request.strength,
            "refine_mode": True,
            "size": source.metadata.get("size"),
        },
        job_id=job_id,
    )
    await enqueue_job(job)
    return photo_response_from_job(job)