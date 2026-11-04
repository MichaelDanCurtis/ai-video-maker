"""Background worker that processes MLX generation jobs one at a time."""

from __future__ import annotations

import logging
import random
import threading
from pathlib import Path
from typing import Any, Optional

from app.config import get_settings
from app.services.mlx.jobs import GenerationJob, JobKind, JobState, JobStore
from app.services.mlx.paths import jobs_dir, media_url_for, uploads_dir
from app.services.mlx.registry import get_registry
from app.services.mlx.model_routing import (
    ModelRoutingError,
    assert_model_ready,
    merge_video_dimensions,
    resolve_video_model_for_job,
    video_dimensions_from_image,
)
from app.services.mlx.video_presets import AUTO_ASPECT_VALUES, apply_video_presets
from app.services.mlx.nsfw import prepare_image_generation
from app.services.mlx.runner_image import (
    ImageRunnerError,
    apply_image_metadata_overrides,
    run_image_generation,
    run_image_redux,
)
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


def _seeds_for_job(metadata: dict[str, Any]) -> list[Optional[int]]:
    """Resolve seed list for batch stills or seed-walk variants."""
    n = max(1, int(metadata.get("n", 1)))
    seed_walk = metadata.get("seed_walk")
    if seed_walk:
        count = max(1, int(seed_walk))
        base = metadata.get("seed")
        if base is not None:
            return [int(base) + i for i in range(count)]
        return [random.randint(0, 2**31 - 1) for _ in range(count)]
    if n > 1:
        base = metadata.get("seed")
        if base is not None:
            return [int(base) + i for i in range(n)]
        return [random.randint(0, 2**31 - 1) for _ in range(n)]
    seed = metadata.get("seed")
    return [int(seed) if seed is not None else None]


def _maybe_refine_image(
    *,
    job: GenerationJob,
    image_path: Path,
    store: JobStore,
) -> Path:
    """Optional Flux Redux refine before video animation."""
    refine_prompt = job.metadata.get("refine_prompt")
    refine_strength = float(job.metadata.get("refine_strength", 0.0))
    if not refine_prompt or refine_strength <= 0.0:
        return image_path

    settings = get_settings()
    registry = get_registry()
    image_model_id = (
        job.metadata.get("refine_image_model_id")
        or job.metadata.get("image_model_id")
        or settings.default_image_model
    )
    image_model = registry.get_image(image_model_id)
    nsfw_mode = bool(job.metadata.get("nsfw_mode", settings.default_nsfw_mode))
    image_model, prompt, _negative = prepare_image_generation(
        model=apply_image_metadata_overrides(image_model, job.metadata),
        prompt=str(refine_prompt),
        nsfw_mode=nsfw_mode,
        negative_prompt=job.metadata.get("negative_prompt"),
    )
    job.progress = max(job.progress, 20.0)
    store.save(job)

    refined = run_image_redux(
        job_id=job.id,
        model=image_model,
        prompt=prompt,
        init_image_path=image_path,
        strength=refine_strength,
        seed=job.metadata.get("seed"),
        size=job.metadata.get("size"),
        output_name="refined.png",
    )
    job.metadata["refined_image"] = str(refined)
    return refined


def _process_image_job(job: GenerationJob, store: JobStore, registry) -> None:
    if job.metadata.get("refine_mode"):
        source_path = job.metadata.get("refine_source_path")
        if not source_path or not Path(source_path).is_file():
            raise ImageRunnerError("Refine source image is missing on disk")

        model = registry.get_image(job.model_id)
        nsfw_mode = bool(job.metadata.get("nsfw_mode", False))
        model, prompt, _negative = prepare_image_generation(
            model=apply_image_metadata_overrides(model, job.metadata),
            prompt=job.prompt,
            nsfw_mode=nsfw_mode,
            negative_prompt=job.metadata.get("negative_prompt"),
        )
        result = run_image_redux(
            job_id=job.id,
            model=model,
            prompt=prompt,
            init_image_path=Path(source_path),
            strength=float(job.metadata.get("refine_strength", 0.45)),
            seed=job.metadata.get("seed"),
            size=job.metadata.get("size"),
            output_name="result.png",
        )
        job.result_path = str(result)
        job.result_url = media_url_for(result)
        job.progress = 100.0
        job.state = JobState.COMPLETED
        return

    model = registry.get_image(job.model_id)
    size = job.metadata.get("size")
    nsfw_mode = bool(job.metadata.get("nsfw_mode", False))
    model, prompt, negative = prepare_image_generation(
        model=apply_image_metadata_overrides(model, job.metadata),
        prompt=job.prompt,
        nsfw_mode=nsfw_mode,
        negative_prompt=job.metadata.get("negative_prompt"),
    )

    seeds = _seeds_for_job(job.metadata)
    result_paths: list[Path] = []
    total = len(seeds)

    for index, seed in enumerate(seeds):
        job.progress = 5.0 + (85.0 * index / max(total, 1))
        store.save(job)
        suffix = f"_{index}" if total > 1 else ""
        out_dir = Path(job.result_path).parent if job.result_path else None
        custom_name = f"result{suffix}.png" if total > 1 else "result.png"

        result = run_image_generation(
            job_id=job.id,
            model=model,
            prompt=prompt,
            size=size,
            seed=seed,
            negative_prompt=negative or None,
            output_name=custom_name,
        )
        result_paths.append(result)

    primary = result_paths[0]
    job.result_path = str(primary)
    job.result_url = media_url_for(primary)
    if len(result_paths) > 1:
        job.metadata["result_paths"] = [str(p) for p in result_paths]
        job.metadata["result_urls"] = [media_url_for(p) for p in result_paths]
    job.progress = 100.0
    job.state = JobState.COMPLETED


def _process_video_job(job: GenerationJob, store: JobStore, registry, settings) -> None:
    requested_model = registry.get_video(job.model_id)
    image_path: Optional[Path] = None

    if job.kind != JobKind.TEXT_TO_VIDEO:
        upload = job.metadata.get("input_image_path")
        if upload:
            image_path = Path(upload)

    pure_t2v = bool(job.metadata.get("pure_t2v", False))
    skip_keyframe = pure_t2v or bool(job.metadata.get("skip_keyframe", False))

    has_image = image_path is not None and image_path.exists()
    route_with_image = has_image or (job.kind == JobKind.TEXT_TO_VIDEO and not skip_keyframe)

    aspect_choice = str(job.metadata.get("aspect_ratio", "")).lower()
    use_source_aspect = aspect_choice in AUTO_ASPECT_VALUES

    video_model = resolve_video_model_for_job(
        requested_model,
        has_image=route_with_image,
    )
    video_model = apply_video_presets(video_model, job.metadata)

    if job.kind == JobKind.TEXT_TO_VIDEO and not skip_keyframe:
        image_model_id = (
            job.metadata.get("image_model_id")
            or requested_model.get("image_model_id")
            or registry.defaults.get("image")
        )
        image_model = registry.get_image(image_model_id)
        nsfw_mode = bool(job.metadata.get("nsfw_mode", settings.default_nsfw_mode))
        image_model, t2v_prompt, t2v_negative = prepare_image_generation(
            model=apply_image_metadata_overrides(image_model, job.metadata),
            prompt=job.prompt,
            nsfw_mode=nsfw_mode,
            negative_prompt=job.metadata.get("negative_prompt"),
        )
        job.progress = 15.0
        store.save(job)
        image_path = run_image_generation(
            job_id=job.id,
            model=image_model,
            prompt=t2v_prompt,
            size=f"{video_model.get('width', 480)}x{video_model.get('height', 704)}",
            seed=job.metadata.get("seed"),
            negative_prompt=t2v_negative or None,
        )
        job.metadata["source_image"] = str(image_path)
        job.progress = 45.0
        store.save(job)
        has_image = image_path.exists()

    if has_image and image_path is not None:
        image_path = _maybe_refine_image(job=job, image_path=image_path, store=store)
        if use_source_aspect:
            video_model = merge_video_dimensions(
                video_model,
                video_dimensions_from_image(image_path, video_model),
            )

    assert_model_ready(video_model, kind="video")

    job.progress = max(job.progress, 50.0)
    store.save(job)

    motion_negative = (
        job.metadata.get("motion_negative_prompt")
        or job.metadata.get("negative_prompt", "")
        or ""
    )

    result = run_video_generation(
        job_id=job.id,
        model=video_model,
        prompt=job.prompt,
        image_path=image_path if has_image else None,
        negative_prompt=str(motion_negative),
        seed=job.metadata.get("seed"),
        motion_strength=job.metadata.get("motion_strength"),
    )
    job.result_path = str(result)
    job.result_url = media_url_for(result)

    thumb = result.with_suffix(".png")
    if not thumb.exists():
        source = job.metadata.get("refined_image") or job.metadata.get("source_image") or job.metadata.get("input_image_path")
        if source and Path(source).exists():
            job.thumbnail_url = media_url_for(Path(source))
    else:
        job.thumbnail_url = media_url_for(thumb)

    job.progress = 100.0
    job.state = JobState.COMPLETED


def _process_job(job: GenerationJob) -> None:
    store = get_job_store()
    registry = get_registry()
    settings = get_settings()

    job.state = JobState.PROCESSING
    job.progress = 5.0
    store.save(job)

    try:
        if job.kind == JobKind.IMAGE:
            _process_image_job(job, store, registry)

        elif job.kind in (JobKind.VIDEO, JobKind.PHOTO_TO_VIDEO, JobKind.TEXT_TO_VIDEO):
            _process_video_job(job, store, registry, settings)
        else:
            raise RuntimeError(f"Unsupported job kind: {job.kind}")

    except (ImageRunnerError, VideoRunnerError, ModelRoutingError, KeyError, RuntimeError) as exc:
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