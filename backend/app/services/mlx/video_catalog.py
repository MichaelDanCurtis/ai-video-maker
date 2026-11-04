"""Curated MLX video model catalog — motion engines (not duplicate image LoRAs)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

_CATALOG_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent / "mlx_models" / "video_catalog.json"
)

VIDEO_TIERS = ("all", "motion", "text-to-video", "fast")


def load_video_catalog_raw() -> dict[str, Any]:
    with _CATALOG_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def expand_video_catalog_entry(entry: dict[str, Any], templates: dict[str, Any]) -> dict[str, Any]:
    template_name = entry.get("template")
    if not template_name or template_name not in templates:
        raise ValueError(f"Unknown video catalog template: {template_name}")

    merged: dict[str, Any] = {
        "provider": "local-mlx",
        "nsfw": False,
        "uncensored": False,
    }
    merged.update(templates[template_name])
    merged.update(entry)
    if entry.get("default_image_model_id"):
        merged["image_model_id"] = entry["default_image_model_id"]
    return merged


def video_models_from_catalog() -> list[dict[str, Any]]:
    data = load_video_catalog_raw()
    templates = data.get("templates", {})
    return [expand_video_catalog_entry(entry, templates) for entry in data.get("entries", [])]


def filter_video_by_tier(models: list[dict[str, Any]], tier: Optional[str]) -> list[dict[str, Any]]:
    if not tier or tier == "all":
        return models
    if tier not in VIDEO_TIERS:
        return models
    return [m for m in models if m.get("content_tier") == tier]


def filter_video_by_capability(models: list[dict[str, Any]], capability: str) -> list[dict[str, Any]]:
    return [m for m in models if capability in m.get("capabilities", [])]