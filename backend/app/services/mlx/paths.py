"""Filesystem paths for MLX inference artifacts."""

from __future__ import annotations

from pathlib import Path

from app.config import get_settings


def project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent.parent.parent


def data_root() -> Path:
    settings = get_settings()
    root = Path(settings.data_dir)
    if not root.is_absolute():
        root = project_root() / root
    root.mkdir(parents=True, exist_ok=True)
    return root


def jobs_dir() -> Path:
    path = data_root() / "jobs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def outputs_dir() -> Path:
    path = data_root() / "outputs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def uploads_dir() -> Path:
    path = data_root() / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path


def models_dir() -> Path:
    settings = get_settings()
    root = Path(settings.mlx_models_dir)
    if not root.is_absolute():
        root = project_root() / root
    root.mkdir(parents=True, exist_ok=True)
    return root


def job_output_dir(job_id: str) -> Path:
    path = outputs_dir() / job_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def media_url_for(path: Path) -> str:
    """Convert an on-disk output path to a browser-served /media URL."""
    settings = get_settings()
    try:
        relative = path.resolve().relative_to(outputs_dir().resolve())
    except ValueError:
        relative = path.name
    return f"{settings.media_url_prefix.rstrip('/')}/{relative.as_posix()}"


def resolve_video_model_dir(model_entry: dict) -> Path:
    name = model_entry.get("model_dir_name") or model_entry.get("id", "wan_model")
    return models_dir() / name