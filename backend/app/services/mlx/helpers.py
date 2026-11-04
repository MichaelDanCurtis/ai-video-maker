"""Shared helpers for MLX-backed API routes."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from app.config import get_settings
from app.models.schemas import JobStatus
from app.services.mlx.jobs import GenerationJob, JobState
from app.services.mlx.worker import get_job_store


def use_mlx() -> bool:
    settings = get_settings()
    return settings.inference_backend == "mlx" and settings.mlx_enabled


def resolve_image_model_id(requested: Optional[str]) -> str:
    settings = get_settings()
    if use_mlx():
        return requested or settings.default_image_model
    return requested or settings.default_image_model


def resolve_video_model_id(requested: Optional[str]) -> str:
    settings = get_settings()
    if use_mlx():
        return requested or settings.default_video_model
    return requested or settings.default_video_model


def job_status(job: Optional[GenerationJob]) -> JobStatus:
    if not job:
        return JobStatus.FAILED
    return JobStatus(job.state.value)


def photo_response_from_job(job: GenerationJob):
    from app.models.schemas import PhotoGenerationResponse

    image_urls = job.metadata.get("result_urls")
    return PhotoGenerationResponse(
        job_id=job.id,
        status=job_status(job),
        image_url=job.result_url,
        image_urls=image_urls if image_urls else None,
        model=job.model_id,
        prompt=job.prompt,
        created_at=datetime.fromisoformat(job.created_at),
        error=job.error,
    )


def resolve_completed_image_path(job: GenerationJob) -> Path:
    """Return on-disk path for a completed image job."""
    if job.state != JobState.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "job_not_ready",
                "message": "Source image job must be completed.",
            },
        )
    if job.result_path and Path(job.result_path).is_file():
        return Path(job.result_path)
    raise HTTPException(
        status_code=400,
        detail={
            "error": "missing_image",
            "message": "Source image file is missing on disk.",
        },
    )


def video_response_from_job(job: GenerationJob, *, duration: int = 5):
    from app.models.schemas import VideoGenerationResponse

    return VideoGenerationResponse(
        job_id=job.id,
        status=job_status(job),
        video_url=job.result_url,
        thumbnail_url=job.thumbnail_url,
        model=job.model_id,
        prompt=job.prompt,
        duration=duration,
        created_at=datetime.fromisoformat(job.created_at),
        progress=job.progress if job.state == JobState.PROCESSING else None,
        error=job.error,
    )


def photo_to_video_response_from_job(job: GenerationJob, *, duration: int, filename: Optional[str]):
    from app.models.schemas import PhotoToVideoResponse

    return PhotoToVideoResponse(
        job_id=job.id,
        status=job_status(job),
        original_filename=filename,
        video_url=job.result_url,
        thumbnail_url=job.thumbnail_url,
        model=job.model_id,
        duration=duration,
        created_at=datetime.fromisoformat(job.created_at),
        progress=job.progress if job.state == JobState.PROCESSING else None,
        error=job.error,
    )


def get_job_or_404(job_id: str) -> GenerationJob:
    job = get_job_store().get(job_id)
    if not job:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail={"error": "not_found", "message": f"Job {job_id} not found"})
    return job