"""Load and query the local MLX model registry."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from app.services.mlx.catalog import image_models_from_catalog
from app.services.mlx.video_catalog import video_models_from_catalog

_REGISTRY_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent / "mlx_models" / "registry.json"
)


def _load_registry_data() -> dict[str, Any]:
    with _REGISTRY_PATH.open(encoding="utf-8") as handle:
        data = json.load(handle)
    # Image + video catalogs are curated separately (different engines, different download sizes).
    data["image_models"] = image_models_from_catalog()
    data["video_models"] = video_models_from_catalog()
    return data


class ModelRegistry:
    def __init__(self, data: dict[str, Any]) -> None:
        self._data = data
        self._image = {m["id"]: m for m in data.get("image_models", [])}
        self._video = {m["id"]: m for m in data.get("video_models", [])}

    @property
    def defaults(self) -> dict[str, str]:
        return dict(self._data.get("defaults", {}))

    def image_models(self) -> list[dict[str, Any]]:
        return list(self._image.values())

    def video_models(self) -> list[dict[str, Any]]:
        return list(self._video.values())

    def get_image(self, model_id: Optional[str]) -> dict[str, Any]:
        resolved = model_id or self.defaults.get("image")
        if not resolved or resolved not in self._image:
            raise KeyError(f"Unknown image model: {model_id}")
        return self._image[resolved]

    def get_video(self, model_id: Optional[str]) -> dict[str, Any]:
        resolved = model_id or self.defaults.get("video")
        if not resolved or resolved not in self._video:
            raise KeyError(f"Unknown video model: {model_id}")
        return self._video[resolved]


@lru_cache()
def get_registry() -> ModelRegistry:
    return ModelRegistry(_load_registry_data())


def reload_registry() -> ModelRegistry:
    get_registry.cache_clear()
    return get_registry()