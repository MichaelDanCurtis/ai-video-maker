"""Curated Hugging Face image model catalog — expanded into runnable registry entries."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

_CATALOG_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent / "mlx_models" / "image_catalog.json"
)

CONTENT_TIERS = ("all", "nsfw", "general", "fast")


def catalog_path() -> Path:
    return _CATALOG_PATH


def load_catalog_raw() -> dict[str, Any]:
    with catalog_path().open(encoding="utf-8") as handle:
        return json.load(handle)


def expand_catalog_entry(entry: dict[str, Any], templates: dict[str, Any]) -> dict[str, Any]:
    """Merge a catalog entry with its template into a full registry model dict."""
    template_name = entry.get("template")
    if not template_name or template_name not in templates:
        raise ValueError(f"Unknown catalog template: {template_name}")

    merged: dict[str, Any] = {
        "provider": "local-mlx",
        "capabilities": ["text-to-image"],
        "uncensored": False,
        "nsfw": False,
    }
    merged.update(templates[template_name])
    merged.update(entry)
    return merged


def image_models_from_catalog() -> list[dict[str, Any]]:
    data = load_catalog_raw()
    templates = data.get("templates", {})
    models: list[dict[str, Any]] = []
    for entry in data.get("entries", []):
        models.append(expand_catalog_entry(entry, templates))
    return models


def filter_by_tier(models: list[dict[str, Any]], tier: Optional[str]) -> list[dict[str, Any]]:
    if not tier or tier == "all":
        return models
    if tier not in CONTENT_TIERS:
        return models
    return [m for m in models if m.get("content_tier") == tier]


def catalog_summary() -> dict[str, Any]:
    data = load_catalog_raw()
    models = image_models_from_catalog()
    tiers: dict[str, int] = {t: 0 for t in CONTENT_TIERS if t != "all"}
    for model in models:
        tier = model.get("content_tier", "general")
        if tier in tiers:
            tiers[tier] += 1
    return {
        "version": data.get("version"),
        "curated_at": data.get("curated_at"),
        "notes": data.get("notes"),
        "total": len(models),
        "tiers": tiers,
    }


def verify_catalog_with_hf(*, token: Optional[str] = None) -> dict[str, Any]:
    """
    Validate curated Hugging Face repos still exist and expose expected weight files.
    Does not auto-add random search results — only verifies our curated list.
    """
    from huggingface_hub import HfApi

    api = HfApi(token=token)
    data = load_catalog_raw()
    results: list[dict[str, Any]] = []

    for entry in data.get("entries", []):
        row: dict[str, Any] = {
            "id": entry["id"],
            "content_tier": entry.get("content_tier"),
            "nsfw": entry.get("nsfw", False),
            "status": "ok",
            "issues": [],
        }
        template = data["templates"][entry["template"]]
        base_repo = template.get("huggingface_model")
        lora_repo = entry.get("lora_huggingface_repo")
        lora_file = entry.get("lora_filename")

        for label, repo in (("base", base_repo), ("lora", lora_repo)):
            if not repo:
                continue
            try:
                info = api.model_info(repo)
                row[f"{label}_repo"] = repo
                row[f"{label}_downloads"] = info.downloads
                if lora_file and label == "lora":
                    files = api.list_repo_files(repo)
                    if lora_file not in files:
                        row["status"] = "warn"
                        row["issues"].append(f"Missing LoRA file: {lora_file}")
            except Exception as exc:  # noqa: BLE001
                row["status"] = "error"
                row["issues"].append(f"{label} repo {repo}: {exc}")

        results.append(row)

    ok = sum(1 for r in results if r["status"] == "ok")
    warn = sum(1 for r in results if r["status"] == "warn")
    err = sum(1 for r in results if r["status"] == "error")
    return {
        "summary": {"ok": ok, "warn": warn, "error": err, "total": len(results)},
        "models": results,
    }