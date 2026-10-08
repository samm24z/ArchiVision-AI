"""S4.1 asset and private Storage endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.api.deps import get_current_user
from app.core.asset_validation import (
    AssetValidationError,
    parse_multipart_upload,
    validate_upload,
)
from app.core.assets import (
    AssetNotFoundError,
    AssetRepositoryError,
    AssetsRepository,
)
from app.core.auth import CurrentUser
from app.core.config import Settings, get_settings
from app.schemas.assets import (
    MAX_ASSET_SIZE_BYTES,
    AssetResponse,
    SignedAssetUrlResponse,
)

router = APIRouter(prefix="/api/v1", tags=["assets"])


def get_assets_repository(
    settings: Settings = Depends(get_settings),
) -> AssetsRepository:
    """Build the service-role asset repository from runtime settings."""
    return AssetsRepository(settings)


def repository_error(error: AssetRepositoryError) -> HTTPException:
    """Convert persistence and Storage failures into a non-sensitive response."""
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Asset storage is currently unavailable or requires reconciliation.",
    )


def not_found_error(error: AssetNotFoundError) -> HTTPException:
    """Hide missing and unauthorized project/asset existence."""
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Asset not found.",
    )


@router.post(
    "/projects/{project_id}/assets",
    response_model=AssetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_asset(
    project_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    repository: AssetsRepository = Depends(get_assets_repository),
) -> AssetResponse:
    """Validate and upload one project-owned multipart asset."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_ASSET_SIZE_BYTES + 1_048_576:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 20 MiB limit.",
        )

    try:
        body = await request.body()
        content, category, filename, declared_mime_type = parse_multipart_upload(
            body, request.headers.get("content-type", "")
        )
        upload = validate_upload(content, category, filename, declared_mime_type)
        return await repository.create(current_user.id, project_id, upload)
    except AssetValidationError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail=error.message,
        ) from error
    except AssetNotFoundError as error:
        raise not_found_error(error) from error
    except AssetRepositoryError as error:
        raise repository_error(error) from error


@router.get(
    "/projects/{project_id}/assets",
    response_model=list[AssetResponse],
)
async def list_assets(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    repository: AssetsRepository = Depends(get_assets_repository),
) -> list[AssetResponse]:
    """List available assets for an owned project."""
    try:
        return await repository.list(current_user.id, project_id)
    except AssetNotFoundError as error:
        raise not_found_error(error) from error
    except AssetRepositoryError as error:
        raise repository_error(error) from error


@router.get("/assets/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    repository: AssetsRepository = Depends(get_assets_repository),
) -> AssetResponse:
    """Return metadata for an available asset owned through its project."""
    try:
        return await repository.get(current_user.id, asset_id)
    except AssetNotFoundError as error:
        raise not_found_error(error) from error
    except AssetRepositoryError as error:
        raise repository_error(error) from error


@router.post("/assets/{asset_id}/signed-url", response_model=SignedAssetUrlResponse)
async def get_signed_asset_url(
    asset_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    repository: AssetsRepository = Depends(get_assets_repository),
) -> SignedAssetUrlResponse:
    """Return a 15-minute signed URL after ownership authorization."""
    try:
        return await repository.signed_url(current_user.id, asset_id)
    except AssetNotFoundError as error:
        raise not_found_error(error) from error
    except AssetRepositoryError as error:
        raise repository_error(error) from error


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    repository: AssetsRepository = Depends(get_assets_repository),
) -> Response:
    """Remove the Storage object and soft-delete its metadata."""
    try:
        await repository.soft_delete(current_user.id, asset_id)
    except AssetNotFoundError as error:
        raise not_found_error(error) from error
    except AssetRepositoryError as error:
        raise repository_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)