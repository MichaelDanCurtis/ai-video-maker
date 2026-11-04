"""Map user-facing video presets (aspect, duration, fps) to MLX runner dimensions."""

from __future__ import annotations

import re
from typing import Any, Optional

# Friendly presets exposed in the studio UI.
ASPECT_RATIO_PRESETS: dict[str, float] = {
    "9:16": 9 / 16,
    "16:9": 16 / 9,
    "1:1": 1.0,
    "4:5": 4 / 5,
    "3:4": 3 / 4,
}

AUTO_ASPECT_VALUES = frozenset({"auto", "source", ""})


def alignment_step(engine: str) -> int:
    """LTX requires multiples of 64; Wan tolerates 8px alignment."""
    return 64 if engine == "mlx-video-ltx2" else 8


def _align(value: float, step: int) -> int:
    return max(step, round(value / step) * step)


def parse_aspect_ratio(value: str) -> Optional[float]:
    """Parse '16:9', '16/9', or a known preset key into width/height ratio."""
    key = value.strip().lower()
    if key in ASPECT_RATIO_PRESETS:
        return ASPECT_RATIO_PRESETS[key]
    if key in AUTO_ASPECT_VALUES:
        return None

    match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)", value.strip())
    if not match:
        return None
    w, h = float(match.group(1)), float(match.group(2))
    if w <= 0 or h <= 0:
        return None
    return w / h


def dimensions_for_aspect(
    aspect: str,
    template: dict[str, Any],
    *,
    step: Optional[int] = None,
) -> dict[str, int]:
    """Fit the target aspect ratio inside the model's default width/height box."""
    ratio = parse_aspect_ratio(aspect)
    if ratio is None:
        return {
            "width": int(template.get("width", 480)),
            "height": int(template.get("height", 704)),
        }

    align = step or alignment_step(str(template.get("engine", "")))
    max_w = int(template.get("width", 480))
    max_h = int(template.get("height", 704))
    box_ratio = max_w / max_h

    if ratio >= box_ratio:
        width = max_w
        height = _align(max_w / ratio, align)
    else:
        height = max_h
        width = _align(max_h * ratio, align)

    return {"width": width, "height": height}


def align_dimensions(width: int, height: int, engine: str) -> dict[str, int]:
    """Snap width/height to the engine's pixel grid without changing aspect much."""
    step = alignment_step(engine)
    return {
        "width": _align(width, step),
        "height": _align(height, step),
    }


def parse_resolution(resolution: str, template: dict[str, Any]) -> Optional[dict[str, int]]:
    """Parse '720p' or '1280x720' into width/height."""
    value = resolution.strip().lower()
    if not value or value == "720p":
        return None

    match = re.fullmatch(r"(\d+)x(\d+)", value)
    if match:
        return align_dimensions(
            int(match.group(1)),
            int(match.group(2)),
            str(template.get("engine", "")),
        )

    p_match = re.fullmatch(r"(\d+)p", value)
    if p_match:
        align = alignment_step(str(template.get("engine", "")))
        short_edge = int(p_match.group(1))
        ratio = parse_aspect_ratio(str(template.get("aspect_ratio", "16:9"))) or (16 / 9)
        if ratio >= 1:
            height = short_edge
            width = _align(height * ratio, align)
        else:
            width = short_edge
            height = _align(width / ratio, align)
        return {"width": width, "height": height}

    return None


def wan_num_frames(duration_seconds: float, fps: int) -> int:
    """Wan checkpoints expect frame counts of the form 4n+1."""
    target = max(5, round(duration_seconds * fps))
    n = round((target - 1) / 4)
    return max(5, 4 * n + 1)


def generic_num_frames(duration_seconds: float, fps: int) -> int:
    return max(9, round(duration_seconds * fps))


def frames_to_duration(num_frames: int, fps: int) -> float:
    if fps <= 0:
        return 0.0
    return round(num_frames / fps, 1)


def apply_video_presets(model: dict[str, Any], metadata: dict[str, Any]) -> dict[str, Any]:
    """Merge job metadata presets into a copy of the registry model entry."""
    merged = dict(model)
    engine = str(model.get("engine", ""))

    aspect_ratio = metadata.get("aspect_ratio")
    resolution = metadata.get("resolution")

    if aspect_ratio and str(aspect_ratio).lower() not in AUTO_ASPECT_VALUES:
        merged.update(dimensions_for_aspect(str(aspect_ratio), model))
    elif resolution:
        dims = parse_resolution(str(resolution), model)
        if dims:
            merged.update(dims)

    fps = metadata.get("fps")
    duration = metadata.get("duration")
    base_fps = int(fps if fps is not None else model.get("fps", 24))
    base_frames = int(model.get("num_frames", 41))

    if duration is not None:
        duration_seconds = float(duration)
    else:
        duration_seconds = frames_to_duration(base_frames, base_fps)

    if "wan" in engine:
        merged["num_frames"] = wan_num_frames(duration_seconds, base_fps)
    else:
        merged["num_frames"] = generic_num_frames(duration_seconds, base_fps)

    merged["fps"] = base_fps
    return merged


def preset_summary(model: dict[str, Any]) -> str:
    """Human-readable line for job status / UI echo."""
    width = model.get("width", "?")
    height = model.get("height", "?")
    fps = int(model.get("fps", 24))
    frames = int(model.get("num_frames", 0))
    seconds = frames_to_duration(frames, fps)
    return f"{width} × {height} · ~{seconds:g}s @ {fps}fps"