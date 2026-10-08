"""S4.1 asset validation and API contract tests."""

from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.routes.assets import get_assets_repository
from app.core.asset_validation import AssetValidationError, validate_upload
from app.core.assets import AssetNotFoundError, AssetReconciliationError
from app.core.config import Settings, get_settings
from app.main import app
from app.schemas.assets import (
    AssetCategory,
    AssetResponse,
    SignedAssetUrlResponse,
    UploadStatus,
)
from tests.test_auth import TEST_JWT_SECRET, TEST_USER_ID, make_test_jwt

SECOND_USER_ID = str(uuid4())
PROJECT_ID = uuid4()


def get_asset_test_settings() -> Settings:
    """Return settings for local JWT validation in asset endpoint tests."""
    return Settings(
        ENVIRONMENT="development",
        API_HOST="0.0.0.0",
        API_PORT=8000,
        API_CORS_ORIGINS="http://localhost:3000",
        SUPABASE_URL="https://test-project.supabase.co",
        SUPABASE_JWT_SECRET=TEST_JWT_SECRET,
    )


def jpeg_bytes(width: int = 640, height: int = 480) -> bytes:
    """Build the smallest signature/dimension-valid JPEG fixture."""
    return (
        b"\xff\xd8"
        + b"\xff\xc0"
        + b"\x00\x11\x08"
        + height.to_bytes(2, "big")
        + width.to_bytes(2, "big")
        + b"\x00" * 10
    )


def png_bytes(width: int = 320, height: int = 240) -> bytes:
    """Build a PNG signature with an IHDR dimension block."""
    return (
        b"\x89PNG\r\n\x1a\n"
        + b"\x00\x00\x00\x0d"
        + b"IHDR"
        + width.to_bytes(4, "big")
        + height.to_bytes(4, "big")
        + b"\x08\x02"
        + b"\x00" * 10
    )


def webp_bytes(width: int = 128, height: int = 96) -> bytes:
    """Build a VP8X WebP dimension fixture."""
    return (
        b"RIFF"
        + b"\x00" * 4
        + b"WEBP"
        + b"VP8X"
        + b"\x00" * 8
        + (width - 1).to_bytes(3, "little")
        + (height - 1).to_bytes(3, "little")
    )


def pdf_bytes() -> bytes:
    """Build a minimal PDF signature fixture."""
    return b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF"


def asset_response(
    *,
    project_id: UUID = PROJECT_ID,
    status: UploadStatus = UploadStatus.AVAILABLE,
) -> AssetResponse:
    """Build a representative asset response for API tests."""
    now = datetime.now(UTC)
    return AssetResponse(
        id=uuid4(),
        project_id=project_id,
        category=AssetCategory.SKETCH,
        original_filename="plan.png",
        storage_path=f"projects/{project_id}/assets/{uuid4()}/plan.png",
        mime_type="image/png",
        file_size_bytes=128,
        width=320,
        height=240,
        upload_status=status,
        created_at=now,
        updated_at=now,
    )


class FakeAssetsRepository:
    """Route-level double; real Storage behavior requires integration testing."""

    def __init__(self) -> None:
        self.asset = asset_response()
        self.create_calls = 0
        self.deleted = False

    async def create(self, owner_id: UUID, project_id: UUID, upload):
        if owner_id != UUID(TEST_USER_ID) or project_id != PROJECT_ID:
            raise AssetNotFoundError
        self.create_calls += 1
        return self.asset

    async def list(self, owner_id: UUID, project_id: UUID):
        if owner_id != UUID(TEST_USER_ID) or project_id != PROJECT_ID:
            raise AssetNotFoundError
        return [] if self.deleted else [self.asset]

    async def get(self, owner_id: UUID, asset_id: UUID):
        if owner_id != UUID(TEST_USER_ID) or asset_id != self.asset.id:
            raise AssetNotFoundError
        return self.asset

    async def signed_url(self, owner_id: UUID, asset_id: UUID):
        if owner_id != UUID(TEST_USER_ID) or asset_id != self.asset.id:
            raise AssetNotFoundError
        return SignedAssetUrlResponse(
            asset_id=self.asset.id,
            signed_url="https://signed.example/asset",
        )

    async def soft_delete(self, owner_id: UUID, asset_id: UUID):
        if owner_id != UUID(TEST_USER_ID) or asset_id != self.asset.id:
            raise AssetNotFoundError
        self.deleted = True


def auth_header(user_id: str = TEST_USER_ID) -> dict[str, str]:
    """Create a valid bearer header for an asset test user."""
    return {"Authorization": f"Bearer {make_test_jwt(sub=user_id)}"}


@pytest.mark.parametrize(
    ("category", "filename", "content", "mime"),
    [
        ("sketch", "sketch.jpg", jpeg_bytes(), "image/jpeg"),
        ("sketch", "sketch.png", png_bytes(), "image/png"),
        ("sketch", "sketch.webp", webp_bytes(), "image/webp"),
        ("floor_plan", "plan.jpg", jpeg_bytes(), "image/jpeg"),
        ("floor_plan", "plan.png", png_bytes(), "image/png"),
        ("floor_plan", "plan.pdf", pdf_bytes(), "application/pdf"),
        ("reference_image", "reference.jpg", jpeg_bytes(), "image/jpeg"),
        ("reference_image", "reference.png", png_bytes(), "image/png"),
        ("reference_image", "reference.webp", webp_bytes(), "image/webp"),
        ("document", "brief.pdf", pdf_bytes(), "application/pdf"),
    ],
)
def test_category_format_matrix_accepts_valid_combinations(
    category: str, filename: str, content: bytes, mime: str
) -> None:
    """Every approved category/format combination is accepted."""
    upload = validate_upload(content, category, filename, mime)
    assert upload.category.value == category
    assert upload.mime_type == mime


@pytest.mark.parametrize(
    ("category", "filename", "content", "mime"),
    [
        ("sketch", "sketch.pdf", pdf_bytes(), "application/pdf"),
        ("floor_plan", "plan.webp", webp_bytes(), "image/webp"),
        ("reference_image", "reference.pdf", pdf_bytes(), "application/pdf"),
        ("document", "brief.png", png_bytes(), "image/png"),
    ],
)
def test_category_format_matrix_rejects_invalid_combinations(
    category: str, filename: str, content: bytes, mime: str
) -> None:
    """Formats outside the frozen category matrix are rejected."""
    with pytest.raises(AssetValidationError):
        validate_upload(content, category, filename, mime)


def test_size_boundary_and_oversize() -> None:
    """The 20 MiB boundary is accepted and the next byte is rejected."""
    boundary = b"%PDF-" + b"a" * (20 * 1024 * 1024 - 5)
    assert validate_upload(boundary, "document", "file.pdf", "application/pdf")
    with pytest.raises(AssetValidationError) as error:
        validate_upload(boundary + b"a", "document", "file.pdf", "application/pdf")
    assert error.value.status_code == 413


def test_signature_and_extension_validation() -> None:
    """Declared MIME, extension, and content signature must agree."""
    with pytest.raises(AssetValidationError):
        validate_upload(png_bytes(), "sketch", "image.jpg", "image/png")
    with pytest.raises(AssetValidationError):
        validate_upload(png_bytes(), "sketch", "image.png", "image/jpeg")
    with pytest.raises(AssetValidationError) as error:
        validate_upload(b"not-an-image", "sketch", "image.png", "image/png")
    assert error.value.status_code == 415


def test_unsafe_filename_is_normalized_without_path_traversal() -> None:
    """Directory syntax is discarded and cannot enter the generated filename."""
    upload = validate_upload(
        png_bytes(), "sketch", "../../safe plan.png", "image/png"
    )
    assert "/" not in upload.filename
    assert "\\" not in upload.filename
    assert ".." not in upload.filename


def test_dimensions_and_pdf_null_dimensions() -> None:
    """Images store dimensions while PDFs retain null dimensions."""
    image = validate_upload(png_bytes(111, 222), "sketch", "image.png", "image/png")
    document = validate_upload(pdf_bytes(), "document", "brief.pdf", "application/pdf")
    assert (image.width, image.height) == (111, 222)
    assert document.width is None
    assert document.height is None


def test_migration_contains_frozen_asset_contract() -> None:
    """The next migration text contains the required S4.1 contract."""
    migration = (
        Path(__file__).parents[2]
        / "supabase/migrations/00003_create_assets_and_storage.sql"
    )
    text = migration.read_text(encoding="utf-8")
    for required in (
        "CREATE TABLE public.assets",
        "file_size_bytes <= 20971520",
        "assets_category_mime_check",
        "project-assets",
        "ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY",
        "storage.objects",
        "Users can read assets in their own projects",
    ):
        assert required in text


@pytest.fixture
def asset_client() -> tuple[TestClient, FakeAssetsRepository]:
    """Provide an isolated asset route client."""
    repository = FakeAssetsRepository()
    app.dependency_overrides[get_settings] = get_asset_test_settings
    app.dependency_overrides[get_assets_repository] = lambda: repository
    with TestClient(app) as client:
        yield client, repository
    app.dependency_overrides.pop(get_assets_repository, None)
    app.dependency_overrides.pop(get_settings, None)


def test_asset_routes_require_authentication(
    asset_client: tuple[TestClient, FakeAssetsRepository],
) -> None:
    """Asset endpoints use the existing M2 authentication dependency."""
    client, _ = asset_client
    assert client.get(f"/api/v1/projects/{PROJECT_ID}/assets").status_code == 401
    assert client.get(f"/api/v1/assets/{uuid4()}").status_code == 401


def test_upload_list_signed_url_and_delete_route_contract(
    asset_client: tuple[TestClient, FakeAssetsRepository],
) -> None:
    """The route contract carries ownership and lifecycle operations."""
    client, repository = asset_client
    created = client.post(
        f"/api/v1/projects/{PROJECT_ID}/assets",
        headers=auth_header(),
        data={"category": "sketch"},
        files={"file": ("sketch.png", png_bytes(), "image/png")},
    )
    assert created.status_code == 201
    assert repository.create_calls == 1

    asset_id = created.json()["id"]
    assert client.get(
        f"/api/v1/projects/{PROJECT_ID}/assets", headers=auth_header()
    ).status_code == 200
    assert client.get(
        f"/api/v1/assets/{asset_id}", headers=auth_header()
    ).status_code == 200
    assert client.post(
        f"/api/v1/assets/{asset_id}/signed-url", headers=auth_header()
    ).status_code == 200
    assert client.delete(
        f"/api/v1/assets/{asset_id}", headers=auth_header()
    ).status_code == 204
    assert repository.deleted is True


def test_cross_user_asset_access_is_not_found(
    asset_client: tuple[TestClient, FakeAssetsRepository],
) -> None:
    """Foreign users cannot use asset metadata or access operations."""
    client, repository = asset_client
    asset_id = str(repository.asset.id)
    foreign_headers = auth_header(SECOND_USER_ID)
    assert client.get(
        f"/api/v1/assets/{asset_id}", headers=foreign_headers
    ).status_code == 404
    assert client.post(
        f"/api/v1/assets/{asset_id}/signed-url", headers=foreign_headers
    ).status_code == 404
    assert client.delete(
        f"/api/v1/assets/{asset_id}", headers=foreign_headers
    ).status_code == 404


def test_reconciliation_error_is_not_hidden(
    asset_client: tuple[TestClient, FakeAssetsRepository],
) -> None:
    """Lifecycle reconciliation failures are surfaced as a server error."""
    client, repository = asset_client

    async def fail_delete(owner_id: UUID, asset_id: UUID) -> None:
        raise AssetReconciliationError("reconciliation required")

    repository.soft_delete = fail_delete
    response = client.delete(
        f"/api/v1/assets/{repository.asset.id}", headers=auth_header()
    )
    assert response.status_code == 502
