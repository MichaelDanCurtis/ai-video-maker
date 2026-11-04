"""Stitch multiple generated clips into one video via ffmpeg."""

from __future__ import annotations

import subprocess
import uuid
from pathlib import Path

from app.config import get_settings
from app.services.mlx.paths import job_output_dir, media_url_for, outputs_dir


class ConcatError(Exception):
    """Raised when clip stitching fails."""


def _resolve_media_path(media_url: str) -> Path:
    """Map /media/... URL to an on-disk path under outputs_dir."""
    settings = get_settings()
    prefix = settings.media_url_prefix.rstrip("/")
    clean = media_url.strip()

    if clean.startswith(prefix + "/"):
        relative = clean[len(prefix) + 1 :]
    elif clean.startswith("/media/"):
        relative = clean[len("/media/") :]
    else:
        raise ConcatError(f"Invalid media URL (must start with {prefix}/): {media_url}")

    if ".." in relative.split("/"):
        raise ConcatError("Path traversal is not allowed")

    path = (outputs_dir() / relative).resolve()
    root = outputs_dir().resolve()
    if not str(path).startswith(str(root)):
        raise ConcatError("Media path is outside outputs directory")
    if not path.is_file():
        raise ConcatError(f"Video file not found: {relative}")
    return path


def concat_videos(media_urls: list[str], *, project_name: str | None = None) -> tuple[str, str, float]:
    """
    Concatenate clips in order. Returns (job_id, result_media_url, total_duration_sec).
    """
    if len(media_urls) < 2:
        raise ConcatError("At least two clips are required to stitch a project")

    paths = [_resolve_media_path(url) for url in media_urls]
    for path in paths:
        if path.suffix.lower() not in {".mp4", ".mov", ".webm", ".mkv"}:
            raise ConcatError(f"Unsupported video format: {path.name}")

    job_id = f"project_{uuid.uuid4().hex[:12]}"
    out_dir = job_output_dir(job_id)
    list_file = out_dir / "concat_list.txt"
    output_path = out_dir / "stitched.mp4"

    lines = [f"file '{path.as_posix()}'" for path in paths]
    list_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(list_file),
        "-c",
        "copy",
        str(output_path),
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )
    except FileNotFoundError as exc:
        raise ConcatError(
            "ffmpeg is not installed. Install it with: brew install ffmpeg"
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise ConcatError("ffmpeg timed out while stitching clips") from exc

    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        raise ConcatError(stderr[-500:] if stderr else "ffmpeg failed to stitch clips")

    if not output_path.is_file():
        raise ConcatError("Stitched output was not created")

    total_duration = _probe_duration(output_path)
    return job_id, media_url_for(output_path), total_duration


def _probe_duration(path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, check=False)
        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
    except (FileNotFoundError, ValueError, subprocess.TimeoutExpired):
        pass
    return 0.0