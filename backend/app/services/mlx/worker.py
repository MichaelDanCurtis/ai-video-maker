"""Background worker that processes MLX generation jobs one at a time."""

from __future__ import annotations

import asyncio
import logging
import threading
from pathlib import Path
from typing import Optional

from app.config import get_settings
from app.services.mlx.jobs import GenerationJob, JobKind, JobState, JobStore
from app.services.mlx.paths import jobs_dir, media_url_for, uploads_dir
from app.services.mlx.registry import get_registry
from app.services.mlx.runner_image import ImageRunnerError, run_image_generation
from app.services.mlx.runner_video import VideoRunnerError, run_video_generation

logger = logging.getLogger(__name__)

_store: Optional[JobStore] = None
_worker_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()
_lock = threading.Lock()


def get_job_store() -> JobStore:
    global _store
    if _store is None:
        _store = JobStore(jobs_dir())
    return _store


def _process_job(job: GenerationJob) -> None:
    store = get_job_store()
    registry = get_registry()
    settings = get_settings()

    job.state = JobState.PROCESSING
    job.progress = 5.0
    store.save(job)

    try:
        if job.kind == JobKind.IMAGE:
            model = registry.get_image(job.model_id)
            size = job.metadata.get("size")
            result = run_image_generation(
                job_id=job.id,
                model=model,
                prompt=job.prompt,
                size=size,
                seed=job.metadata.get("seed"),
            )
            job.result_path = str(result)
            job.result_url = media_url_for(result)
            job.progress = 100.0
            job.state = JobState.COMPLETED

        elif job.kind in (JobKind.VIDEO, JobKind.PHOTO_TO_VIDEO, JobKind.TEXT_TO_VIDEO):
            video_model = registry.get_video(job.model_id)

            if job.kind == JobKind.TEXT_TO_VIDEO:
                image_model_id = video_model.get("image_model_id") or registry.defaults.get("image")
                image_model = registry.get_image(image_model_id)
                job.progress = 15.0
                store.save(job)
                image_path = run_image_generation(
                    job_id=job.id,
                    model=image_model,
                    prompt=job.prompt,
                    size=f"{video_model.get('width', 480)}x{video_model.get('height', 704)}",
                )
                job.metadata["source_image"] = str(image_path)
                job.progress = 45.0
                store.save(job)
            else:
                image_path = None
                upload = job.metadata.get("input_image_path")
                if upload:
                    image_path = Path(upload)

            job.progress = max(job.progress, 50.0)
            store.save(job)

            result = run_video_generation(
                job_id=job.id,
                model=video_model,
                prompt=job.prompt,
                image_path=image_path,
                negative_prompt=job.metadata.get("negative_prompt", ""),
                seed=job.metadata.get("seed"),
            )
            job.result_path = str(result)
            job.result_url = media_url_for(result)

            thumb = result.with_suffix(".png")
            if not thumb.exists():
                source = job.metadata.get("source_image") or job.metadata.get("input_image_path")
                if source and Path(source).exists():
                    job.thumbnail_url = media_url_for(Path(source))
            else:
                job.thumbnail_url = media_url_for(thumb)

            job.progress = 100.0
            job.state = JobState.COMPLETED
        else:
            raise RuntimeError(f"Unsupported job kind: {job.kind}")

    except (ImageRunnerError, VideoRunnerError, KeyError, RuntimeError) as exc:
        logger.exception("Job %s failed", job.id)
        job.state = JobState.FAILED
        job.error = str(exc)
        job.progress = 0.0
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected failure for job %s", job.id)
        job.state = JobState.FAILED
        job.error = f"Unexpected error: {exc}"
        job.progress = 0.0

    store.save(job)


def _worker_loop() -> None:
    store = get_job_store()
    settings = get_settings()
    poll = max(0.5, settings.mlx_worker_poll_seconds)

    while not _stop_event.is_set():
        pending = store.list_pending()
        if pending:
            job = pending[0]
            logger.info("Processing MLX job %s (%s)", job.id, job.kind.value)
            _process_job(job)
        else:
            _stop_event.wait(poll)


def start_worker() -> None:
    global _worker_thread
    settings = get_settings()
    if not settings.mlx_enabled:
        logger.info("MLX worker disabled (mlx_enabled=false)")
        return

    with _lock:
        if _worker_thread and _worker_thread.is_alive():
            return
        _stop_event.clear()
        _worker_thread = threading.Thread(
            target=_worker_loop,
            name="mlx-worker",
            daemon=True,
        )
        _worker_thread.start()
        logger.info("MLX background worker started")


def stop_worker() -> None:
    _stop_event.set()
    global _worker_thread
    if _worker_thread and _worker_thread.is_alive():
        _worker_thread.join(timeout=5.0)
    _worker_thread = None


def save_upload_for_job(job_id: str, filename: str, content: bytes) -> Path:
    job_upload_dir = uploads_dir() / job_id
    job_upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(filename).suffix or ".png"
    path = job_upload_dir / f"input{suffix}"
    path.write_bytes(content)
    return path


async def enqueue_job(job: GenerationJob) -> GenerationJob:
    """Persist job; worker picks it up asynchronously."""
    store = get_job_store()
    store.save(job)
    return job