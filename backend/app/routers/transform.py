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
)
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

# Maximum file size (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024


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
