"""
Application configuration module.

Loads configuration from environment variables with sensible defaults.
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Configuration
    app_name: str = "AI Video Maker API"
    app_version: str = "0.1.0"
    debug: bool = False

    # OpenRouter Configuration
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Inference backend: mlx (local Apple Silicon) or openrouter (cloud)
    inference_backend: str = "mlx"
    mlx_enabled: bool = True
    mlx_python: str = ""
    mflux_binary: str = ""
    mlx_models_dir: str = "backend/mlx_models/weights"
    data_dir: str = "data"
    hf_home: str = ""
    hf_token: str = ""
    media_url_prefix: str = "/media"
    mlx_worker_poll_seconds: float = 2.0
    mlx_job_timeout_seconds: int = 3600

    # Default AI Models (registry IDs when using mlx, OpenRouter slugs when cloud)
    default_image_model: str = "flux-dev-nsfw-lora"
    default_video_model: str = "wan22-i2v-lightning"
    # When true, image jobs use NSFW LoRA models, anti-clothing negative prompts, and prompt expansion.
    default_nsfw_mode: bool = True

    # CORS Configuration
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:3000",
        "http://localhost:3100",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3100",
    ]

    # File Upload Configuration
    max_upload_size_mb: int = 50
    allowed_image_types: Annotated[list[str], NoDecode] = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
    ]
    allowed_video_types: Annotated[list[str], NoDecode] = [
        "video/mp4",
        "video/webm",
        "video/quicktime",
    ]

    # LangFlow Configuration (optional)
    langflow_enabled: bool = False
    langflow_base_url: str = "http://localhost:7860"

    @field_validator("cors_origins", "allowed_image_types", "allowed_video_types", mode="before")
    @classmethod
    def parse_comma_separated_list(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    class Config:
        env_file = (_PROJECT_ROOT / ".env", _BACKEND_ROOT / ".env")
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached application settings.

    Uses lru_cache to ensure settings are only loaded once.
    """
    return Settings()
