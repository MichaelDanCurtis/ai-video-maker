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
    nsfw: bool = Field(default=False, description="Whether the model includes an NSFW fine-tune or LoRA")
    uncensored: bool = Field(default=False, description="Legacy flag for reduced refusal bias (prefer nsfw)")
    content_tier: Optional[str] = Field(
        default=None,
        description="Curated tier: nsfw, general, or fast (image catalog only)",
    )
    ready: Optional[bool] = Field(default=None, description="Whether local weights are downloaded and ready")


class ModelListResponse(BaseModel):
    """Response containing list of available models."""

    models: list[ModelInfo] = Field(description="List of available models")
    media_type: MediaType = Field(description="Type of media these models generate")


class ModelDownloadRequest(BaseModel):
    """Request to download model weights from Hugging Face."""

    model_id: str = Field(description="Registry model id")
    kind: MediaType = Field(description="image or video")


class ModelDownloadResponse(BaseModel):
    """Status of a Hugging Face model download job."""

    download_id: str
    model_id: str
    kind: MediaType
    status: str
    message: str
    error: Optional[str] = None
    ready: Optional[bool] = None


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
    nsfw_mode: Optional[bool] = Field(
        default=None,
        description=(
            "Explicit generation mode: forces NSFW-tier Flux+LoRA, anti-clothing negative prompt, "
            "and light prompt expansion. Defaults to server default_nsfw_mode."
        ),
    )
    negative_prompt: Optional[str] = Field(
        default=None,
        description="Optional negative prompt override (used when nsfw_mode is enabled)",
    )
    seed: Optional[int] = Field(
        default=None,
        ge=0,
        description="RNG seed for reproducible generation",
    )
    seed_walk: Optional[int] = Field(
        default=None,
        ge=1,
        le=8,
        description="Generate this many variants with consecutive seeds (uses seed as base when set)",
    )
    steps: Optional[int] = Field(
        default=None,
        ge=1,
        le=60,
        description="Override denoising steps from the model catalog",
    )
    guidance: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=30.0,
        description="Override guidance scale (Flux models)",
    )
    lora_scale: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=2.0,
        description="Override LoRA influence scale",
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
    image_urls: Optional[list[str]] = Field(
        default=None,
        description="All generated image URLs when n>1 or seed_walk>1",
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
    aspect_ratio: Optional[str] = Field(
        default="9:16",
        description="Aspect preset (9:16, 16:9, 1:1, 4:5, 3:4) or auto",
    )
    image_model: Optional[str] = Field(
        default=None,
        description="Keyframe model from image catalog (text-to-video only; appearance / NSFW)",
    )
    nsfw_mode: Optional[bool] = Field(
        default=None,
        description="Explicit keyframe mode for text-to-video (Flux LoRA + negative prompt)",
    )
    seed: Optional[int] = Field(default=None, ge=0, description="RNG seed for video generation")
    negative_prompt: Optional[str] = Field(
        default=None,
        description="Negative prompt for keyframe generation (text-to-video hybrid mode)",
    )
    motion_negative_prompt: Optional[str] = Field(
        default=None,
        description="Negative prompt passed to the motion engine",
    )
    pure_t2v: bool = Field(
        default=False,
        description="Skip Flux keyframe and run pure text-to-video (Wan T2V only)",
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


class VideoContinueRequest(BaseModel):
    """Continue a completed clip using its last frame as the next shot's seed."""

    source_job_id: str = Field(description="Completed video job to continue from")
    motion_prompt: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Motion direction for the next shot",
    )
    model: Optional[str] = Field(
        default=None,
        description="Video model (defaults to source job model)",
    )
    duration: Optional[int] = Field(
        default=None,
        ge=1,
        le=10,
        description="Clip length in seconds (inherits source when omitted)",
    )
    fps: Optional[int] = Field(
        default=None,
        ge=12,
        le=30,
        description="Frames per second (inherits source when omitted)",
    )
    aspect_ratio: Optional[str] = Field(
        default="auto",
        description="Aspect preset or auto to match the extracted frame",
    )
    segment_index: Optional[int] = Field(
        default=None,
        ge=0,
        description="Narration segment index for chained storyboards",
    )
    shot_index: Optional[int] = Field(
        default=None,
        ge=0,
        description="Shot index within the current segment",
    )
    nsfw_mode: Optional[bool] = Field(
        default=None,
        description="Explicit keyframe mode when continuing from a text-to-video source",
    )
    negative_prompt: Optional[str] = Field(
        default=None,
        description="Negative prompt for any keyframe step in the chain",
    )
    motion_negative_prompt: Optional[str] = Field(
        default=None,
        description="Negative prompt for the motion engine",
    )
    seed: Optional[int] = Field(default=None, ge=0, description="RNG seed for motion generation")
    motion_strength: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Motion intensity (maps to guide scale on Wan)",
    )


class VideoContinueResponse(BaseModel):
    """Response when queueing a continuation shot."""

    job_id: str
    status: JobStatus
    source_job_id: str
    seed_frame_url: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    model: str
    prompt: str
    duration: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    progress: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    error: Optional[str] = None


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
    aspect_ratio: Optional[str] = Field(
        default="auto",
        description="Aspect preset or auto to match the uploaded photo",
    )
    seed: Optional[int] = Field(default=None, ge=0, description="RNG seed for motion generation")
    negative_prompt: Optional[str] = Field(
        default=None,
        description="Negative prompt for optional refine step",
    )
    motion_negative_prompt: Optional[str] = Field(
        default=None,
        description="Negative prompt for the motion engine",
    )
    source_image_job_id: Optional[str] = Field(
        default=None,
        description="Completed image job to animate (alternative to file upload)",
    )
    refine_prompt: Optional[str] = Field(
        default=None,
        max_length=4000,
        description="Optional img2img-style refine prompt before animation",
    )
    refine_strength: float = Field(
        default=0.35,
        ge=0.0,
        le=1.0,
        description="Redux refine strength (0 = skip, higher = more change)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "motion_prompt": "Gentle wind blowing through the trees",
                "duration": 3,
                "motion_strength": 0.5,
                "loop": True,
                "fps": 24,
                "aspect_ratio": "auto",
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


class StillAnimateRequest(BaseModel):
    """Animate a completed still image job without re-uploading."""

    source_image_job_id: str = Field(description="Completed image generation job id")
    motion_prompt: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Motion direction for the clip",
    )
    model: Optional[str] = Field(default=None, description="Video model id")
    duration: int = Field(default=4, ge=1, le=10)
    fps: int = Field(default=24, ge=12, le=30)
    aspect_ratio: str = Field(default="auto")
    motion_strength: float = Field(default=0.5, ge=0.0, le=1.0)
    seed: Optional[int] = Field(default=None, ge=0)
    negative_prompt: Optional[str] = Field(default=None)
    motion_negative_prompt: Optional[str] = Field(default=None)
    refine_prompt: Optional[str] = Field(default=None, max_length=4000)
    refine_strength: float = Field(default=0.0, ge=0.0, le=1.0)


class ImageRefineRequest(BaseModel):
    """Refine a completed still using Flux Redux before animation."""

    source_image_job_id: str = Field(description="Completed image job to refine")
    refine_prompt: str = Field(min_length=1, max_length=4000)
    strength: float = Field(default=0.45, ge=0.0, le=1.0)
    model: Optional[str] = Field(default=None, description="Image model id override")
    seed: Optional[int] = Field(default=None, ge=0)
    negative_prompt: Optional[str] = Field(default=None)
    nsfw_mode: Optional[bool] = Field(default=None)


# =============================================================================
# Project Assembly Schemas
# =============================================================================


class ConcatProjectRequest(BaseModel):
    """Request to stitch multiple generated clips in order."""

    clip_urls: list[str] = Field(
        min_length=2,
        description="Ordered list of /media/... URLs for each clip",
    )
    project_name: Optional[str] = Field(
        default=None,
        max_length=120,
        description="Optional project title for the export",
    )


class ConcatProjectResponse(BaseModel):
    """Response after stitching clips into one video."""

    job_id: str = Field(description="Export job identifier")
    video_url: str = Field(description="URL of the stitched video")
    clip_count: int = Field(description="Number of clips combined")
    duration: float = Field(description="Total duration in seconds")
    project_name: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
