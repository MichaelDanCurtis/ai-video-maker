"""
Video generation API router.

Provides endpoints for generating videos from text prompts using AI models.
"""

import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.models.schemas import (
    ErrorResponse,
    JobStatus,
    VideoContinueRequest,
    VideoContinueResponse,
    VideoGenerationRequest,
    VideoGenerationResponse,
)
from app.services.mlx.frame_extract import FrameExtractError, extract_last_frame
from app.services.mlx.helpers import (
    get_job_or_404,
    job_status,
    resolve_video_model_id,
    use_mlx,
    video_response_from_job,
)
from app.services.mlx.jobs import JobKind, JobState
from app.services.mlx.paths import media_url_for
from app.services.mlx.nsfw import ensure_nsfw_model_id
from app.services.mlx.registry import get_registry
from app.services.mlx.worker import enqueue_job, get_job_store, save_upload_for_job
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

    MLX path: text-to-video uses the configured Flux image model + Wan Lightning I2V.
    """
    settings = get_settings()
    model = resolve_video_model_id(request.model)

    if use_mlx():
        registry = get_registry()
        try:
            registry.get_video(model)
        except KeyError as exc:
            raise HTTPException(status_code=400, detail={"error": "invalid_model", "message": str(exc)}) from exc

        nsfw_mode = (
            request.nsfw_mode if request.nsfw_mode is not None else settings.default_nsfw_mode
        )
        image_by_id = {m["id"]: m for m in registry.image_models()}
        image_model_id = request.image_model or registry.get_video(model).get("image_model_id")
        if image_model_id:
            image_model_id = ensure_nsfw_model_id(
                image_model_id,
                nsfw_mode=nsfw_mode,
                default_nsfw_model=settings.default_image_model,
                image_models_by_id=image_by_id,
            )

        job_id = _generate_job_id()
        job = get_job_store().create(
            kind=JobKind.TEXT_TO_VIDEO,
            model_id=model,
            prompt=request.prompt,
            metadata={
                "duration": request.duration,
                "fps": request.fps,
                "resolution": request.resolution,
                "aspect_ratio": request.aspect_ratio,
                "image_model_id": image_model_id,
                "nsfw_mode": nsfw_mode,
                "seed": request.seed,
                "negative_prompt": request.negative_prompt,
                "motion_negative_prompt": request.motion_negative_prompt,
                "pure_t2v": request.pure_t2v,
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


def _continue_response_from_job(
    job,
    *,
    source_job_id: str,
    duration: int,
    seed_frame_url: Optional[str] = None,
) -> VideoContinueResponse:
    return VideoContinueResponse(
        job_id=job.id,
        status=job_status(job),
        source_job_id=source_job_id,
        seed_frame_url=seed_frame_url,
        video_url=job.result_url,
        thumbnail_url=job.thumbnail_url,
        model=job.model_id,
        prompt=job.prompt,
        duration=duration,
        created_at=datetime.fromisoformat(job.created_at),
        progress=job.progress if job.state == JobState.PROCESSING else None,
        error=job.error,
    )


@router.post(
    "/continue",
    response_model=VideoContinueResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request parameters"},
        404: {"model": ErrorResponse, "description": "Source job not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def continue_video(request: VideoContinueRequest) -> VideoContinueResponse:
    """
    Chain a new shot from the last frame of a completed video.

    Extracts the final frame, then queues image-to-video with the same presets
    as the source clip unless overridden.
    """
    if not use_mlx():
        raise HTTPException(
            status_code=400,
            detail={
                "error": "unavailable",
                "message": "Shot continuation requires local MLX inference.",
            },
        )

    source = get_job_or_404(request.source_job_id)
    if source.state != JobState.COMPLETED or not source.result_path:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "job_not_ready",
                "message": "Source job must be completed before continuing.",
            },
        )

    video_path = Path(source.result_path)
    if not video_path.is_file():
        raise HTTPException(
            status_code=400,
            detail={
                "error": "missing_video",
                "message": "Source video file is missing on disk.",
            },
        )

    model = resolve_video_model_id(request.model or source.model_id)
    registry = get_registry()
    try:
        registry.get_video(model)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail={"error": "invalid_model", "message": str(exc)}) from exc

    duration = int(request.duration if request.duration is not None else source.metadata.get("duration", 4))
    fps = int(request.fps if request.fps is not None else source.metadata.get("fps", 24))
    aspect_ratio = request.aspect_ratio or source.metadata.get("aspect_ratio", "auto")
    prompt_text = request.motion_prompt or source.prompt or "Continue the motion naturally"

    job_id = _generate_job_id()

    try:
        frame_path = extract_last_frame(video_path, job_id=job_id)
    except FrameExtractError as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": "frame_extract_failed", "message": str(exc)},
        ) from exc

    upload_path = save_upload_for_job(job_id, "last_frame.png", frame_path.read_bytes())
    seed_frame_url = media_url_for(frame_path)

    job = get_job_store().create(
        kind=JobKind.PHOTO_TO_VIDEO,
        model_id=model,
        prompt=prompt_text,
        metadata={
            "input_image_path": str(upload_path),
            "duration": duration,
            "fps": fps,
            "aspect_ratio": aspect_ratio,
            "continued_from": source.id,
            "segment_index": request.segment_index,
            "shot_index": request.shot_index,
            "chain_seed_frame": str(frame_path),
            "seed": request.seed,
            "negative_prompt": request.negative_prompt,
            "motion_negative_prompt": request.motion_negative_prompt,
            "motion_strength": request.motion_strength,
            "nsfw_mode": request.nsfw_mode,
        },
        job_id=job_id,
    )
    await enqueue_job(job)
    return _continue_response_from_job(
        job,
        source_job_id=source.id,
        duration=duration,
        seed_frame_url=seed_frame_url,
    )


@router.get("/continue/status/{job_id}", response_model=VideoContinueResponse)
async def continue_video_status(job_id: str) -> VideoContinueResponse:
    job = get_job_or_404(job_id)
    source_job_id = str(job.metadata.get("continued_from", ""))
    duration = int(job.metadata.get("duration", 4))
    seed = job.metadata.get("chain_seed_frame")
    seed_url = media_url_for(Path(seed)) if seed and Path(seed).is_file() else None
    return _continue_response_from_job(
        job,
        source_job_id=source_job_id,
        duration=duration,
        seed_frame_url=seed_url,
    )