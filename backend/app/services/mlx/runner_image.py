"""Subprocess runner for mflux image generation."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Optional

from app.config import get_settings
from app.services.mlx.paths import job_output_dir, resolve_image_model_path


class ImageRunnerError(Exception):
    pass


def _parse_size(size: Optional[str], default_w: int, default_h: int) -> tuple[int, int]:
    if not size or "x" not in size:
        return default_w, default_h
    parts = size.lower().split("x", 1)
    try:
        return int(parts[0]), int(parts[1])
    except ValueError:
        return default_w, default_h


def _mlx_bin_dir() -> Optional[Path]:
    settings = get_settings()
    if settings.mlx_python:
        # Do not resolve(): venv python is often a symlink to Homebrew.
        return Path(settings.mlx_python).parent
    return None


def _mflux_binary(name: str = "mflux-generate") -> str:
    settings = get_settings()
    if settings.mflux_binary and name == "mflux-generate":
        return settings.mflux_binary

    bin_dir = _mlx_bin_dir()
    if bin_dir:
        candidate = bin_dir / name
        if candidate.exists():
            return str(candidate)

    found = shutil.which(name)
    if found:
        return found

    return name


def build_image_command(
    *,
    model: dict[str, Any],
    prompt: str,
    output_path: Path,
    size: Optional[str] = None,
    seed: Optional[int] = None,
) -> list[str]:
    engine = model.get("engine", "mflux-flux")
    width, height = _parse_size(
        size,
        int(model.get("default_width", 768)),
        int(model.get("default_height", 1024)),
    )
    steps = int(model.get("steps", 20))
    quantize = int(model.get("quantize", 8))
    hf_model = resolve_image_model_path(model)

    if engine == "mflux-z-image":
        cmd = [
            _mflux_binary("mflux-generate-z-image-turbo"),
            "--model",
            hf_model,
            "--prompt",
            prompt,
            "--steps",
            str(steps),
            "-q",
            str(quantize),
            "--width",
            str(width),
            "--height",
            str(height),
            "--output",
            str(output_path),
        ]
    else:
        cmd = [
            _mflux_binary(),
            "--model",
            hf_model,
            "--base-model",
            str(model.get("base_model", "dev")),
            "--prompt",
            prompt,
            "--steps",
            str(steps),
            "-q",
            str(quantize),
            "--width",
            str(width),
            "--height",
            str(height),
            "--output",
            str(output_path),
        ]
        guidance = model.get("guidance")
        if guidance is not None:
            cmd.extend(["--guidance", str(guidance)])

    lora_paths = model.get("lora_paths") or []
    lora_scales = model.get("lora_scales") or []
    if lora_paths:
        cmd.extend(["--lora-paths", *[str(p) for p in lora_paths]])
        if lora_scales:
            cmd.extend(["--lora-scales", *[str(s) for s in lora_scales]])

    if seed is not None:
        cmd.extend(["--seed", str(seed)])

    return cmd


def run_image_generation(
    *,
    job_id: str,
    model: dict[str, Any],
    prompt: str,
    size: Optional[str] = None,
    seed: Optional[int] = None,
) -> Path:
    settings = get_settings()
    out_dir = job_output_dir(job_id)
    output_path = out_dir / "result.png"

    cmd = build_image_command(
        model=model,
        prompt=prompt,
        output_path=output_path,
        size=size,
        seed=seed,
    )

    env = os.environ.copy()
    if settings.hf_home:
        env["HF_HOME"] = settings.hf_home
    env["PYTHONUNBUFFERED"] = "1"
    bin_dir = _mlx_bin_dir()
    if bin_dir:
        env["PATH"] = f"{bin_dir}{os.pathsep}{env.get('PATH', '')}"

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
        raise ImageRunnerError(f"Image generation timed out after {settings.mlx_job_timeout_seconds}s") from exc

    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        detail = stderr or stdout or f"exit code {result.returncode}"
        raise ImageRunnerError(detail)

    if not output_path.exists():
        candidates = sorted(out_dir.glob("*.png")) + sorted(out_dir.glob("*.jpg"))
        if candidates:
            candidates[0].rename(output_path)
        else:
            raise ImageRunnerError("mflux finished but no output image was produced")

    return output_path