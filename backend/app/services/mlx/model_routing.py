"""Resolve which MLX video model entry to run for a given job shape."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from app.services.mlx.paths import model_weights_ready
from app.services.mlx.registry import get_registry


class ModelRoutingError(Exception):
    pass


def _entry_by_id(model_id: str) -> dict[str, Any]:
    registry = get_registry()
    try:
        return registry.get_video(model_id)
    except KeyError as exc:
        raise ModelRoutingError(f"Unknown video model: {model_id}") from exc


def wan_model_for_image_input(model: dict[str, Any]) -> dict[str, Any]:
    """Wan T2V checkpoints cannot encode user images; use I2V (or LTX) instead."""
    engine = model.get("engine", "")
    if engine != "mlx-video-wan-t2v":
        return model

    registry = get_registry()
    i2v_id = model.get("paired_i2v_model_id", "wan22-i2v-lightning")
    try:
        i2v = registry.get_video(i2v_id)
    except KeyError:
        i2v = None

    if i2v and model_weights_ready(i2v, kind="video"):
        return i2v

    try:
        ltx = registry.get_video("ltx2-distilled")
    except KeyError:
        ltx = None

    if ltx and model_weights_ready(ltx, kind="video"):
        return ltx

    raise ModelRoutingError(
        "This workflow needs an image-capable video model. "
        "Download Wan 2.2 I2V (`wan22-i2v-lightning`) or LTX-2 (`ltx2-distilled`) "
        "from the model picker, then try again."
    )


def resolve_video_model_for_job(
    model: dict[str, Any],
    *,
    has_image: bool,
) -> dict[str, Any]:
    """Pick the registry entry that matches text-only vs image-conditioned generation."""
    if has_image:
        return wan_model_for_image_input(model)
    return model


def merge_video_dimensions(model: dict[str, Any], source: dict[str, Any]) -> dict[str, Any]:
    """Keep the user's target width/height when substituting another engine."""
    merged = dict(model)
    for key in ("width", "height"):
        if source.get(key) is not None:
            merged[key] = source[key]
    return merged


def video_dimensions_from_image(image_path: Path, template: dict[str, Any]) -> dict[str, int]:
    """Pick width/height that preserve the source image aspect ratio (engine-aligned)."""
    from PIL import Image

    from app.services.mlx.video_presets import alignment_step

    with Image.open(image_path) as img:
        img_w, img_h = img.size

    if img_w <= 0 or img_h <= 0:
        return {
            "width": int(template.get("width", 480)),
            "height": int(template.get("height", 704)),
        }

    step = alignment_step(str(template.get("engine", "")))
    aspect = img_w / img_h
    max_w = int(template.get("width", 768))
    max_h = int(template.get("height", 704))

    # Fit inside the template box while preserving aspect ratio.
    if aspect >= max_w / max_h:
        width = max_w
        height = max(step, round(max_w / aspect / step) * step)
    else:
        height = max_h
        width = max(step, round(max_h * aspect / step) * step)

    return {"width": width, "height": height}


def assert_model_ready(model: dict[str, Any], *, kind: str = "video") -> None:
    if not model_weights_ready(model, kind=kind):
        model_id = model.get("id", "unknown")
        raise ModelRoutingError(
            f"Model '{model_id}' is not downloaded yet. "
            "Use Download from Hugging Face in the model picker."
        )