"""Extract still frames from generated videos via ffmpeg."""

from __future__ import annotations

import subprocess
from pathlib import Path

from app.services.mlx.paths import job_output_dir


class FrameExtractError(Exception):
    pass


def extract_last_frame(video_path: Path, *, job_id: str, label: str = "last_frame") -> Path:
    """Grab the final frame from a completed MP4 for chained continuation."""
    if not video_path.is_file():
        raise FrameExtractError(f"Video not found: {video_path}")

    out_dir = job_output_dir(job_id)
    frame_path = out_dir / f"{label}.png"

    cmd = [
        "ffmpeg",
        "-y",
        "-sseof",
        "-0.25",
        "-i",
        str(video_path),
        "-update",
        "1",
        "-q:v",
        "2",
        "-frames:v",
        "1",
        str(frame_path),
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except FileNotFoundError as exc:
        raise FrameExtractError("ffmpeg is required for frame extraction but was not found") from exc

    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        raise FrameExtractError(stderr or "ffmpeg failed to extract the last frame")

    if not frame_path.is_file():
        raise FrameExtractError("ffmpeg finished but no frame image was produced")

    return frame_path