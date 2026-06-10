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


def resolve_image_model_dir(model_entry: dict) -> Path:
    """Local weights directory for an image model (matches download_models.sh layout)."""
    name = model_entry.get("local_dir") or model_entry.get("id", "flux_model")
    return models_dir() / name


def _mflux_bundle_ready(path: Path) -> bool:
    """True when an mflux-native bundle has core component dirs with weights."""
    if not path.is_dir():
        return False
    if list(path.rglob("*.incomplete")):
        return False
    for component in ("vae", "transformer"):
        component_dir = path / component
        if not component_dir.is_dir():
            return False
        if not list(component_dir.glob("*.safetensors")) and not list(
            component_dir.rglob("*.safetensors")
        ):
            return False
    return True


def _has_complete_weights(path: Path) -> bool:
    """True when weights exist locally (mflux bundle or mlx-video tree)."""
    if _mflux_bundle_ready(path):
        return True
    if not path.is_dir():
        return False
    safetensors = list(path.rglob("*.safetensors"))
    if not safetensors:
        return False
    return len(list(path.rglob("*.incomplete"))) == 0


def resolve_image_model_path(model_entry: dict) -> str:
    """Prefer on-disk mflux bundle; fall back to HuggingFace repo id."""
    local = resolve_image_model_dir(model_entry)
    if _mflux_bundle_ready(local):
        return str(local)
    return model_entry.get("huggingface_model") or model_entry.get("model_path") or str(local)


def _wan_mlx_ready(path: Path) -> bool:
    return (
        path.is_dir()
        and (path / "config.json").is_file()
        and (path / "t5_encoder.safetensors").is_file()
        and not list(path.rglob("*.incomplete"))
    )


def model_weights_ready(model_entry: dict, *, kind: str = "image") -> bool:
    if kind == "image":
        return _mflux_bundle_ready(resolve_image_model_dir(model_entry))
    engine = model_entry.get("engine", "")
    if engine == "mlx-video-ltx2":
        local = models_dir() / (model_entry.get("local_dir") or "ltx2-distilled")
        return local.is_dir() and (local / "config.json").is_file()
    video_dir = resolve_video_model_dir(model_entry)
    return _wan_mlx_ready(video_dir)