"""List locally available MLX models from the registry."""

from fastapi import APIRouter

from app.config import get_settings
from app.models.schemas import MediaType, ModelInfo, ModelListResponse
from app.services.mlx.paths import model_weights_ready
from app.services.mlx.registry import get_registry

router = APIRouter(prefix="/api/v1/models", tags=["models"])


def _to_model_info(entry: dict, *, kind: str) -> ModelInfo:
    caps = list(entry.get("capabilities", []))
    if entry.get("uncensored") and "uncensored" not in caps:
        caps.append("uncensored")
    return ModelInfo(
        id=entry["id"],
        name=entry["name"],
        provider=entry.get("provider", "local-mlx"),
        description=entry.get("description"),
        capabilities=caps,
        uncensored=bool(entry.get("uncensored")),
        ready=model_weights_ready(entry, kind=kind),
    )


@router.get("/image", response_model=ModelListResponse)
async def list_image_models() -> ModelListResponse:
    settings = get_settings()
    registry = get_registry()
    models = registry.image_models()
    if settings.inference_backend != "mlx":
        return ModelListResponse(models=[], media_type=MediaType.IMAGE)
    return ModelListResponse(
        models=[_to_model_info(m, kind="image") for m in models],
        media_type=MediaType.IMAGE,
    )


@router.get("/video", response_model=ModelListResponse)
async def list_video_models() -> ModelListResponse:
    settings = get_settings()
    registry = get_registry()
    models = registry.video_models()
    if settings.inference_backend != "mlx":
        return ModelListResponse(models=[], media_type=MediaType.VIDEO)
    return ModelListResponse(
        models=[_to_model_info(m, kind="video") for m in models],
        media_type=MediaType.VIDEO,
    )


@router.get("/defaults")
async def model_defaults() -> dict:
    registry = get_registry()
    settings = get_settings()
    return {
        "inference_backend": settings.inference_backend,
        "defaults": registry.defaults,
        "image_model": settings.default_image_model,
        "video_model": settings.default_video_model,
    }