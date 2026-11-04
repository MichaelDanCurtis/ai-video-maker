"""NSFW generation helpers — model routing, prompt prep, negative prompts."""

from __future__ import annotations

import copy
import re
from typing import Any, Optional

# Steer away from clothing, censorship, and modest framing.
DEFAULT_NSFW_NEGATIVE_PROMPT = (
    "clothes, clothing, dressed, outfit, uniform, bikini, swimsuit, lingerie, "
    "underwear, bra, panties, stockings, fabric, towel, sheet, covered, modest, "
    "censored, mosaic, blur, bar censor, black bar, pixelated, watermark, text, "
    "logo, sfw, safe for work, family friendly, cartoonish, deformed, bad anatomy"
)

_NSFW_INTENT = re.compile(
    r"\b(nude|naked|nsfw|uncensored|topless|bottomless|no\s+clothes|without\s+clothes|"
    r"undressed|unclothed|bare\s+skin|full\s+body\s+nude|explicit)\b",
    re.IGNORECASE,
)

_QUALITY_SUFFIX = ", photorealistic, highly detailed skin texture, uncensored, natural lighting, 8k"
_EXPLICIT_SUFFIX = ", fully nude, no clothing, bare skin, full body, explicit, unclothed"


def prompt_requests_nudity(prompt: str) -> bool:
    return bool(_NSFW_INTENT.search(prompt))


def enhance_prompt_for_nsfw(prompt: str, *, nsfw_mode: bool) -> str:
    """Light prompt expansion — does not replace the user's wording."""
    text = prompt.strip()
    if not nsfw_mode:
        return text

    lower = text.lower()
    extras: list[str] = []
    if _QUALITY_SUFFIX.strip(", ") not in lower:
        extras.append(_QUALITY_SUFFIX)
    if prompt_requests_nudity(text) and "no clothing" not in lower and "fully nude" not in lower:
        extras.append(_EXPLICIT_SUFFIX)

    if not extras:
        return text
    return text + "".join(extras)


def negative_prompt_for_nsfw(*, nsfw_mode: bool, override: Optional[str] = None) -> str:
    if override:
        return override.strip()
    if not nsfw_mode:
        return ""
    return DEFAULT_NSFW_NEGATIVE_PROMPT


def ensure_nsfw_model_id(
    model_id: str,
    *,
    nsfw_mode: bool,
    default_nsfw_model: str,
    image_models_by_id: dict[str, dict[str, Any]],
) -> str:
    """Force an NSFW-tier catalog model when explicit mode is on."""
    if not nsfw_mode:
        return model_id

    entry = image_models_by_id.get(model_id)
    if entry and entry.get("content_tier") == "nsfw" and entry.get("nsfw"):
        return model_id
    return default_nsfw_model


def apply_nsfw_model_overrides(model: dict[str, Any], *, nsfw_mode: bool) -> dict[str, Any]:
    """Boost LoRA influence slightly when explicit mode is enabled."""
    if not nsfw_mode:
        return model

    out = copy.deepcopy(model)
    if out.get("content_tier") != "nsfw":
        return out

    scale = float(out.get("lora_scale", 1.0))
    out["lora_scale"] = min(1.2, max(scale, 1.05))
    return out


def prepare_image_generation(
    *,
    model: dict[str, Any],
    prompt: str,
    nsfw_mode: bool,
    negative_prompt: Optional[str] = None,
) -> tuple[dict[str, Any], str, str]:
    """Return model entry, final prompt, and negative prompt for mflux."""
    model_out = apply_nsfw_model_overrides(model, nsfw_mode=nsfw_mode)
    prompt_out = enhance_prompt_for_nsfw(prompt, nsfw_mode=nsfw_mode)
    negative_out = negative_prompt_for_nsfw(nsfw_mode=nsfw_mode, override=negative_prompt)
    return model_out, prompt_out, negative_out