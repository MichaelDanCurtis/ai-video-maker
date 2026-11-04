"""Download MLX model weights from Hugging Face."""

from __future__ import annotations

import subprocess
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from app.config import get_settings
from app.services.mlx.paths import (
    _mflux_bundle_ready,
    lora_weights_ready,
    model_weights_ready,
    models_dir,
    resolve_image_base_weights_dir,
    resolve_lora_weights_path,
    resolve_video_model_dir,
)
from app.services.mlx.registry import get_registry


class DownloadStatus(str, Enum):
    PENDING = "pending"
    DOWNLOADING = "downloading"
    CONVERTING = "converting"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class DownloadJob:
    id: str
    model_id: str
    kind: str
    status: DownloadStatus = DownloadStatus.PENDING
    message: str = "Queued"
    error: Optional[str] = None
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: Optional[datetime] = None


_lock = threading.Lock()
_jobs: dict[str, DownloadJob] = {}


def _mlx_python() -> str:
    settings = get_settings()
    if settings.mlx_python:
        return settings.mlx_python
    return "python3"


def _hf_env() -> dict[str, str]:
    import os

    env = os.environ.copy()
    settings = get_settings()
    if settings.hf_home:
        env["HF_HOME"] = settings.hf_home
    if settings.hf_token:
        env["HF_TOKEN"] = settings.hf_token
        env["HUGGING_FACE_HUB_TOKEN"] = settings.hf_token
    return env


def _snapshot_download(repo_id: str, local_dir: str, *, include: Optional[list[str]] = None) -> None:
    from huggingface_hub import snapshot_download

    kwargs: dict[str, Any] = {
        "repo_id": repo_id,
        "local_dir": local_dir,
        "local_dir_use_symlinks": False,
    }
    if include:
        kwargs["allow_patterns"] = include
    settings = get_settings()
    if settings.hf_token:
        kwargs["token"] = settings.hf_token
    snapshot_download(**kwargs)


def _convert_wan(pytorch_dir: str, mlx_dir: str) -> None:
    python = _mlx_python()
    subprocess.run(
        [
            python,
            "-m",
            "mlx_video.models.wan_2.convert",
            "--checkpoint-dir",
            pytorch_dir,
            "--output-dir",
            mlx_dir,
            "--quantize",
            "--bits",
            "4",
            "--group-size",
            "64",
        ],
        check=True,
        env=_hf_env(),
    )


def _resolve_entry(model_id: str, kind: str) -> dict[str, Any]:
    registry = get_registry()
    if kind == "image":
        return registry.get_image(model_id)
    if kind == "video":
        return registry.get_video(model_id)
    raise KeyError(f"Unknown kind: {kind}")


def _run_download(job: DownloadJob) -> None:
    try:
        entry = _resolve_entry(job.model_id, job.kind)
        if model_weights_ready(entry, kind=job.kind):
            job.status = DownloadStatus.COMPLETED
            job.message = "Already downloaded"
            job.finished_at = datetime.now(timezone.utc)
            return

        engine = entry.get("engine", "")
        weights_root = models_dir()

        if job.kind == "image":
            repo = entry.get("huggingface_model")
            if not repo:
                raise ValueError(f"No huggingface_model for {job.model_id}")

            base_dest = resolve_image_base_weights_dir(entry)
            if not _mflux_bundle_ready(base_dest):
                job.status = DownloadStatus.DOWNLOADING
                job.message = f"Downloading base weights {repo}..."
                base_dest.mkdir(parents=True, exist_ok=True)
                _snapshot_download(repo, str(base_dest))

            lora_repo = entry.get("lora_huggingface_repo")
            if lora_repo and not lora_weights_ready(entry):
                lora_path = resolve_lora_weights_path(entry)
                if lora_path is None:
                    raise ValueError(f"Missing lora_local_subdir for {job.model_id}")
                job.status = DownloadStatus.DOWNLOADING
                job.message = f"Downloading NSFW LoRA {lora_repo}..."
                lora_path.parent.mkdir(parents=True, exist_ok=True)
                include = [entry.get("lora_filename", "lora.safetensors")]
                _snapshot_download(lora_repo, str(lora_path.parent), include=include)

        elif engine == "mlx-video-ltx2":
            repo = entry.get("model_repo", "prince-canuma/LTX-2-distilled")
            dest = weights_root / (entry.get("local_dir") or "ltx2-distilled")
            job.status = DownloadStatus.DOWNLOADING
            job.message = f"Downloading {repo}..."
            dest.mkdir(parents=True, exist_ok=True)
            _snapshot_download(repo, str(dest))

        elif engine.startswith("mlx-video-wan"):
            pytorch_repo = entry.get("pytorch_repo")
            if not pytorch_repo:
                raise ValueError(f"No pytorch_repo for {job.model_id}")
            mlx_dir = resolve_video_model_dir(entry)
            pytorch_name = entry.get("model_dir_name", entry["id"]).replace("_mlx", "_pytorch")
            pytorch_dir = weights_root / pytorch_name

            job.status = DownloadStatus.DOWNLOADING
            job.message = f"Downloading {pytorch_repo} (large)..."
            pytorch_dir.mkdir(parents=True, exist_ok=True)
            _snapshot_download(pytorch_repo, str(pytorch_dir))

            job.status = DownloadStatus.CONVERTING
            job.message = "Converting PyTorch weights to MLX..."
            mlx_dir.mkdir(parents=True, exist_ok=True)
            _convert_wan(str(pytorch_dir), str(mlx_dir))

            if entry.get("lightning_lora"):
                lora_dest = weights_root / "lightning_lora"
                job.message = "Downloading Lightning LoRA (optional)..."
                try:
                    _snapshot_download(
                        "lightx2v/Wan2.2-Lightning",
                        str(lora_dest),
                        include=["Wan2.2-T2V-A14B-4steps-lora-rank64-Seko-V2.0/*"],
                    )
                except Exception:
                    pass

        else:
            raise ValueError(f"Unsupported model engine: {engine}")

        if not model_weights_ready(entry, kind=job.kind):
            raise RuntimeError("Download finished but weights are not ready")

        job.status = DownloadStatus.COMPLETED
        job.message = "Ready"
        job.finished_at = datetime.now(timezone.utc)

    except Exception as exc:
        job.status = DownloadStatus.FAILED
        job.error = str(exc)
        job.message = "Download failed"
        job.finished_at = datetime.now(timezone.utc)


def start_model_download(*, model_id: str, kind: str) -> DownloadJob:
    """Start a background Hugging Face download for a registry model."""
    _resolve_entry(model_id, kind)

    with _lock:
        for existing in _jobs.values():
            if (
                existing.model_id == model_id
                and existing.kind == kind
                and existing.status in (DownloadStatus.PENDING, DownloadStatus.DOWNLOADING, DownloadStatus.CONVERTING)
            ):
                return existing

        job = DownloadJob(id=str(uuid.uuid4()), model_id=model_id, kind=kind)
        _jobs[job.id] = job

    thread = threading.Thread(target=_run_download, args=(job,), daemon=True)
    thread.start()
    return job


def get_download_job(download_id: str) -> Optional[DownloadJob]:
    with _lock:
        return _jobs.get(download_id)