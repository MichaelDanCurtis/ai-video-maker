"""Subprocess runner for mlx-video Wan generation."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Optional

from app.config import get_settings
from app.services.mlx.paths import job_output_dir, models_dir, resolve_video_model_dir


class VideoRunnerError(Exception):
    pass


def _mlx_python() -> str:
    settings = get_settings()
    return (
        settings.mlx_python
        or shutil.which("python3.12")
        or shutil.which("python3.11")
        or shutil.which("python3")
        or "python3"
    )


def _resolve_ltx_model_repo(model: dict[str, Any]) -> str:
    local_name = model.get("local_dir") or "ltx2-distilled"
    local = models_dir() / local_name
    if local.is_dir() and (local / "config.json").is_file():
        return str(local)
    return str(model.get("model_repo", "prince-canuma/LTX-2-distilled"))


def _lightning_lora_paths() -> tuple[Optional[Path], Optional[Path]]:
    """Return high/low Lightning LoRA paths if present under models dir."""
    base = models_dir() / "lightning_lora"
    high = base / "Wan2.2-T2V-A14B-4steps-lora-rank64-Seko-V2.0" / "high_noise_model.safetensors"
    low = base / "Wan2.2-T2V-A14B-4steps-lora-rank64-Seko-V2.0" / "low_noise_model.safetensors"
    if high.exists() and low.exists():
        return high, low
    return None, None


def build_wan_command(
    *,
    model: dict[str, Any],
    prompt: str,
    output_path: Path,
    image_path: Optional[Path] = None,
    negative_prompt: str = "",
    seed: Optional[int] = None,
) -> list[str]:
    model_dir = resolve_video_model_dir(model)
    python = _mlx_python()

    cmd = [
        python,
        "-m",
        "mlx_video.wan_2.generate",
        "--model-dir",
        str(model_dir),
        "--prompt",
        prompt,
        "--width",
        str(model.get("width", 480)),
        "--height",
        str(model.get("height", 704)),
        "--num-frames",
        str(model.get("num_frames", 41)),
        "--steps",
        str(model.get("steps", 4)),
        "--guide-scale",
        str(model.get("guide_scale", "1")),
        "--output-path",
        str(output_path),
    ]

    if negative_prompt:
        cmd.extend(["--negative-prompt", negative_prompt])

    if image_path and image_path.exists():
        cmd.extend(["--image", str(image_path)])

    if seed is not None and seed >= 0:
        cmd.extend(["--seed", str(seed)])

    if model.get("lightning_lora"):
        high, low = _lightning_lora_paths()
        if high and low:
            cmd.extend(
                [
                    "--lora-high",
                    str(high),
                    "1",
                    "--lora-low",
                    str(low),
                    "1",
                    "--trim-first-frames",
                    "1",
                ]
            )

    return cmd


def build_ltx_command(
    *,
    model: dict[str, Any],
    prompt: str,
    output_path: Path,
    image_path: Optional[Path] = None,
) -> list[str]:
    python = _mlx_python()
    cmd = [
        python,
        "-m",
        "mlx_video.ltx_2.generate",
        "--prompt",
        prompt,
        "--width",
        str(model.get("width", 768)),
        "--height",
        str(model.get("height", 512)),
        "--num-frames",
        str(model.get("num_frames", 97)),
        "--fps",
        str(model.get("fps", 24)),
        "--output",
        str(output_path),
        "--model-repo",
        _resolve_ltx_model_repo(model),
        "--pipeline",
        str(model.get("pipeline", "distilled")),
    ]
    if image_path and image_path.exists():
        cmd.extend(["--image", str(image_path)])
    return cmd


def run_video_generation(
    *,
    job_id: str,
    model: dict[str, Any],
    prompt: str,
    image_path: Optional[Path] = None,
    negative_prompt: str = "",
    seed: Optional[int] = None,
) -> Path:
    settings = get_settings()
    out_dir = job_output_dir(job_id)
    output_path = out_dir / "result.mp4"
    engine = model.get("engine", "mlx-video-wan-i2v")

    if engine == "mlx-video-ltx2":
        cmd = build_ltx_command(
            model=model,
            prompt=prompt,
            output_path=output_path,
            image_path=image_path,
        )
    else:
        cmd = build_wan_command(
            model=model,
            prompt=prompt,
            output_path=output_path,
            image_path=image_path,
            negative_prompt=negative_prompt,
            seed=seed,
        )

    env = os.environ.copy()
    if settings.hf_home:
        env["HF_HOME"] = settings.hf_home
    env["PYTHONUNBUFFERED"] = "1"
    if settings.mlx_python:
        mlx_bin = str(Path(settings.mlx_python).parent)
        env["PATH"] = f"{mlx_bin}{os.pathsep}{env.get('PATH', '')}"

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            env=env,
            timeout=settings.mlx_job_timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise VideoRunnerError(f"Video generation timed out after {settings.mlx_job_timeout_seconds}s") from exc

    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        detail = stderr or stdout or f"exit code {result.returncode}"
        raise VideoRunnerError(detail)

    if not output_path.exists():
        candidates = sorted(out_dir.glob("*.mp4"))
        if candidates:
            candidates[0].rename(output_path)
        else:
            raise VideoRunnerError("mlx-video finished but no output video was produced")

    return output_path