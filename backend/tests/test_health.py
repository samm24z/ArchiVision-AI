"""Health endpoint tests."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    """GET /health returns 200 with expected payload."""
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "archivision-ai-api"
    assert payload["version"] == "0.0.1"
    assert "environment" in payload


def test_health_cors_allows_localhost_origin() -> None:
    """CORS headers are present for allowed frontend origin."""
    response = client.get(
        "/health",
        headers={"Origin": "http://localhost:3000"},
    )

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
