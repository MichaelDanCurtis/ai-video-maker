"""
FastAPI application entry point.

This module initializes the FastAPI application with CORS middleware
and configures the basic application structure.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routers import (
    health_router,
    jobs_router,
    models_router,
    photo_router,
    project_router,
    transform_router,
    video_router,
)
from app.services.mlx.paths import outputs_dir
from app.services.mlx.worker import start_worker, stop_worker

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    start_worker()
    yield
    stop_worker()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-powered multimedia creation and editing API",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(models_router)
app.include_router(jobs_router)
app.include_router(photo_router)
app.include_router(project_router)
app.include_router(transform_router)
app.include_router(video_router)

outputs_dir().mkdir(parents=True, exist_ok=True)
app.mount(settings.media_url_prefix, StaticFiles(directory=str(outputs_dir())), name="media")


@app.get("/")
async def root():
    """Root endpoint returning API information."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "inference_backend": settings.inference_backend,
        "mlx_enabled": settings.mlx_enabled,
    }