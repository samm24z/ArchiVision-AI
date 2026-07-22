"""
ArchiVision AI — FastAPI application entry point.

Milestone M0: Application instance only. No HTTP routes.
Routes and middleware are added starting in Milestone M1.
"""

from fastapi import FastAPI

app = FastAPI(
    title="ArchiVision AI API",
    description="Backend API for ArchiVision AI — architecture copilot platform.",
    version="0.0.1",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
