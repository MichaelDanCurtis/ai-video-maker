"""Tests for tier 1–3 generation helpers."""

from app.services.mlx.runner_image import apply_image_metadata_overrides
from app.services.mlx.runner_video import motion_strength_to_guide_scale
from app.services.mlx.worker import _seeds_for_job


def test_apply_image_metadata_overrides():
    model = {"steps": 20, "guidance": 3.5, "lora_scale": 1.0}
    merged = apply_image_metadata_overrides(model, {"steps": 28, "lora_scale": 1.1})
    assert merged["steps"] == 28
    assert merged["guidance"] == 3.5
    assert merged["lora_scale"] == 1.1


def test_seeds_for_job_seed_walk():
    seeds = _seeds_for_job({"seed_walk": 3, "seed": 100})
    assert seeds == [100, 101, 102]


def test_seeds_for_job_batch_n():
    seeds = _seeds_for_job({"n": 4, "seed": 42})
    assert seeds == [42, 43, 44, 45]


def test_motion_strength_maps_to_guide_scale():
    assert motion_strength_to_guide_scale(0.0) == "0.50"
    assert motion_strength_to_guide_scale(0.5) == "1.25"
    assert motion_strength_to_guide_scale(1.0) == "2.00"
    assert motion_strength_to_guide_scale(None) is None