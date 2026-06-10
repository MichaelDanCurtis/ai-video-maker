"""Generic job status endpoint backed by the MLX job store."""

from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import JobStatus
from app.services.mlx.jobs import GenerationJob, JobState
from app.services.mlx.worker import get_job_store

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


def _map_state(state: JobState) -> JobStatus:
    return JobStatus(state.value)


def job_to_payload(job: GenerationJob) -> dict:
    return {
        "job_id": job.id,
        "status": _map_state(job.state).value,
        "kind": job.kind.value,
        "model": job.model_id,
        "prompt": job.prompt,
        "progress": job.progress,
        "error": job.error,
        "image_url": job.result_url if job.kind.value == "image" else None,
        "video_url": job.result_url if job.kind.value != "image" else None,
        "thumbnail_url": job.thumbnail_url,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "metadata": job.metadata,
    }


@router.get("/{job_id}")
async def get_job(job_id: str) -> dict:
    job = get_job_store().get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": f"Job {job_id} not found"})
    return job_to_payload(job)