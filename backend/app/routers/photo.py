"""
Photo generation API router.

Provides endpoints for generating photos/images from text prompts using AI models.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.models.schemas import (
    ErrorResponse,
    JobStatus,
    PhotoGenerationRequest,
    PhotoGenerationResponse,
)
from app.services.openrouter import (
    OpenRouterClient,
    OpenRouterAuthError,
    OpenRouterRateLimitError,
    OpenRouterAPIError,
    get_openrouter_client_async,
)

router = APIRouter(prefix="/api/v1/photo", tags=["photo"])


def _generate_job_id() -> str:
    """Generate a unique job ID for photo generation."""
    return f"photo_{uuid.uuid4().hex[:12]}"


@router.post(
    "/generate",
    response_model=PhotoGenerationResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request parameters"},
        401: {"model": ErrorResponse, "description": "API key not configured or invalid"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def generate_photo(request: PhotoGenerationRequest) -> PhotoGenerationResponse:
    """
    Generate a photo from a text prompt using AI.

    This endpoint uses OpenRouter's image generation models to create images
    from text descriptions. The generation may take several seconds depending
    on the model and parameters.

    Args:
        request: Photo generation request containing the prompt and options.

    Returns:
        PhotoGenerationResponse with the generated image URL or base64 data.

    Raises:
        HTTPException: On validation errors, authentication failures, or API errors.
    """
    settings = get_settings()
    job_id = _generate_job_id()

    # Use default model if not specified
    model = request.model or settings.default_image_model

    try:
        async with get_openrouter_client_async() as client:
            # Call OpenRouter API to generate image
            result = await client.generate_image_async(
                prompt=request.prompt,
                model=model,
                size=request.size,
                quality=request.quality,
                style=request.style,
                n=request.n,
            )

            # Extract image data from response
            # OpenRouter returns images in data array with url or b64_json
            image_url = None
            image_base64 = None

            if "data" in result and len(result["data"]) > 0:
                image_data = result["data"][0]
                image_url = image_data.get("url")
                image_base64 = image_data.get("b64_json")

            return PhotoGenerationResponse(
                job_id=job_id,
                status=JobStatus.COMPLETED,
                image_url=image_url,
                image_base64=image_base64,
                model=model,
                prompt=request.prompt,
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
        return PhotoGenerationResponse(
            job_id=job_id,
            status=JobStatus.FAILED,
            model=model,
            prompt=request.prompt,
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
