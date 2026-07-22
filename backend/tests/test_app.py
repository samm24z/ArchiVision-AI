"""M0 backend test scaffold."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_app_imports() -> None:
    """FastAPI application instance is created."""
    assert app.title == "ArchiVision AI API"
    assert app.version == "0.0.1"


def test_no_routes_registered_in_m0() -> None:
    """M0 exposes no HTTP routes — endpoints begin in M1."""
    assert len(app.routes) == 0
