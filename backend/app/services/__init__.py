"""
Services module containing external API clients and business logic services.
"""

from app.services.openrouter import (
    OpenRouterClient,
    OpenRouterError,
    OpenRouterAuthError,
    OpenRouterRateLimitError,
    OpenRouterAPIError,
    get_openrouter_client,
    get_openrouter_client_async,
)

__all__ = [
    # Client class
    "OpenRouterClient",
    # Exceptions
    "OpenRouterError",
    "OpenRouterAuthError",
    "OpenRouterRateLimitError",
    "OpenRouterAPIError",
    # Factory functions
    "get_openrouter_client",
    "get_openrouter_client_async",
]
