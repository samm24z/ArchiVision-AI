"""Application bootstrap tests."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_app_imports() -> None:
    """FastAPI application instance is created with expected metadata."""
    assert app.title == "ArchiVision AI API"
    assert app.version == "0.0.1"


def test_health_route_registered() -> None:
    """M1 registers the health route."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
