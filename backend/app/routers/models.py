"""List locally available MLX models from the registry."""

from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.models.schemas import (
    MediaType,
    ModelDownloadRequest,
    ModelDownloadResponse,
    ModelInfo,
    ModelListResponse,
)
from app.services.mlx.catalog import catalog_summary, filter_by_tier, verify_catalog_with_hf
from app.services.mlx.video_catalog import (
    filter_video_by_capability,
    filter_video_by_tier,
    load_video_catalog_raw,
)
from app.services.mlx.download import get_download_job, start_model_download
from app.services.mlx.paths import model_weights_ready
from app.services.mlx.registry import get_registry, reload_registry

router = APIRouter(prefix="/api/v1/models", tags=["models"])


def _to_model_info(entry: dict, *, kind: str) -> ModelInfo:
    caps = list(entry.get("capabilities", []))
    if entry.get("nsfw") and "nsfw" not in caps:
        caps.append("nsfw")
    if entry.get("uncensored") and "uncensored" not in caps:
        caps.append("uncensored")
    return ModelInfo(
        id=entry["id"],
        name=entry["name"],
        provider=entry.get("provider", "local-mlx"),
        description=entry.get("description"),
        capabilities=caps,
        nsfw=bool(entry.get("nsfw")),
        uncensored=bool(entry.get("uncensored")),
        content_tier=entry.get("content_tier"),
        ready=model_weights_ready(entry, kind=kind),
    )


TierQuery = Literal["all", "nsfw", "general", "fast"]


@router.get("/image", response_model=ModelListResponse)
async def list_image_models(
    tier: Optional[TierQuery] = Query(
        default="all",
        description="Filter curated image models by content tier",
    ),
) -> ModelListResponse:
    settings = get_settings()
    registry = get_registry()
    models = filter_by_tier(registry.image_models(), tier)
    if settings.inference_backend != "mlx":
        return ModelListResponse(models=[], media_type=MediaType.IMAGE)
    return ModelListResponse(
        models=[_to_model_info(m, kind="image") for m in models],
        media_type=MediaType.IMAGE,
    )


@router.get("/catalog/summary")
async def get_catalog_summary() -> dict:
    """Counts and metadata for the curated Hugging Face image catalog."""
    return catalog_summary()


@router.post("/catalog/verify")
async def verify_catalog() -> dict:
    """
    Re-check curated Hugging Face repos (base weights + LoRA files).
    Does not auto-ingest search results — only validates our hand-picked list.
    """
    settings = get_settings()
    token = settings.hf_token or None
    result = verify_catalog_with_hf(token=token)
    reload_registry()
    return result


VideoCapabilityQuery = Literal["text-to-video", "image-to-video", "all"]
VideoTierQuery = Literal["all", "motion", "text-to-video", "fast"]


@router.get("/video", response_model=ModelListResponse)
async def list_video_models(
    tier: Optional[VideoTierQuery] = Query(default="all", description="Filter motion engines by tier"),
    capability: Optional[VideoCapabilityQuery] = Query(
        default="all",
        description="Filter by text-to-video vs image-to-video",
    ),
) -> ModelListResponse:
    settings = get_settings()
    registry = get_registry()
    models = filter_video_by_tier(registry.video_models(), tier)
    if capability and capability != "all":
        models = filter_video_by_capability(models, capability)
    if settings.inference_backend != "mlx":
        return ModelListResponse(models=[], media_type=MediaType.VIDEO)
    return ModelListResponse(
        models=[_to_model_info(m, kind="video") for m in models],
        media_type=MediaType.VIDEO,
    )


@router.get("/catalog/video-summary")
async def get_video_catalog_summary() -> dict:
    data = load_video_catalog_raw()
    models = get_registry().video_models()
    return {
        "version": data.get("version"),
        "notes": data.get("notes"),
        "total": len(models),
        "entries": [
            {
                "id": m["id"],
                "content_tier": m.get("content_tier"),
                "capabilities": m.get("capabilities", []),
                "image_model_id": m.get("image_model_id"),
                "download_hint": m.get("download_hint"),
            }
            for m in models
        ],
    }


@router.get("/defaults")
async def model_defaults() -> dict:
    registry = get_registry()
    settings = get_settings()
    return {
        "inference_backend": settings.inference_backend,
        "defaults": registry.defaults,
        "image_model": settings.default_image_model,
        "video_model": settings.default_video_model,
        "default_nsfw_mode": settings.default_nsfw_mode,
    }


def _download_response(job) -> ModelDownloadResponse:
    registry = get_registry()
    try:
        if job.kind == "image":
            entry = registry.get_image(job.model_id)
        else:
            entry = registry.get_video(job.model_id)
        ready = model_weights_ready(entry, kind=job.kind)
    except KeyError:
        ready = None

    return ModelDownloadResponse(
        download_id=job.id,
        model_id=job.model_id,
        kind=MediaType(job.kind),
        status=job.status.value,
        message=job.message,
        error=job.error,
        ready=ready,
    )


@router.post("/download", response_model=ModelDownloadResponse)
async def download_model(request: ModelDownloadRequest) -> ModelDownloadResponse:
    """Download model weights from Hugging Face into the local MLX cache."""
    settings = get_settings()
    if settings.inference_backend != "mlx":
        raise HTTPException(status_code=400, detail="MLX backend is not enabled")

    kind = request.kind.value
    try:
        job = start_model_download(model_id=request.model_id, kind=kind)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _download_response(job)


@router.get("/download/{download_id}", response_model=ModelDownloadResponse)
async def download_model_status(download_id: str) -> ModelDownloadResponse:
    job = get_download_job(download_id)
    if not job:
        raise HTTPException(status_code=404, detail="Download job not found")
    return _download_response(job)