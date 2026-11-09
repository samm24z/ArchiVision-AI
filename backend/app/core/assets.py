"""Supabase persistence and Storage operations for M4 assets."""

from datetime import UTC, datetime
from urllib.parse import quote
from uuid import UUID, uuid4

import httpx

from app.core.asset_validation import ParsedUpload
from app.core.config import Settings
from app.schemas.assets import (
    SIGNED_URL_EXPIRY_SECONDS,
    STORAGE_BUCKET,
    AssetResponse,
    SignedAssetUrlResponse,
    UploadStatus,
)


class AssetNotFoundError(Exception):
    """Raised when an asset or owning project is not available to the user."""


class AssetRepositoryError(Exception):
    """Raised when Supabase cannot complete an asset operation."""


class AssetReconciliationError(AssetRepositoryError):
    """Raised when Storage and metadata need operational reconciliation."""


class AssetsRepository:
    """Service-role repository with explicit FastAPI ownership checks."""

    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise AssetRepositoryError(
                "Supabase URL and service-role key are required for asset operations."
            )
        self._supabase_url = settings.supabase_url.rstrip("/")
        self._rest_url = f"{self._supabase_url}/rest/v1"
        self._storage_url = f"{self._supabase_url}/storage/v1"
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def _request_rest(
        self,
        method: str,
        path: str,
        *,
        params: list[tuple[str, str]] | None = None,
        payload: dict | None = None,
        prefer: str | None = None,
    ) -> list[dict]:
        headers = dict(self._headers)
        if prefer:
            headers["Prefer"] = prefer
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.request(
                    method,
                    f"{self._rest_url}/{path.lstrip('/')}",
                    headers=headers,
                    params=params,
                    json=payload,
                )
        except httpx.HTTPError as error:
            raise AssetRepositoryError("Unable to reach Supabase.") from error
        if response.status_code in {404, 406}:
            return []
        if response.is_error:
            raise AssetRepositoryError(
                f"Supabase metadata operation failed with HTTP {response.status_code}."
            )
        if not response.content:
            return []
        data = response.json()
        return [data] if isinstance(data, dict) else data

    async def _request_storage(
        self,
        method: str,
        path: str,
        *,
        payload: dict | None = None,
        content: bytes | None = None,
        mime_type: str | None = None,
    ) -> dict | list | None:
        headers = dict(self._headers)
        if content is not None:
            headers["Content-Type"] = mime_type or "application/octet-stream"
            headers["x-upsert"] = "false"
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.request(
                    method,
                    f"{self._storage_url}/{path.lstrip('/')}",
                    headers=headers,
                    json=payload if content is None else None,
                    content=content,
                )
        except httpx.HTTPError as error:
            raise AssetRepositoryError("Unable to reach Supabase Storage.") from error
        if response.is_error:
            raise AssetRepositoryError(
                f"Supabase Storage operation failed with HTTP {response.status_code}."
            )
        if not response.content:
            return None
        return response.json()

    async def _ensure_project_owner(self, owner_id: UUID, project_id: UUID) -> None:
        rows = await self._request_rest(
            "GET",
            "projects",
            params=[
                ("id", f"eq.{project_id}"),
                ("owner_id", f"eq.{owner_id}"),
                ("deleted_at", "is.null"),
                ("select", "id"),
                ("limit", "1"),
            ],
        )
        if not rows:
            raise AssetNotFoundError

    @staticmethod
    def _storage_path(project_id: UUID, asset_id: UUID, filename: str) -> str:
        return f"projects/{project_id}/assets/{asset_id}/{filename}"

    async def _get_owned_asset(
        self, owner_id: UUID, asset_id: UUID
    ) -> AssetResponse:
        rows = await self._request_rest(
            "GET",
            "assets",
            params=[
                ("id", f"eq.{asset_id}"),
                ("deleted_at", "is.null"),
                ("select", "*"),
                ("limit", "1"),
            ],
        )
        if not rows:
            raise AssetNotFoundError
        asset = AssetResponse.model_validate(rows[0])
        await self._ensure_project_owner(owner_id, asset.project_id)
        return asset

    async def list(self, owner_id: UUID, project_id: UUID) -> list[AssetResponse]:
        await self._ensure_project_owner(owner_id, project_id)
        rows = await self._request_rest(
            "GET",
            "assets",
            params=[
                ("project_id", f"eq.{project_id}"),
                ("deleted_at", "is.null"),
                ("upload_status", f"eq.{UploadStatus.AVAILABLE.value}"),
                ("order", "created_at.desc"),
                ("select", "*"),
            ],
        )
        return [AssetResponse.model_validate(row) for row in rows]

    async def get(self, owner_id: UUID, asset_id: UUID) -> AssetResponse:
        asset = await self._get_owned_asset(owner_id, asset_id)
        if asset.upload_status != UploadStatus.AVAILABLE:
            raise AssetNotFoundError
        return asset

    async def create(
        self,
        owner_id: UUID,
        project_id: UUID,
        upload: ParsedUpload,
    ) -> AssetResponse:
        await self._ensure_project_owner(owner_id, project_id)
        asset_id = uuid4()
        storage_path = self._storage_path(project_id, asset_id, upload.filename)
        now = datetime.now(UTC).isoformat()
        metadata = {
            "id": str(asset_id),
            "project_id": str(project_id),
            "category": upload.category.value,
            "original_filename": upload.filename,
            "storage_path": storage_path,
            "mime_type": upload.mime_type,
            "file_size_bytes": upload.file_size_bytes,
            "width": upload.width,
            "height": upload.height,
            "metadata": None,
            "upload_status": UploadStatus.UPLOADING.value,
            "created_at": now,
            "updated_at": now,
        }
        rows = await self._request_rest(
            "POST", "assets", payload=metadata, prefer="return=representation"
        )
        if not rows:
            raise AssetRepositoryError("Supabase did not return asset metadata.")

        try:
            await self._request_storage(
                "POST",
                f"object/{STORAGE_BUCKET}/{quote(storage_path, safe='/')}\n".strip(),
                content=upload.content,
                mime_type=upload.mime_type,
            )
        except AssetRepositoryError:
            await self._mark_failed(asset_id)
            raise

        try:
            finalized = await self._request_rest(
                "PATCH",
                "assets",
                params=[
                    ("id", f"eq.{asset_id}"),
                    ("upload_status", f"eq.{UploadStatus.UPLOADING.value}"),
                ],
                payload={"upload_status": UploadStatus.AVAILABLE.value},
                prefer="return=representation",
            )
        except AssetRepositoryError as error:
            raise AssetReconciliationError(
                "Storage object exists but asset metadata finalization failed."
            ) from error
        if not finalized:
            raise AssetReconciliationError(
                "Storage object exists but asset metadata finalization returned no row."
            )
        return AssetResponse.model_validate(finalized[0])

    async def _mark_failed(self, asset_id: UUID) -> None:
        try:
            await self._request_rest(
                "PATCH",
                "assets",
                params=[("id", f"eq.{asset_id}")],
                payload={"upload_status": UploadStatus.FAILED.value},
            )
        except AssetRepositoryError:
            pass

    async def signed_url(
        self, owner_id: UUID, asset_id: UUID
    ) -> SignedAssetUrlResponse:
        asset = await self.get(owner_id, asset_id)
        result = await self._request_storage(
            "POST",
            f"object/sign/{STORAGE_BUCKET}",
            payload={
                "paths": [asset.storage_path],
                "expiresIn": SIGNED_URL_EXPIRY_SECONDS,
            },
        )
        entry: dict | None = None
        if isinstance(result, list):
            if not result or not isinstance(result[0], dict):
                raise AssetRepositoryError("Supabase did not return a signed URL.")
            entry = result[0]
        elif isinstance(result, dict):
            if isinstance(result.get("signedURLs"), list):
                signed_entries = result["signedURLs"]
                if not signed_entries or not isinstance(signed_entries[0], dict):
                    raise AssetRepositoryError("Supabase did not return a signed URL.")
                entry = signed_entries[0]
            else:
                entry = result
        else:
            raise AssetRepositoryError("Supabase did not return a signed URL.")

        if entry.get("error"):
            raise AssetRepositoryError("Supabase Storage error generating signed URL.")

        signed_url = entry.get("signedURL") or entry.get("signed_url")
        if not isinstance(signed_url, str) or not signed_url.strip():
            raise AssetRepositoryError("Supabase did not return a signed URL.")

        return SignedAssetUrlResponse(
            asset_id=asset.id,
            signed_url=f"{self._supabase_url}/storage/v1{signed_url}"
            if signed_url.startswith("/")
            else signed_url,
        )

    async def soft_delete(self, owner_id: UUID, asset_id: UUID) -> None:
        asset = await self.get(owner_id, asset_id)
        try:
            await self._request_storage(
                "DELETE",
                f"object/{STORAGE_BUCKET}",
                payload={"prefixes": [asset.storage_path]},
            )
        except AssetRepositoryError as error:
            raise AssetReconciliationError(
                "Storage object removal failed; metadata was not soft-deleted."
            ) from error

        rows = await self._request_rest(
            "PATCH",
            "assets",
            params=[("id", f"eq.{asset_id}"), ("deleted_at", "is.null")],
            payload={"deleted_at": datetime.now(UTC).isoformat()},
            prefer="return=representation",
        )
        if not rows:
            raise AssetReconciliationError(
                "Storage object was removed but metadata soft-delete failed."
            )