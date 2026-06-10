"""List locally available MLX models from the registry."""

from fastapi import APIRouter

from app.config import get_settings
from app.models.schemas import MediaType, ModelInfo, ModelListResponse
from app.services.mlx.registry import get_registry

router = APIRouter(prefix="/api/v1/models", tags=["models"])


def _to_model_info(entry: dict) -> ModelInfo:
    return ModelInfo(
        id=entry["id"],
        name=entry["name"],
        provider=entry.get("provider", "local-mlx"),
        description=entry.get("description"),
        capabilities=entry.get("capabilities", []),
    )


@router.get("/image", response_model=ModelListResponse)
async def list_image_models() -> ModelListResponse:
    settings = get_settings()
    registry = get_registry()
    models = registry.image_models()
    if settings.inference_backend != "mlx":
        return ModelListResponse(models=[], media_type=MediaType.IMAGE)
    return ModelListResponse(
        models=[_to_model_info(m) for m in models],
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
        models=[_to_model_info(m) for m in models],
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