"""
Application configuration module.

Loads configuration from environment variables with sensible defaults.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Configuration
    app_name: str = "AI Video Maker API"
    app_version: str = "0.1.0"
    debug: bool = False

    # OpenRouter Configuration
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Default AI Models
    default_image_model: str = "openai/dall-e-3"
    default_video_model: str = "stabilityai/stable-video-diffusion"

    # CORS Configuration
    cors_origins: list[str] = ["http://localhost:3000"]

    # File Upload Configuration
    max_upload_size_mb: int = 50
    allowed_image_types: list[str] = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    allowed_video_types: list[str] = ["video/mp4", "video/webm", "video/quicktime"]

    # LangFlow Configuration (optional)
    langflow_enabled: bool = False
    langflow_base_url: str = "http://localhost:7860"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached application settings.

    Uses lru_cache to ensure settings are only loaded once.
    """
    return Settings()
