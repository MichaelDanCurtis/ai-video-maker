"""
OpenRouter API client service.

Provides a unified interface for interacting with OpenRouter's AI models
for image generation, chat completions, and other AI tasks.
"""

import uuid
from contextlib import asynccontextmanager, contextmanager
from typing import Any, AsyncGenerator, Generator, Optional

import httpx

from app.config import Settings, get_settings


class OpenRouterError(Exception):
    """Base exception for OpenRouter API errors."""

    def __init__(self, message: str, status_code: Optional[int] = None, details: Optional[dict] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class OpenRouterAuthError(OpenRouterError):
    """Authentication error with OpenRouter API."""
    pass


class OpenRouterRateLimitError(OpenRouterError):
    """Rate limit exceeded on OpenRouter API."""
    pass


class OpenRouterAPIError(OpenRouterError):
    """General API error from OpenRouter."""
    pass


class OpenRouterClient:
    """
    OpenRouter API client with context manager support.

    This client provides methods for interacting with OpenRouter's API
    for image generation, chat completions, and model information.

    Usage:
        # Synchronous context manager
        with OpenRouterClient() as client:
            response = client.generate_image(prompt="A sunset over mountains")

        # Async context manager
        async with OpenRouterClient() as client:
            response = await client.generate_image_async(prompt="A sunset over mountains")

        # Direct instantiation (manual cleanup required)
        client = OpenRouterClient()
        try:
            response = client.generate_image(prompt="A sunset over mountains")
        finally:
            client.close()
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        settings: Optional[Settings] = None,
        timeout: float = 120.0,
    ):
        """
        Initialize the OpenRouter client.

        Args:
            api_key: OpenRouter API key. If not provided, uses settings.
            base_url: Base URL for OpenRouter API. If not provided, uses settings.
            settings: Application settings. If not provided, uses get_settings().
            timeout: Request timeout in seconds (default: 120s for long AI operations).
        """
        self._settings = settings or get_settings()
        self._api_key = api_key or self._settings.openrouter_api_key
        self._base_url = (base_url or self._settings.openrouter_base_url).rstrip("/")
        self._timeout = timeout

        # HTTP clients (initialized lazily)
        self._sync_client: Optional[httpx.Client] = None
        self._async_client: Optional[httpx.AsyncClient] = None

    @property
    def _headers(self) -> dict[str, str]:
        """Get common headers for API requests."""
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ai-video-maker.local",
            "X-Title": "AI Video Maker",
        }

    @property
    def sync_client(self) -> httpx.Client:
        """Get or create synchronous HTTP client."""
        if self._sync_client is None:
            self._sync_client = httpx.Client(
                base_url=self._base_url,
                headers=self._headers,
                timeout=self._timeout,
            )
        return self._sync_client

    @property
    def async_client(self) -> httpx.AsyncClient:
        """Get or create asynchronous HTTP client."""
        if self._async_client is None:
            self._async_client = httpx.AsyncClient(
                base_url=self._base_url,
                headers=self._headers,
                timeout=self._timeout,
            )
        return self._async_client

    def _validate_api_key(self) -> None:
        """Validate that API key is configured."""
        if not self._api_key:
            raise OpenRouterAuthError(
                "OpenRouter API key not configured. "
                "Set OPENROUTER_API_KEY environment variable."
            )

    def _handle_response_error(self, response: httpx.Response) -> None:
        """Handle error responses from the API."""
        if response.status_code == 401:
            raise OpenRouterAuthError(
                "Invalid OpenRouter API key",
                status_code=401,
            )
        elif response.status_code == 429:
            raise OpenRouterRateLimitError(
                "OpenRouter rate limit exceeded. Please try again later.",
                status_code=429,
            )
        elif response.status_code >= 400:
            try:
                error_data = response.json()
                message = error_data.get("error", {}).get("message", response.text)
            except Exception:
                message = response.text
            raise OpenRouterAPIError(
                f"OpenRouter API error: {message}",
                status_code=response.status_code,
                details={"response": response.text},
            )

    def _generate_job_id(self, prefix: str = "gen") -> str:
        """Generate a unique job ID."""
        return f"{prefix}_{uuid.uuid4().hex[:12]}"

    # =========================================================================
    # Context Manager Protocol
    # =========================================================================

    def __enter__(self) -> "OpenRouterClient":
        """Enter sync context manager."""
        self._validate_api_key()
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Exit sync context manager and cleanup resources."""
        self.close()

    async def __aenter__(self) -> "OpenRouterClient":
        """Enter async context manager."""
        self._validate_api_key()
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Exit async context manager and cleanup resources."""
        await self.aclose()

    def close(self) -> None:
        """Close synchronous HTTP client."""
        if self._sync_client is not None:
            self._sync_client.close()
            self._sync_client = None

    async def aclose(self) -> None:
        """Close asynchronous HTTP client."""
        if self._async_client is not None:
            await self._async_client.aclose()
            self._async_client = None

    # =========================================================================
    # Image Generation
    # =========================================================================

    def generate_image(
        self,
        prompt: str,
        model: Optional[str] = None,
        size: str = "1024x1024",
        quality: str = "standard",
        style: Optional[str] = None,
        n: int = 1,
    ) -> dict[str, Any]:
        """
        Generate an image from a text prompt (synchronous).

        Args:
            prompt: Text description of the image to generate.
            model: Model to use (defaults to settings.default_image_model).
            size: Image size in WxH format.
            quality: Image quality ('standard' or 'hd').
            style: Optional style hint (model-specific).
            n: Number of images to generate.

        Returns:
            Dict containing generation results with image URLs or base64 data.

        Raises:
            OpenRouterError: On API errors.
        """
        self._validate_api_key()
        model = model or self._settings.default_image_model

        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "n": n,
            "size": size,
            "quality": quality,
        }
        if style:
            payload["style"] = style

        response = self.sync_client.post("/images/generations", json=payload)
        self._handle_response_error(response)
        return response.json()

    async def generate_image_async(
        self,
        prompt: str,
        model: Optional[str] = None,
        size: str = "1024x1024",
        quality: str = "standard",
        style: Optional[str] = None,
        n: int = 1,
    ) -> dict[str, Any]:
        """
        Generate an image from a text prompt (asynchronous).

        Args:
            prompt: Text description of the image to generate.
            model: Model to use (defaults to settings.default_image_model).
            size: Image size in WxH format.
            quality: Image quality ('standard' or 'hd').
            style: Optional style hint (model-specific).
            n: Number of images to generate.

        Returns:
            Dict containing generation results with image URLs or base64 data.

        Raises:
            OpenRouterError: On API errors.
        """
        self._validate_api_key()
        model = model or self._settings.default_image_model

        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "n": n,
            "size": size,
            "quality": quality,
        }
        if style:
            payload["style"] = style

        response = await self.async_client.post("/images/generations", json=payload)
        self._handle_response_error(response)
        return response.json()

    # =========================================================================
    # Chat Completions (for text-based AI tasks)
    # =========================================================================

    def chat_completion(
        self,
        messages: list[dict[str, str]],
        model: str = "anthropic/claude-3.5-sonnet",
        max_tokens: Optional[int] = None,
        temperature: float = 0.7,
        stream: bool = False,
    ) -> dict[str, Any]:
        """
        Send a chat completion request (synchronous).

        Args:
            messages: List of message dicts with 'role' and 'content' keys.
            model: Model to use for completion.
            max_tokens: Maximum tokens in response.
            temperature: Sampling temperature (0.0 to 2.0).
            stream: Whether to stream the response.

        Returns:
            Dict containing the completion response.

        Raises:
            OpenRouterError: On API errors.
        """
        self._validate_api_key()

        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        response = self.sync_client.post("/chat/completions", json=payload)
        self._handle_response_error(response)
        return response.json()

    async def chat_completion_async(
        self,
        messages: list[dict[str, str]],
        model: str = "anthropic/claude-3.5-sonnet",
        max_tokens: Optional[int] = None,
        temperature: float = 0.7,
        stream: bool = False,
    ) -> dict[str, Any]:
        """
        Send a chat completion request (asynchronous).

        Args:
            messages: List of message dicts with 'role' and 'content' keys.
            model: Model to use for completion.
            max_tokens: Maximum tokens in response.
            temperature: Sampling temperature (0.0 to 2.0).
            stream: Whether to stream the response.

        Returns:
            Dict containing the completion response.

        Raises:
            OpenRouterError: On API errors.
        """
        self._validate_api_key()

        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        response = await self.async_client.post("/chat/completions", json=payload)
        self._handle_response_error(response)
        return response.json()

    # =========================================================================
    # Model Information
    # =========================================================================

    def list_models(self) -> dict[str, Any]:
        """
        List available models (synchronous).

        Returns:
            Dict containing list of available models.

        Raises:
            OpenRouterError: On API errors.
        """
        self._validate_api_key()
        response = self.sync_client.get("/models")
        self._handle_response_error(response)
        return response.json()

    async def list_models_async(self) -> dict[str, Any]:
        """
        List available models (asynchronous).

        Returns:
            Dict containing list of available models.

        Raises:
            OpenRouterError: On API errors.
        """
        self._validate_api_key()
        response = await self.async_client.get("/models")
        self._handle_response_error(response)
        return response.json()

    # =========================================================================
    # Utility Methods
    # =========================================================================

    def is_configured(self) -> bool:
        """Check if the client is properly configured with an API key."""
        return bool(self._api_key)

    def get_default_image_model(self) -> str:
        """Get the default image generation model from settings."""
        return self._settings.default_image_model

    def get_default_video_model(self) -> str:
        """Get the default video generation model from settings."""
        return self._settings.default_video_model


# =============================================================================
# Factory Functions
# =============================================================================


@contextmanager
def get_openrouter_client(
    api_key: Optional[str] = None,
    settings: Optional[Settings] = None,
) -> Generator[OpenRouterClient, None, None]:
    """
    Context manager factory for synchronous OpenRouter client.

    Usage:
        with get_openrouter_client() as client:
            result = client.generate_image(prompt="A beautiful sunset")

    Args:
        api_key: Optional API key override.
        settings: Optional settings override.

    Yields:
        Configured OpenRouterClient instance.
    """
    client = OpenRouterClient(api_key=api_key, settings=settings)
    try:
        yield client
    finally:
        client.close()


@asynccontextmanager
async def get_openrouter_client_async(
    api_key: Optional[str] = None,
    settings: Optional[Settings] = None,
) -> AsyncGenerator[OpenRouterClient, None]:
    """
    Async context manager factory for OpenRouter client.

    Usage:
        async with get_openrouter_client_async() as client:
            result = await client.generate_image_async(prompt="A beautiful sunset")

    Args:
        api_key: Optional API key override.
        settings: Optional settings override.

    Yields:
        Configured OpenRouterClient instance.
    """
    client = OpenRouterClient(api_key=api_key, settings=settings)
    try:
        yield client
    finally:
        await client.aclose()
