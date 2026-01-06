"""
Routers module containing API endpoint definitions.

Each router handles a specific domain of the API (health, photo, video, etc.).
"""

from app.routers.health import router as health_router
from app.routers.photo import router as photo_router
from app.routers.transform import router as transform_router

__all__ = [
    "health_router",
    "photo_router",
    "transform_router",
]
