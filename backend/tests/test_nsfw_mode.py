"""Tests for NSFW generation helpers."""

from app.services.mlx.nsfw import (
    DEFAULT_NSFW_NEGATIVE_PROMPT,
    enhance_prompt_for_nsfw,
    ensure_nsfw_model_id,
    prepare_image_generation,
    prompt_requests_nudity,
)


def test_prompt_requests_nudity_detects_keywords():
    assert prompt_requests_nudity("naked asian woman portrait")
    assert not prompt_requests_nudity("woman in a red dress")


def test_enhance_prompt_adds_explicit_suffix_for_nude_requests():
    out = enhance_prompt_for_nsfw("naked asian woman", nsfw_mode=True)
    assert "no clothing" in out.lower()
    assert "photorealistic" in out.lower()


def test_ensure_nsfw_model_upgrades_general_model():
    models = {
        "flux-dev-q4": {"id": "flux-dev-q4", "content_tier": "general", "nsfw": False},
        "flux-dev-nsfw-lora": {"id": "flux-dev-nsfw-lora", "content_tier": "nsfw", "nsfw": True},
    }
    resolved = ensure_nsfw_model_id(
        "flux-dev-q4",
        nsfw_mode=True,
        default_nsfw_model="flux-dev-nsfw-lora",
        image_models_by_id=models,
    )
    assert resolved == "flux-dev-nsfw-lora"


def test_prepare_image_generation_sets_negative_prompt():
    model = {"content_tier": "nsfw", "nsfw": True, "lora_scale": 0.9}
    model_out, prompt_out, negative = prepare_image_generation(
        model=model,
        prompt="naked asian woman",
        nsfw_mode=True,
    )
    assert negative == DEFAULT_NSFW_NEGATIVE_PROMPT
    assert model_out["lora_scale"] >= 0.9
    assert "naked asian woman" in prompt_out