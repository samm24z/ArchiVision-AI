"""Supabase persistence operations for projects."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import httpx

from app.core.config import Settings
from app.schemas.projects import ProjectCreate, ProjectResponse, ProjectUpdate


class ProjectNotFoundError(Exception):
    """Raised when a project is absent or not owned by the requesting user."""


class ProjectRepositoryError(Exception):
    """Raised when Supabase cannot complete a project operation."""


class ProjectsRepository:
    """Minimal PostgREST repository using the backend-only service-role key.

    FastAPI is currently the authorization boundary for backend API requests.
    Supabase RLS remains enabled as defense for direct authenticated Supabase
    access, and production approval requires integration verification of
    ownership isolation.
    """

    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise ProjectRepositoryError(
                "Supabase URL and service-role key are required for project operations."
            )
        self._base_url = f"{settings.supabase_url.rstrip('/')}/rest/v1"
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: list[tuple[str, str]] | None = None,
        json: dict[str, Any] | None = None,
        prefer: str | None = None,
    ) -> list[dict[str, Any]]:
        headers = dict(self._headers)
        if prefer:
            headers["Prefer"] = prefer

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.request(
                    method,
                    f"{self._base_url}/{path.lstrip('/')}",
                    headers=headers,
                    params=params,
                    json=json,
                )
        except httpx.HTTPError as error:
            raise ProjectRepositoryError("Unable to reach Supabase.") from error

        if response.status_code in {404, 406}:
            return []
        if response.is_error:
            raise ProjectRepositoryError(
                f"Supabase project operation failed with HTTP {response.status_code}."
            )

        if not response.content:
            return []
        payload = response.json()
        if isinstance(payload, dict):
            return [payload]
        return payload

    async def create(
        self,
        owner_id: UUID,
        project: ProjectCreate,
    ) -> ProjectResponse:
        rows = await self._request(
            "POST",
            "rpc/create_project_with_memory",
            json={
                "p_owner_id": str(owner_id),
                "p_name": project.name,
                "p_description": project.description,
                "p_project_type": project.project_type.value,
                "p_city": project.city,
                "p_climate": project.climate,
                "p_cover_image_url": project.cover_image_url,
            },
        )
        if not rows:
            raise ProjectRepositoryError("Supabase did not return the created project.")
        return ProjectResponse.model_validate(rows[0])

    async def list(self, owner_id: UUID) -> list[ProjectResponse]:
        rows = await self._request(
            "GET",
            "projects",
            params=[
                ("owner_id", f"eq.{owner_id}"),
                ("deleted_at", "is.null"),
                ("order", "updated_at.desc"),
            ],
        )
        return [ProjectResponse.model_validate(row) for row in rows]

    async def get(self, owner_id: UUID, project_id: UUID) -> ProjectResponse:
        rows = await self._request(
            "GET",
            "projects",
            params=[
                ("id", f"eq.{project_id}"),
                ("owner_id", f"eq.{owner_id}"),
                ("deleted_at", "is.null"),
                ("limit", "1"),
            ],
        )
        if not rows:
            raise ProjectNotFoundError
        return ProjectResponse.model_validate(rows[0])

    async def update(
        self,
        owner_id: UUID,
        project_id: UUID,
        project: ProjectUpdate,
    ) -> ProjectResponse:
        fields = project.model_dump(exclude_unset=True, mode="json")
        rows = await self._request(
            "PATCH",
            "projects",
            params=[
                ("id", f"eq.{project_id}"),
                ("owner_id", f"eq.{owner_id}"),
                ("deleted_at", "is.null"),
            ],
            json=fields,
            prefer="return=representation",
        )
        if not rows:
            raise ProjectNotFoundError
        return ProjectResponse.model_validate(rows[0])

    async def soft_delete(self, owner_id: UUID, project_id: UUID) -> None:
        rows = await self._request(
            "PATCH",
            "projects",
            params=[
                ("id", f"eq.{project_id}"),
                ("owner_id", f"eq.{owner_id}"),
                ("deleted_at", "is.null"),
            ],
            json={
                "is_archived": True,
                "deleted_at": datetime.now(UTC).isoformat(),
            },
            prefer="return=representation",
        )
        if not rows:
            raise ProjectNotFoundError