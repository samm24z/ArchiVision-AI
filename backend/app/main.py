"""
ArchiVision AI — FastAPI application entry point.

Milestone M1: Health endpoint, CORS, and application configuration.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="ArchiVision AI API",
    description="Backend API for ArchiVision AI — architecture copilot platform.",
    version="0.0.1",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.environment == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
