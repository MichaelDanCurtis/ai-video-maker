#!/usr/bin/env python3
"""Verify and refresh the curated MLX image catalog against Hugging Face Hub."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.services.mlx.catalog import (  # noqa: E402
    catalog_path,
    catalog_summary,
    load_catalog_raw,
    verify_catalog_with_hf,
)


def _refresh_download_counts(token: str | None) -> int:
    from huggingface_hub import HfApi

    api = HfApi(token=token)
    data = load_catalog_raw()
    updated = 0
    for entry in data.get("entries", []):
        lora_repo = entry.get("lora_huggingface_repo")
        if not lora_repo:
            continue
        try:
            info = api.model_info(lora_repo)
            downloads = info.downloads or 0
            if entry.get("hf_downloads") != downloads:
                entry["hf_downloads"] = downloads
                updated += 1
        except Exception:
            pass
    if updated:
        with catalog_path().open("w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2)
            handle.write("\n")
    return updated


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--refresh-downloads",
        action="store_true",
        help="Write latest HF download counts back into image_catalog.json",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit full verification JSON (default: human summary)",
    )
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")

    if args.refresh_downloads:
        n = _refresh_download_counts(token)
        print(f"Refreshed hf_downloads on {n} catalog entries")

    summary = catalog_summary()
    print(f"Catalog v{summary.get('version')} — {summary['total']} image models")
    for tier, count in summary.get("tiers", {}).items():
        print(f"  {tier}: {count}")

    result = verify_catalog_with_hf(token=token)
    s = result["summary"]
    print(f"\nHF verify: {s['ok']} ok, {s['warn']} warn, {s['error']} error (of {s['total']})")

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        for row in result["models"]:
            if row["status"] != "ok":
                issues = "; ".join(row.get("issues", []))
                print(f"  [{row['status']}] {row['id']}: {issues}")

    return 1 if s["error"] else 0


if __name__ == "__main__":
    raise SystemExit(main())