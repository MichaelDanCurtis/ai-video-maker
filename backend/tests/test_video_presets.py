"""Unit tests for MLX video preset resolution."""

from app.services.mlx.video_presets import (
    apply_video_presets,
    dimensions_for_aspect,
    wan_num_frames,
)


WAN_TEMPLATE = {
    "engine": "mlx-video-wan-i2v",
    "width": 480,
    "height": 704,
    "num_frames": 41,
    "fps": 24,
}

LTX_TEMPLATE = {
    "engine": "mlx-video-ltx2",
    "width": 768,
    "height": 512,
    "num_frames": 97,
    "fps": 24,
}


def test_dimensions_9_16_portrait():
    dims = dimensions_for_aspect("9:16", WAN_TEMPLATE)
    assert dims["width"] == 400
    assert dims["height"] == 704


def test_dimensions_16_9_landscape():
    dims = dimensions_for_aspect("16:9", WAN_TEMPLATE)
    assert dims["width"] == 480
    assert dims["height"] == 272


def test_wan_num_frames_is_4n_plus_1():
    assert wan_num_frames(4, 24) == 97
    assert wan_num_frames(2, 24) == 49
    assert (wan_num_frames(3, 24) - 1) % 4 == 0


def test_apply_presets_duration_and_aspect():
    result = apply_video_presets(
        WAN_TEMPLATE,
        {"aspect_ratio": "16:9", "duration": 4, "fps": 24},
    )
    assert result["width"] == 480
    assert result["height"] == 272
    assert result["num_frames"] == 97
    assert result["fps"] == 24


def test_apply_presets_ltx_duration():
    result = apply_video_presets(LTX_TEMPLATE, {"duration": 4, "fps": 24})
    assert result["num_frames"] == 96


def test_ltx_16_9_height_divisible_by_64():
    result = apply_video_presets(
        LTX_TEMPLATE,
        {"aspect_ratio": "16:9", "duration": 4, "fps": 24},
    )
    assert result["width"] == 768
    assert result["height"] % 64 == 0
    assert result["height"] == 448


def test_ltx_9_16_width_divisible_by_64():
    result = apply_video_presets(
        LTX_TEMPLATE,
        {"aspect_ratio": "9:16", "duration": 4, "fps": 24},
    )
    assert result["width"] % 64 == 0
    assert result["height"] % 64 == 0
    assert result["width"] == 256
    assert result["height"] == 512


WAN_T2V_TEMPLATE = {
    **WAN_TEMPLATE,
    "engine": "mlx-video-wan-t2v",
    "paired_i2v_model_id": "wan22-i2v-missing",
}


def test_wan_to_ltx_routing_preserves_ltx_alignment():
    """Wan 9:16 uses 400px width (8px grid); LTX must not inherit that."""
    from app.services.mlx.model_routing import merge_video_dimensions, resolve_video_model_for_job

    wan_preset = apply_video_presets(
        WAN_T2V_TEMPLATE,
        {"aspect_ratio": "9:16", "duration": 4, "fps": 24},
    )
    assert wan_preset["width"] == 400

    ltx_model = resolve_video_model_for_job(WAN_T2V_TEMPLATE, has_image=True)
    # Worker applies presets on the resolved engine model.
    ltx_ready = apply_video_presets(ltx_model, {"aspect_ratio": "9:16", "duration": 4, "fps": 24})
    assert ltx_ready["engine"] == "mlx-video-ltx2"
    assert ltx_ready["width"] % 64 == 0
    assert ltx_ready["width"] != 400

    # Old bug path: copying Wan dims onto LTX.
    broken = merge_video_dimensions(ltx_model, wan_preset)
    assert broken["width"] == 400