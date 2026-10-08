"""Asset API schemas and validation constants."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel

MAX_ASSET_SIZE_BYTES = 20 * 1024 * 1024
STORAGE_BUCKET = "project-assets"
SIGNED_URL_EXPIRY_SECONDS = 15 * 60


class AssetCategory(StrEnum):
    """Asset categories supported by M4."""

    SKETCH = "sketch"
    FLOOR_PLAN = "floor_plan"
    REFERENCE_IMAGE = "reference_image"
    DOCUMENT = "document"


class UploadStatus(StrEnum):
    """Asset metadata lifecycle statuses."""

    UPLOADING = "uploading"
    AVAILABLE = "available"
    FAILED = "failed"


class AssetResponse(BaseModel):
    """Asset metadata returned by the API."""

    id: UUID
    project_id: UUID
    category: AssetCategory
    original_filename: str
    storage_path: str
    mime_type: str
    file_size_bytes: int
    width: int | None = None
    height: int | None = None
    metadata: dict[str, Any] | None = None
    upload_status: UploadStatus
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class SignedAssetUrlResponse(BaseModel):
    """Authorized short-lived asset access URL."""

    asset_id: UUID
    signed_url: str
    expires_in_seconds: int = SIGNED_URL_EXPIRY_SECONDS