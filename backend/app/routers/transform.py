"""
Transform API router.

Provides endpoints for media transformations including photo editing,
photo-to-video conversion, and video editing.
"""

import base64
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import get_settings
from app.models.schemas import (
    ErrorResponse,
    JobStatus,
    PhotoEditResponse,
    PhotoToVideoResponse,
    VideoEditResponse,
)
from app.services.mlx.helpers import (
    get_job_or_404,
    photo_to_video_response_from_job,
    resolve_video_model_id,
    use_mlx,
)
from app.services.mlx.jobs import JobKind
from app.services.mlx.worker import enqueue_job, get_job_store, save_upload_for_job
from app.services.openrouter import (
    OpenRouterAuthError,
    OpenRouterRateLimitError,
    OpenRouterAPIError,
    get_openrouter_client_async,
)

router = APIRouter(prefix="/api/v1/transform", tags=["transform"])

# Allowed image MIME types for upload
ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
}

# Allowed video MIME types for upload
ALLOWED_VIDEO_TYPES = {
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
    "video/mpeg",
}

# Maximum file size for images (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024

# Maximum file size for videos (100MB)
MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024

# Flag indicating photo-to-video transformation availability on OpenRouter
# This is set to False since photo-to-video via OpenRouter is unverified
PHOTO_TO_VIDEO_AVAILABLE = False

# Flag indicating video editing transformation availability on OpenRouter
# This is set to False since video editing via OpenRouter is unverified
VIDEO_EDITING_AVAILABLE = False


def _generate_job_id(prefix: str = "edit") -> str:
    """Generate a unique job ID for transformation jobs."""
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _validate_image_file(file: UploadFile) -> None:
    """
    Validate uploaded image file.

    Args:
        file: Uploaded file to validate.

    Raises:
        HTTPException: If file is invalid.
    """
    if not file.content_type:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_file",
                "message": "File type could not be determined",
            },
        )

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_file_type",
                "message": f"File type '{file.content_type}' is not supported. "
                f"Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}",
            },
        )


def _validate_video_file(file: UploadFile) -> None:
    """
    Validate uploaded video file.

    Args:
        file: Uploaded file to validate.

    Raises:
        HTTPException: If file is invalid.
    """
    if not file.content_type:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_file",
                "message": "File type could not be determined",
            },
        )

    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_file_type",
                "message": f"File type '{file.content_type}' is not supported. "
                f"Allowed types: {', '.join(ALLOWED_VIDEO_TYPES)}",
            },
        )


async def _read_and_validate_video_file_size(file: UploadFile) -> bytes:
    """
    Read video file content and validate size.

    Args:
        file: Uploaded video file to read.

    Returns:
        File content as bytes.

    Raises:
        HTTPException: If file is too large.
    """
    content = await file.read()
    if len(content) > MAX_VIDEO_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "file_too_large",
                "message": f"File size exceeds maximum allowed size of {MAX_VIDEO_FILE_SIZE // (1024 * 1024)}MB",
            },
        )
    return content


async def _read_and_validate_file_size(file: UploadFile) -> bytes:
    """
    Read file content and validate size.

    Args:
        file: Uploaded file to read.

    Returns:
        File content as bytes.

    Raises:
        HTTPException: If file is too large.
    """
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "file_too_large",
                "message": f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)}MB",
            },
        )
    return content


@router.post(
    "/photo-edit",
    response_model=PhotoEditResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request or file"},
        401: {"model": ErrorResponse, "description": "API key not configured or invalid"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def edit_photo(
    file: UploadFile = File(..., description="Image file to edit"),
    edit_prompt: str = Form(..., min_length=1, max_length=4000, description="Description of the edit to apply"),
    model: Optional[str] = Form(default=None, description="AI model to use for editing"),
    strength: float = Form(default=0.75, ge=0.0, le=1.0, description="Edit strength (0.0-1.0)"),
) -> PhotoEditResponse:
    """
    Edit/transform an existing photo using AI.

    This endpoint accepts an image file and an edit prompt, then uses AI
    to apply the requested transformations. The edit strength controls
    how dramatically the image is modified.

    Args:
        file: The image file to edit (JPEG, PNG, WebP, or GIF).
        edit_prompt: Description of the edit to apply.
        model: AI model to use (defaults to server default).
        strength: Edit strength from 0.0 (subtle) to 1.0 (dramatic).

    Returns:
        PhotoEditResponse with the edited image URL or base64 data.

    Raises:
        HTTPException: On validation errors, authentication failures, or API errors.
    """
    settings = get_settings()
    job_id = _generate_job_id("photo_edit")

    # Validate the uploaded file
    _validate_image_file(file)

    # Read and validate file size
    file_content = await _read_and_validate_file_size(file)

    # Use default model if not specified
    model_to_use = model or settings.default_image_model

    try:
        async with get_openrouter_client_async() as client:
            # Convert image to base64 for API request
            image_base64 = base64.b64encode(file_content).decode("utf-8")

            # For image editing, we use a vision-capable model with chat completion
            # to describe the edit, then generate a new image based on the description
            # This is a common pattern when direct image editing APIs aren't available

            # First, generate an enhanced prompt using vision model
            vision_messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{file.content_type};base64,{image_base64}"
                            },
                        },
                        {
                            "type": "text",
                            "text": f"Describe this image in detail, then describe how it would look after applying this edit: {edit_prompt}. "
                            f"Provide a detailed description that could be used to generate the edited version.",
                        },
                    ],
                }
            ]

            # Get enhanced description from vision model
            vision_response = await client.chat_completion_async(
                messages=vision_messages,
                model="openai/gpt-4o",  # Vision-capable model
                max_tokens=500,
            )

            # Extract the enhanced prompt
            enhanced_prompt = ""
            if "choices" in vision_response and len(vision_response["choices"]) > 0:
                enhanced_prompt = vision_response["choices"][0].get("message", {}).get("content", "")

            if not enhanced_prompt:
                enhanced_prompt = edit_prompt

            # Generate the edited image using the enhanced prompt
            result = await client.generate_image_async(
                prompt=f"Create an image based on this description: {enhanced_prompt}",
                model=model_to_use,
                size="1024x1024",
                quality="standard",
                n=1,
            )

            # Extract image data from response
            edited_image_url = None
            edited_image_base64 = None

            if "data" in result and len(result["data"]) > 0:
                image_data = result["data"][0]
                edited_image_url = image_data.get("url")
                edited_image_base64 = image_data.get("b64_json")

            return PhotoEditResponse(
                job_id=job_id,
                status=JobStatus.COMPLETED,
                original_filename=file.filename,
                edited_image_url=edited_image_url,
                edited_image_base64=edited_image_base64,
                model=model_to_use,
                edit_prompt=edit_prompt,
                created_at=datetime.utcnow(),
            )

    except OpenRouterAuthError as e:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "authentication_error",
                "message": str(e),
            },
        )

    except OpenRouterRateLimitError as e:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limit_exceeded",
                "message": str(e),
            },
        )

    except OpenRouterAPIError as e:
        # Return a failed response for API errors instead of raising
        return PhotoEditResponse(
            job_id=job_id,
            status=JobStatus.FAILED,
            original_filename=file.filename,
            model=model_to_use,
            edit_prompt=edit_prompt,
            created_at=datetime.utcnow(),
            error=str(e),
        )

    except Exception as e:
        # Unexpected errors
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_error",
                "message": f"An unexpected error occurred: {str(e)}",
            },
        )


@router.post(
    "/photo-to-video",
    response_model=PhotoToVideoResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request or file"},
        401: {"model": ErrorResponse, "description": "API key not configured or invalid"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def photo_to_video(
    file: UploadFile = File(..., description="Image file to transform into video"),
    motion_prompt: Optional[str] = Form(default=None, max_length=1000, description="Description of desired motion/animation"),
    model: Optional[str] = Form(default=None, description="AI model to use for transformation"),
    duration: int = Form(default=3, ge=1, le=10, description="Output video duration in seconds (1-10)"),
    motion_strength: float = Form(default=0.5, ge=0.0, le=1.0, description="Amount of motion to apply (0.0-1.0)"),
    loop: bool = Form(default=False, description="Whether the video should loop seamlessly"),
    fps: int = Form(default=24, ge=12, le=30, description="Output frames per second (12-30)"),
) -> PhotoToVideoResponse:
    """
    Transform a static photo into an animated video.

    This endpoint accepts an image file and animation parameters, then uses AI
    to create a video with motion effects. The motion prompt can describe the
    type of animation desired (e.g., "wind blowing through trees").

    Note: Photo-to-video transformation capability is currently UNVERIFIED on OpenRouter.
    If transformation models are unavailable, a response with an error message
    will be returned instead of actual video content.

    Args:
        file: The image file to transform (JPEG, PNG, WebP, or GIF).
        motion_prompt: Optional description of desired motion/animation.
        model: AI model to use (defaults to server default).
        duration: Output video duration in seconds (1-10).
        motion_strength: Amount of motion from 0.0 (subtle) to 1.0 (dramatic).
        loop: Whether the video should loop seamlessly.
        fps: Output frames per second (12-30).

    Returns:
        PhotoToVideoResponse with the generated video URL or error message.

    Raises:
        HTTPException: On validation errors, authentication failures, or API errors.
    """
    settings = get_settings()
    job_id = _generate_job_id("p2v")

    # Validate the uploaded file
    _validate_image_file(file)

    # Read and validate file size
    file_content = await _read_and_validate_file_size(file)

    model_to_use = resolve_video_model_id(model)

    if use_mlx():
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        upload_path = save_upload_for_job(job_id, file.filename or "input.png", file_content)
        prompt_text = motion_prompt or "Subtle natural motion and cinematic movement"
        job = get_job_store().create(
            kind=JobKind.PHOTO_TO_VIDEO,
            model_id=model_to_use,
            prompt=prompt_text,
            metadata={
                "input_image_path": str(upload_path),
                "duration": duration,
                "motion_strength": motion_strength,
                "loop": loop,
                "fps": fps,
                "original_filename": file.filename,
            },
            job_id=job_id,
        )
        await enqueue_job(job)
        return photo_to_video_response_from_job(
            job,
            duration=duration,
            filename=file.filename,
        )

    # Check if photo-to-video transformation is available
    if not PHOTO_TO_VIDEO_AVAILABLE:
        return PhotoToVideoResponse(
            job_id=job_id,
            status=JobStatus.FAILED,
            original_filename=file.filename,
            model=model_to_use,
            duration=duration,
            created_at=datetime.utcnow(),
            error=(
                "Photo-to-video transformation is not currently available. "
                "The photo-to-video models on OpenRouter have not been verified. "
                "Please check back later or use the video generation endpoint instead."
            ),
        )

    try:
        async with get_openrouter_client_async() as client:
            # Convert image to base64 for API request
            image_base64 = base64.b64encode(file_content).decode("utf-8")

            # Attempt to call photo-to-video transformation API
            # Note: This code path may not work as photo-to-video on OpenRouter
            # is unverified. Keeping the implementation for future compatibility.
            result = await client.generate_video_async(
                prompt=motion_prompt or "Subtle natural motion and movement",
                model=model_to_use,
                duration=duration,
                fps=fps,
                resolution="720p",
                image_base64=image_base64,
            )

            # Extract video data from response
            video_url = None
            thumbnail_url = None

            if "data" in result and len(result["data"]) > 0:
                video_data = result["data"][0]
                video_url = video_data.get("url")
                thumbnail_url = video_data.get("thumbnail_url")

            return PhotoToVideoResponse(
                job_id=job_id,
                status=JobStatus.COMPLETED,
                original_filename=file.filename,
                video_url=video_url,
                thumbnail_url=thumbnail_url,
                model=model_to_use,
                duration=duration,
                created_at=datetime.utcnow(),
            )

    except OpenRouterAuthError as e:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "authentication_error",
                "message": str(e),
            },
        )

    except OpenRouterRateLimitError as e:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limit_exceeded",
                "message": str(e),
            },
        )

    except OpenRouterAPIError as e:
        # Return a failed response for API errors instead of raising
        return PhotoToVideoResponse(
            job_id=job_id,
            status=JobStatus.FAILED,
            original_filename=file.filename,
            model=model_to_use,
            duration=duration,
            created_at=datetime.utcnow(),
            error=str(e),
        )

    except Exception as e:
        # Unexpected errors
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_error",
                "message": f"An unexpected error occurred: {str(e)}",
            },
        )


@router.get("/photo-to-video/status/{job_id}", response_model=PhotoToVideoResponse)
async def photo_to_video_job_status(job_id: str) -> PhotoToVideoResponse:
    job = get_job_or_404(job_id)
    duration = int(job.metadata.get("duration", 3))
    filename = job.metadata.get("original_filename")
    return photo_to_video_response_from_job(job, duration=duration, filename=filename)


@router.post(
    "/video-edit",
    response_model=VideoEditResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request or file"},
        401: {"model": ErrorResponse, "description": "API key not configured or invalid"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def edit_video(
    file: UploadFile = File(..., description="Video file to edit"),
    edit_prompt: str = Form(..., min_length=1, max_length=4000, description="Description of the edit to apply"),
    model: Optional[str] = Form(default=None, description="AI model to use for editing"),
    preserve_audio: bool = Form(default=True, description="Whether to preserve original audio"),
) -> VideoEditResponse:
    """
    Edit/transform an existing video using AI.

    This endpoint accepts a video file and an edit prompt, then uses AI
    to apply the requested transformations. Common edits include color grading,
    style transfer, visual effects, and content modifications.

    Note: Video editing capability on OpenRouter is UNVERIFIED.
    If editing models are unavailable, a response with an error message
    will be returned instead of actual edited video content.

    Args:
        file: The video file to edit (MP4, WebM, MOV, AVI, or MPEG).
        edit_prompt: Description of the edit to apply.
        model: AI model to use (defaults to server default).
        preserve_audio: Whether to keep the original audio track.

    Returns:
        VideoEditResponse with the edited video URL or error message.

    Raises:
        HTTPException: On validation errors, authentication failures, or API errors.
    """
    settings = get_settings()
    job_id = _generate_job_id("video_edit")

    # Validate the uploaded file
    _validate_video_file(file)

    # Read and validate file size
    file_content = await _read_and_validate_video_file_size(file)

    # Use default model if not specified
    model_to_use = model or settings.default_video_model

    # Check if video editing is available
    if not VIDEO_EDITING_AVAILABLE:
        return VideoEditResponse(
            job_id=job_id,
            status=JobStatus.FAILED,
            original_filename=file.filename,
            model=model_to_use,
            edit_prompt=edit_prompt,
            created_at=datetime.utcnow(),
            error=(
                "Video editing is not currently available. "
                "The video editing models on OpenRouter have not been verified. "
                "Please check back later or use the video generation endpoint instead."
            ),
        )

    try:
        async with get_openrouter_client_async() as client:
            # Convert video to base64 for API request
            video_base64 = base64.b64encode(file_content).decode("utf-8")

            # Attempt to call video editing API
            # Note: This code path may not work as video editing on OpenRouter
            # is unverified. Keeping the implementation for future compatibility.
            result = await client.generate_video_async(
                prompt=edit_prompt,
                model=model_to_use,
                video_base64=video_base64,
                preserve_audio=preserve_audio,
            )

            # Extract video data from response
            edited_video_url = None
            thumbnail_url = None

            if "data" in result and len(result["data"]) > 0:
                video_data = result["data"][0]
                edited_video_url = video_data.get("url")
                thumbnail_url = video_data.get("thumbnail_url")

            return VideoEditResponse(
                job_id=job_id,
                status=JobStatus.COMPLETED,
                original_filename=file.filename,
                edited_video_url=edited_video_url,
                thumbnail_url=thumbnail_url,
                model=model_to_use,
                edit_prompt=edit_prompt,
                created_at=datetime.utcnow(),
            )

    except OpenRouterAuthError as e:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "authentication_error",
                "message": str(e),
            },
        )

    except OpenRouterRateLimitError as e:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limit_exceeded",
                "message": str(e),
            },
        )

    except OpenRouterAPIError as e:
        # Return a failed response for API errors instead of raising
        return VideoEditResponse(
            job_id=job_id,
            status=JobStatus.FAILED,
            original_filename=file.filename,
            model=model_to_use,
            edit_prompt=edit_prompt,
            created_at=datetime.utcnow(),
            error=str(e),
        )

    except Exception as e:
        # Unexpected errors
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_error",
                "message": f"An unexpected error occurred: {str(e)}",
            },
        )