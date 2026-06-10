"""
Routers module containing API endpoint definitions.

Each router handles a specific domain of the API (health, photo, video, etc.).
"""

from app.routers.health import router as health_router
from app.routers.jobs import router as jobs_router
from app.routers.models import router as models_router
from app.routers.photo import router as photo_router
from app.routers.transform import router as transform_router
from app.routers.video import router as video_router

__all__ = [
    "health_router",
    "jobs_router",
    "models_router",
    "photo_router",
    "transform_router",
    "video_router",
]