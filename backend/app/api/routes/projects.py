"""Project CRUD endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.deps import get_current_user
from app.core.auth import CurrentUser
from app.core.config import Settings, get_settings
from app.core.projects import (
    ProjectNotFoundError,
    ProjectRepositoryError,
    ProjectsRepository,
)
from app.schemas.projects import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


def get_projects_repository(
    settings: Settings = Depends(get_settings),
) -> ProjectsRepository:
    """Build the backend project repository from runtime settings."""
    return ProjectsRepository(settings)


def repository_error(error: ProjectRepositoryError) -> HTTPException:
    """Convert persistence failures into a non-sensitive API error."""
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Project persistence is currently unavailable.",
    )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project: ProjectCreate,
    current_user: CurrentUser = Depends(get_current_user),
    repository: ProjectsRepository = Depends(get_projects_repository),
) -> ProjectResponse:
    """Create an owned project and its project memory atomically."""
    try:
        return await repository.create(current_user.id, project)
    except ProjectRepositoryError as error:
        raise repository_error(error) from error


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    current_user: CurrentUser = Depends(get_current_user),
    repository: ProjectsRepository = Depends(get_projects_repository),
) -> list[ProjectResponse]:
    """List active projects owned by the authenticated user."""
    try:
        return await repository.list(current_user.id)
    except ProjectRepositoryError as error:
        raise repository_error(error) from error


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    repository: ProjectsRepository = Depends(get_projects_repository),
) -> ProjectResponse:
    """Return an active project only when it belongs to the current user."""
    try:
        return await repository.get(current_user.id, project_id)
    except ProjectNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        ) from error
    except ProjectRepositoryError as error:
        raise repository_error(error) from error


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    project: ProjectUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    repository: ProjectsRepository = Depends(get_projects_repository),
) -> ProjectResponse:
    """Update editable fields on an active owned project."""
    try:
        return await repository.update(current_user.id, project_id, project)
    except ProjectNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        ) from error
    except ProjectRepositoryError as error:
        raise repository_error(error) from error


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    repository: ProjectsRepository = Depends(get_projects_repository),
) -> Response:
    """Soft-delete an active owned project."""
    try:
        await repository.soft_delete(current_user.id, project_id)
    except ProjectNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        ) from error
    except ProjectRepositoryError as error:
        raise repository_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)