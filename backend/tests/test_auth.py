"""
Authentication Endpoint and JWT Verification Tests.

Validates that GET /api/v1/auth/me rejects missing, malformed, invalid,
expired, or wrong-audience JWTs with HTTP 401, and accepts valid Supabase JWTs
(both symmetric HS256 and asymmetric RS256/ES256 via JWKS) returning verified
user identity.
"""

import time
from unittest.mock import MagicMock, patch
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.core.auth import decode_supabase_jwt
from app.core.config import Settings, get_settings
from app.main import app

TEST_JWT_SECRET = "super-secret-test-jwt-key-minimum-32-chars-for-hs256!"
TEST_USER_ID = str(uuid4())
TEST_USER_EMAIL = "architect@archivision.ai"

# Generate deterministic in-memory RSA key pair for asymmetric JWT tests
_test_rsa_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
TEST_RSA_PRIVATE_PEM = _test_rsa_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
).decode("utf-8")
TEST_RSA_PUBLIC_KEY = _test_rsa_key.public_key()


def get_test_settings() -> Settings:
    """Return test settings with configured test JWT secret."""
    return Settings(
        ENVIRONMENT="development",
        API_HOST="0.0.0.0",
        API_PORT=8000,
        API_CORS_ORIGINS="http://localhost:3000",
        SUPABASE_URL="https://test-project.supabase.co",
        SUPABASE_JWT_SECRET=TEST_JWT_SECRET,
    )


@pytest.fixture(autouse=True)
def override_settings():
    """Apply test settings override to the FastAPI app for all tests."""
    app.dependency_overrides[get_settings] = get_test_settings
    yield
    app.dependency_overrides.pop(get_settings, None)


@pytest.fixture
def client() -> TestClient:
    """FastAPI TestClient fixture."""
    return TestClient(app)


def make_test_jwt(
    sub: str = TEST_USER_ID,
    email: str = TEST_USER_EMAIL,
    role: str = "authenticated",
    aud: str = "authenticated",
    exp_offset_seconds: int = 3600,
    secret: str = TEST_JWT_SECRET,
    algorithm: str = "HS256",
    headers: dict | None = None,
    custom_claims: dict | None = None,
) -> str:
    """Create a signed JWT token for testing."""
    now = int(time.time())
    payload = {
        "sub": sub,
        "email": email,
        "role": role,
        "aud": aud,
        "exp": now + exp_offset_seconds,
        "iat": now,
        "app_metadata": {"provider": "email"},
        "user_metadata": {"full_name": "Test Architect"},
    }
    if custom_claims:
        payload.update(custom_claims)
    return jwt.encode(payload, secret, algorithm=algorithm, headers=headers)


# -----------------------------------------------------------------------------
# Symmetric (HS256) Tests
# -----------------------------------------------------------------------------


def test_auth_me_missing_authorization_header(client: TestClient) -> None:
    """GET /api/v1/auth/me without Authorization header returns 401."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "detail" in response.json()
    assert response.headers.get("www-authenticate") == "Bearer"


def test_auth_me_malformed_authorization_header(client: TestClient) -> None:
    """GET /api/v1/auth/me with non-Bearer or invalid scheme returns 401."""
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Basic dXNlcjpwYXNz"},
    )
    assert response.status_code == 401


def test_auth_me_empty_bearer_token(client: TestClient) -> None:
    """GET /api/v1/auth/me with empty token string returns 401."""
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer "},
    )
    assert response.status_code == 401


def test_auth_me_invalid_token_signature(client: TestClient) -> None:
    """GET /api/v1/auth/me signed with a different secret returns 401."""
    wrong_token = make_test_jwt(secret="wrong-secret-key-that-does-not-match-at-all!")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {wrong_token}"},
    )
    assert response.status_code == 401
    assert "signature" in response.json()["detail"].lower()


def test_auth_me_expired_token(client: TestClient) -> None:
    """GET /api/v1/auth/me with an expired token returns 401."""
    expired_token = make_test_jwt(exp_offset_seconds=-60)
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_auth_me_wrong_audience(client: TestClient) -> None:
    """GET /api/v1/auth/me with aud != 'authenticated' returns 401."""
    wrong_aud_token = make_test_jwt(aud="anon")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {wrong_aud_token}"},
    )
    assert response.status_code == 401
    assert "audience" in response.json()["detail"].lower()


def test_auth_me_invalid_subject_uuid(client: TestClient) -> None:
    """GET /api/v1/auth/me with non-UUID sub claim returns 401."""
    invalid_sub_token = make_test_jwt(sub="not-a-uuid")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {invalid_sub_token}"},
    )
    assert response.status_code == 401
    assert "uuid" in response.json()["detail"].lower()


def test_auth_me_valid_hs256_token_returns_user_info(client: TestClient) -> None:
    """GET /api/v1/auth/me with valid HS256 JWT returns 200 with user claims."""
    valid_token = make_test_jwt()
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == TEST_USER_ID
    assert data["email"] == TEST_USER_EMAIL
    assert data["role"] == "authenticated"
    assert data["user_metadata"]["full_name"] == "Test Architect"


# -----------------------------------------------------------------------------
# Asymmetric (RS256 / JWKS) & Security Restriction Tests
# -----------------------------------------------------------------------------


def test_auth_rejects_unsupported_algorithm(client: TestClient) -> None:
    """Tokens with unauthorized algs (e.g. 'none', 'HS512') are rejected."""
    # Test 'none' algorithm
    none_token = jwt.encode(
        {"sub": TEST_USER_ID, "aud": "authenticated", "exp": int(time.time()) + 3600},
        key="",
        algorithm="none",
    )
    res_none = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {none_token}"},
    )
    assert res_none.status_code == 401
    assert "unsupported" in res_none.json()["detail"].lower()


def test_auth_me_valid_asymmetric_token(client: TestClient) -> None:
    """GET /api/v1/auth/me verifies valid asymmetric RS256 token via mocked JWKS."""
    asymmetric_token = make_test_jwt(
        secret=TEST_RSA_PRIVATE_PEM,
        algorithm="RS256",
        headers={"kid": "test-key-id-1", "alg": "RS256"},
    )

    mock_signing_key = MagicMock()
    mock_signing_key.key = TEST_RSA_PUBLIC_KEY

    mock_jwks_client = MagicMock()
    mock_jwks_client.get_signing_key_from_jwt.return_value = mock_signing_key

    with patch("app.core.auth.get_jwks_client", return_value=mock_jwks_client):
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {asymmetric_token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == TEST_USER_ID
    assert data["email"] == TEST_USER_EMAIL
    assert data["role"] == "authenticated"


def test_auth_me_asymmetric_expired_token(client: TestClient) -> None:
    """Asymmetric RS256 token that is expired returns 401."""
    expired_asym_token = make_test_jwt(
        secret=TEST_RSA_PRIVATE_PEM,
        algorithm="RS256",
        exp_offset_seconds=-120,
        headers={"kid": "test-key-id-1", "alg": "RS256"},
    )

    mock_signing_key = MagicMock()
    mock_signing_key.key = TEST_RSA_PUBLIC_KEY

    mock_jwks_client = MagicMock()
    mock_jwks_client.get_signing_key_from_jwt.return_value = mock_signing_key

    with patch("app.core.auth.get_jwks_client", return_value=mock_jwks_client):
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {expired_asym_token}"},
        )

    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_auth_me_asymmetric_wrong_signature(client: TestClient) -> None:
    """Asymmetric RS256 token signed by an untrusted key fails verification."""
    # Generate another untrusted RSA key
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    other_pem = other_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    untrusted_token = make_test_jwt(
        secret=other_pem,
        algorithm="RS256",
        headers={"kid": "test-key-id-1", "alg": "RS256"},
    )

    mock_signing_key = MagicMock()
    # Server verifies against trusted JWKS key
    mock_signing_key.key = TEST_RSA_PUBLIC_KEY

    mock_jwks_client = MagicMock()
    mock_jwks_client.get_signing_key_from_jwt.return_value = mock_signing_key

    with patch("app.core.auth.get_jwks_client", return_value=mock_jwks_client):
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {untrusted_token}"},
        )

    assert response.status_code == 401
    assert "signature" in response.json()["detail"].lower()


def test_decode_supabase_jwt_missing_supabase_url_for_asymmetric() -> None:
    """AuthError raised if asymmetric token given without SUPABASE_URL."""
    token = make_test_jwt(
        secret=TEST_RSA_PRIVATE_PEM,
        algorithm="RS256",
        headers={"kid": "test-key-id-1", "alg": "RS256"},
    )
    with pytest.raises(Exception) as exc_info:
        decode_supabase_jwt(token, jwt_secret="some-secret", supabase_url="")
    assert "supabase_url is required" in str(exc_info.value).lower()
