"""
Project assembly API — stitch multiple generated clips into one video.
"""

from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import ConcatProjectRequest, ConcatProjectResponse, ErrorResponse
from app.services.concat import ConcatError, concat_videos

router = APIRouter(prefix="/api/v1/project", tags=["project"])


@router.post(
    "/concat",
    response_model=ConcatProjectResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid clip list or missing files"},
        500: {"model": ErrorResponse, "description": "Stitching failed"},
    },
)
async def concat_project(request: ConcatProjectRequest) -> ConcatProjectResponse:
    """Stitch ordered clips into a single downloadable video."""
    try:
        job_id, video_url, duration = concat_videos(
            request.clip_urls,
            project_name=request.project_name,
        )
    except ConcatError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "concat_failed", "message": str(exc)},
        ) from exc

    return ConcatProjectResponse(
        job_id=job_id,
        video_url=video_url,
        clip_count=len(request.clip_urls),
        duration=round(duration, 2),
        project_name=request.project_name,
        created_at=datetime.utcnow(),
    )