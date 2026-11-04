"""
Pydantic schemas for API request and response types.

This module defines all data models used for API validation and serialization.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl


# =============================================================================
# Enums
# =============================================================================


class JobStatus(str, Enum):
    """Status of an async generation job."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class MediaType(str, Enum):
    """Type of media being generated or processed."""

    IMAGE = "image"
    VIDEO = "video"


# =============================================================================
# Common Response Schemas
# =============================================================================


class HealthResponse(BaseModel):
    """Response for health check endpoint."""

    status: str = Field(default="healthy", description="Health status of the API")
    version: str = Field(description="API version")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ErrorResponse(BaseModel):
    """Standard error response format."""

    error: str = Field(description="Error type or code")
    message: str = Field(description="Human-readable error message")
    details: Optional[dict] = Field(default=None, description="Additional error details")


class ModelInfo(BaseModel):
    """Information about an available AI model."""

    id: str = Field(description="Model identifier (e.g., 'openai/dall-e-3')")
    name: str = Field(description="Human-readable model name")
    provider: str = Field(description="Model provider (e.g., 'openai')")
    description: Optional[str] = Field(default=None, description="Model description")
    capabilities: list[str] = Field(default_factory=list, description="Model capabilities")


class ModelListResponse(BaseModel):
    """Response containing list of available models."""

    models: list[ModelInfo] = Field(description="List of available models")
    media_type: MediaType = Field(description="Type of media these models generate")


# =============================================================================
# Photo Generation Schemas
# =============================================================================


class PhotoGenerationRequest(BaseModel):
    """Request to generate a photo from a text prompt."""

    prompt: str = Field(
        min_length=1,
        max_length=4000,
        description="Text prompt describing the image to generate",
    )
    model: Optional[str] = Field(
        default=None,
        description="AI model to use (defaults to server default)",
    )
    size: Optional[str] = Field(
        default="1024x1024",
        pattern=r"^\d+x\d+$",
        description="Image size in WxH format (e.g., '1024x1024')",
    )
    quality: Optional[str] = Field(
        default="standard",
        description="Image quality setting ('standard' or 'hd')",
    )
    style: Optional[str] = Field(
        default=None,
        description="Image style (model-specific, e.g., 'vivid' or 'natural')",
    )
    n: int = Field(
        default=1,
        ge=1,
        le=4,
        description="Number of images to generate (1-4)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "prompt": "A serene mountain landscape at sunset with snow-capped peaks",
                "model": "openai/dall-e-3",
                "size": "1024x1024",
                "quality": "hd",
                "n": 1,
            }
        }


class PhotoGenerationResponse(BaseModel):
    """Response from photo generation request."""

    job_id: str = Field(description="Unique identifier for this generation job")
    status: JobStatus = Field(description="Current status of the generation")
    image_url: Optional[str] = Field(
        default=None,
        description="URL of the generated image (when completed)",
    )
    image_base64: Optional[str] = Field(
        default=None,
        description="Base64-encoded image data (alternative to URL)",
    )
    model: str = Field(description="Model used for generation")
    prompt: str = Field(description="Original prompt used")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    error: Optional[str] = Field(default=None, description="Error message if failed")

    class Config:
        json_schema_extra = {
            "example": {
                "job_id": "gen_abc123",
                "status": "completed",
                "image_url": "https://example.com/generated-image.png",
                "model": "openai/dall-e-3",
                "prompt": "A serene mountain landscape at sunset",
                "created_at": "2024-01-15T10:30:00Z",
            }
        }


# =============================================================================
# Photo Edit Schemas
# =============================================================================


class PhotoEditRequest(BaseModel):
    """Request to edit/transform an existing photo.

    Note: The actual image file is sent as multipart form data,
    not in this JSON body. This schema captures the edit parameters.
    """

    edit_prompt: str = Field(
        min_length=1,
        max_length=4000,
        description="Description of the edit to apply",
    )
    model: Optional[str] = Field(
        default=None,
        description="AI model to use for editing",
    )
    strength: float = Field(
        default=0.75,
        ge=0.0,
        le=1.0,
        description="Edit strength (0.0 = no change, 1.0 = complete transformation)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "edit_prompt": "Make the sky more dramatic with storm clouds",
                "model": "stability/stable-diffusion-xl",
                "strength": 0.7,
            }
        }


class PhotoEditResponse(BaseModel):
    """Response from photo edit request."""

    job_id: str = Field(description="Unique identifier for this edit job")
    status: JobStatus = Field(description="Current status of the edit")
    original_filename: Optional[str] = Field(
        default=None,
        description="Name of the original uploaded file",
    )
    edited_image_url: Optional[str] = Field(
        default=None,
        description="URL of the edited image (when completed)",
    )
    edited_image_base64: Optional[str] = Field(
        default=None,
        description="Base64-encoded edited image data",
    )
    model: str = Field(description="Model used for editing")
    edit_prompt: str = Field(description="Edit prompt applied")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    error: Optional[str] = Field(default=None, description="Error message if failed")


# =============================================================================
# Video Generation Schemas
# =============================================================================


class VideoGenerationRequest(BaseModel):
    """Request to generate a video from a text prompt.

    Note: Video generation capability on OpenRouter is UNVERIFIED.
    This endpoint may return an unavailable message if no suitable models exist.
    """

    prompt: str = Field(
        min_length=1,
        max_length=4000,
        description="Text prompt describing the video to generate",
    )
    model: Optional[str] = Field(
        default=None,
        description="AI model to use (defaults to server default)",
    )
    duration: int = Field(
        default=5,
        ge=1,
        le=30,
        description="Video duration in seconds (1-30)",
    )
    fps: int = Field(
        default=24,
        ge=12,
        le=60,
        description="Frames per second (12-60)",
    )
    resolution: Optional[str] = Field(
        default="720p",
        pattern=r"^\d+p$|^\d+x\d+$",
        description="Video resolution (e.g., '720p' or '1280x720')",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "prompt": "A timelapse of clouds moving over a cityscape",
                "model": "stabilityai/stable-video-diffusion",
                "duration": 5,
                "fps": 24,
                "resolution": "720p",
            }
        }


class VideoGenerationResponse(BaseModel):
    """Response from video generation request."""

    job_id: str = Field(description="Unique identifier for this generation job")
    status: JobStatus = Field(description="Current status of the generation")
    video_url: Optional[str] = Field(
        default=None,
        description="URL of the generated video (when completed)",
    )
    thumbnail_url: Optional[str] = Field(
        default=None,
        description="URL of the video thumbnail",
    )
    model: str = Field(description="Model used for generation")
    prompt: str = Field(description="Original prompt used")
    duration: int = Field(description="Video duration in seconds")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    estimated_completion: Optional[datetime] = Field(
        default=None,
        description="Estimated completion time for long-running jobs",
    )
    progress: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Generation progress percentage (0-100)",
    )
    error: Optional[str] = Field(default=None, description="Error message if failed")
    unavailable_message: Optional[str] = Field(
        default=None,
        description="Message if video generation is not available",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "job_id": "vid_xyz789",
                "status": "processing",
                "model": "stabilityai/stable-video-diffusion",
                "prompt": "A timelapse of clouds moving over a cityscape",
                "duration": 5,
                "created_at": "2024-01-15T10:30:00Z",
                "progress": 45.5,
            }
        }


# =============================================================================
# Video Edit Schemas
# =============================================================================


class VideoEditRequest(BaseModel):
    """Request to edit an existing video with AI assistance.

    Note: The actual video file is sent as multipart form data,
    not in this JSON body. This schema captures the edit parameters.
    """

    edit_prompt: str = Field(
        min_length=1,
        max_length=4000,
        description="Description of the edit to apply",
    )
    model: Optional[str] = Field(
        default=None,
        description="AI model to use for editing",
    )
    preserve_audio: bool = Field(
        default=True,
        description="Whether to preserve original audio",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "edit_prompt": "Add a cinematic color grading effect",
                "preserve_audio": True,
            }
        }


class VideoEditResponse(BaseModel):
    """Response from video edit request."""

    job_id: str = Field(description="Unique identifier for this edit job")
    status: JobStatus = Field(description="Current status of the edit")
    original_filename: Optional[str] = Field(
        default=None,
        description="Name of the original uploaded file",
    )
    edited_video_url: Optional[str] = Field(
        default=None,
        description="URL of the edited video (when completed)",
    )
    thumbnail_url: Optional[str] = Field(
        default=None,
        description="URL of the video thumbnail",
    )
    model: str = Field(description="Model used for editing")
    edit_prompt: str = Field(description="Edit prompt applied")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    progress: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Edit progress percentage (0-100)",
    )
    error: Optional[str] = Field(default=None, description="Error message if failed")


# =============================================================================
# Photo-to-Video Transform Schemas
# =============================================================================


class PhotoToVideoRequest(BaseModel):
    """Request to transform a static photo into a video (animation).

    Note: The actual image file is sent as multipart form data,
    not in this JSON body. This schema captures the animation parameters.
    """

    motion_prompt: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Optional description of desired motion/animation",
    )
    model: Optional[str] = Field(
        default=None,
        description="AI model to use for transformation",
    )
    duration: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Output video duration in seconds (1-10)",
    )
    motion_strength: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Amount of motion to apply (0.0 = subtle, 1.0 = dramatic)",
    )
    loop: bool = Field(
        default=False,
        description="Whether the video should loop seamlessly",
    )
    fps: int = Field(
        default=24,
        ge=12,
        le=30,
        description="Output frames per second (12-30)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "motion_prompt": "Gentle wind blowing through the trees",
                "duration": 3,
                "motion_strength": 0.5,
                "loop": True,
                "fps": 24,
            }
        }


class PhotoToVideoResponse(BaseModel):
    """Response from photo-to-video transformation request."""

    job_id: str = Field(description="Unique identifier for this transformation job")
    status: JobStatus = Field(description="Current status of the transformation")
    original_filename: Optional[str] = Field(
        default=None,
        description="Name of the original uploaded image",
    )
    video_url: Optional[str] = Field(
        default=None,
        description="URL of the generated video (when completed)",
    )
    thumbnail_url: Optional[str] = Field(
        default=None,
        description="URL of the video thumbnail",
    )
    model: str = Field(description="Model used for transformation")
    duration: int = Field(description="Output video duration in seconds")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    progress: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Transformation progress percentage (0-100)",
    )
    error: Optional[str] = Field(default=None, description="Error message if failed")

    class Config:
        json_schema_extra = {
            "example": {
                "job_id": "transform_def456",
                "status": "completed",
                "original_filename": "landscape.jpg",
                "video_url": "https://example.com/animated-landscape.mp4",
                "model": "stabilityai/stable-video-diffusion",
                "duration": 3,
                "created_at": "2024-01-15T10:30:00Z",
            }
        }
