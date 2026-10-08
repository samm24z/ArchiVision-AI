"""S3.1 project endpoint tests."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.routes.projects import get_projects_repository
from app.core.config import Settings, get_settings
from app.main import app
from app.schemas.projects import ProjectCreate, ProjectResponse, ProjectUpdate
from tests.test_auth import TEST_JWT_SECRET, TEST_USER_ID, make_test_jwt

SECOND_USER_ID = uuid4()


def get_project_test_settings() -> Settings:
    """Return settings for local JWT verification in endpoint tests."""
    return Settings(
        ENVIRONMENT="development",
        API_HOST="0.0.0.0",
        API_PORT=8000,
        API_CORS_ORIGINS="http://localhost:3000",
        SUPABASE_URL="https://test-project.supabase.co",
        SUPABASE_JWT_SECRET=TEST_JWT_SECRET,
    )


class FakeProjectsRepository:
    """In-memory repository used to test API behavior independently of Supabase."""

    def __init__(self) -> None:
        self.projects: dict[UUID, ProjectResponse] = {}
        self.memory_project_ids: set[UUID] = set()
        self.create_calls = 0

    async def create(self, owner_id: UUID, project: ProjectCreate) -> ProjectResponse:
        self.create_calls += 1
        now = datetime.now(UTC)
        project_id = uuid4()
        created = ProjectResponse(
            id=project_id,
            owner_id=owner_id,
            name=project.name,
            description=project.description,
            project_type=project.project_type,
            city=project.city,
            climate=project.climate,
            cover_image_url=project.cover_image_url,
            is_archived=False,
            created_at=now,
            updated_at=now,
        )
        self.projects[project_id] = created
        self.memory_project_ids.add(project_id)
        return created

    async def list(self, owner_id: UUID) -> list[ProjectResponse]:
        return sorted(
            (
                project
                for project in self.projects.values()
                if project.owner_id == owner_id and project.deleted_at is None
            ),
            key=lambda project: project.updated_at,
            reverse=True,
        )

    async def get(self, owner_id: UUID, project_id: UUID) -> ProjectResponse:
        project = self.projects.get(project_id)
        if project is None or project.owner_id != owner_id or project.deleted_at:
            from app.core.projects import ProjectNotFoundError

            raise ProjectNotFoundError
        return project

    async def update(
        self,
        owner_id: UUID,
        project_id: UUID,
        update: ProjectUpdate,
    ) -> ProjectResponse:
        project = await self.get(owner_id, project_id)
        values = update.model_dump(exclude_unset=True)
        updated = project.model_copy(
            update={**values, "updated_at": datetime.now(UTC)}
        )
        self.projects[project_id] = updated
        return updated

    async def soft_delete(self, owner_id: UUID, project_id: UUID) -> None:
        project = await self.get(owner_id, project_id)
        now = datetime.now(UTC)
        self.projects[project_id] = project.model_copy(
            update={"is_archived": True, "deleted_at": now, "updated_at": now}
        )


@pytest.fixture
def project_client() -> tuple[TestClient, FakeProjectsRepository]:
    """Provide an authenticated-configured client and isolated fake repository."""
    repository = FakeProjectsRepository()
    app.dependency_overrides[get_settings] = get_project_test_settings
    app.dependency_overrides[get_projects_repository] = lambda: repository
    with TestClient(app) as client:
        yield client, repository
    app.dependency_overrides.pop(get_projects_repository, None)
    app.dependency_overrides.pop(get_settings, None)


def auth_header(user_id: str = TEST_USER_ID) -> dict[str, str]:
    """Create a valid bearer header for a test user."""
    return {"Authorization": f"Bearer {make_test_jwt(sub=user_id)}"}


def create_payload(name: str = "Studio House") -> dict[str, str]:
    """Return the smallest valid project payload."""
    return {"name": name, "project_type": "concept"}


@pytest.mark.parametrize(
    ("method", "path", "kwargs"),
    [
        ("post", "/api/v1/projects", {"json": create_payload()}),
        ("get", "/api/v1/projects", {}),
        ("get", f"/api/v1/projects/{uuid4()}", {}),
        ("patch", f"/api/v1/projects/{uuid4()}", {"json": {"name": "Updated"}}),
        ("delete", f"/api/v1/projects/{uuid4()}", {}),
    ],
)
def test_project_endpoints_require_authentication(
    project_client: tuple[TestClient, FakeProjectsRepository],
    method: str,
    path: str,
    kwargs: dict[str, object],
) -> None:
    """All project operations reject missing authentication."""
    client, _ = project_client
    response = getattr(client, method)(path, **kwargs)
    assert response.status_code == 401


def test_create_assigns_owner_and_creates_memory(
    project_client: tuple[TestClient, FakeProjectsRepository],
) -> None:
    """The JWT subject owns the project and creation creates its memory record."""
    client, repository = project_client
    response = client.post(
        "/api/v1/projects",
        headers=auth_header(),
        json={**create_payload(), "owner_id": str(SECOND_USER_ID)},
    )

    assert response.status_code == 422

    response = client.post(
        "/api/v1/projects",
        headers=auth_header(),
        json={**create_payload(), "city": "Pune", "climate": "Tropical"},
    )
    assert response.status_code == 201
    project_id = UUID(response.json()["id"])
    assert response.json()["owner_id"] == TEST_USER_ID
    assert project_id in repository.memory_project_ids


def test_project_endpoint_rejects_malformed_authentication(
    project_client: tuple[TestClient, FakeProjectsRepository],
) -> None:
    """Project endpoints use the existing JWT validation dependency."""
    client, _ = project_client
    response = client.get(
        "/api/v1/projects",
        headers={"Authorization": "Bearer not-a-jwt"},
    )
    assert response.status_code == 401


def test_create_uses_atomic_project_memory_repository_contract(
    project_client: tuple[TestClient, FakeProjectsRepository],
) -> None:
    """The API uses one repository operation for project plus memory creation.

    This verifies the API contract boundary only. PostgreSQL rollback behavior
    requires Supabase integration testing and is not claimed by this unit test.
    """
    client, repository = project_client
    response = client.post(
        "/api/v1/projects",
        headers=auth_header(),
        json=create_payload(),
    )

    assert response.status_code == 201
    assert repository.create_calls == 1
    assert UUID(response.json()["id"]) in repository.memory_project_ids


def test_list_isolates_users_and_orders_by_updated_at(
    project_client: tuple[TestClient, FakeProjectsRepository],
) -> None:
    """Listing returns only active projects for the authenticated user."""
    client, repository = project_client
    first = client.post(
        "/api/v1/projects",
        headers=auth_header(),
        json=create_payload("First"),
    ).json()
    client.post(
        "/api/v1/projects",
        headers=auth_header(str(SECOND_USER_ID)),
        json=create_payload("Private"),
    )
    first_id = UUID(first["id"])
    client.post(
        "/api/v1/projects",
        headers=auth_header(),
        json=create_payload("Second"),
    )
    project = repository.projects[first_id]
    repository.projects[first_id] = project.model_copy(
        update={"updated_at": datetime.now(UTC)}
    )

    response = client.get("/api/v1/projects", headers=auth_header())

    assert response.status_code == 200
    assert [item["name"] for item in response.json()] == ["First", "Second"]
    assert all(item["name"] != "Private" for item in response.json())


def test_get_update_and_delete_enforce_ownership(
    project_client: tuple[TestClient, FakeProjectsRepository],
) -> None:
    """Foreign-owned projects are indistinguishable from missing projects."""
    client, _ = project_client
    created = client.post(
        "/api/v1/projects",
        headers=auth_header(),
        json=create_payload(),
    ).json()
    project_id = created["id"]

    assert client.get(
        f"/api/v1/projects/{project_id}", headers=auth_header(str(SECOND_USER_ID))
    ).status_code == 404
    assert client.patch(
        f"/api/v1/projects/{project_id}",
        headers=auth_header(str(SECOND_USER_ID)),
        json={"name": "Hijacked"},
    ).status_code == 404
    assert client.delete(
        f"/api/v1/projects/{project_id}",
        headers=auth_header(str(SECOND_USER_ID)),
    ).status_code == 404

    updated = client.patch(
        f"/api/v1/projects/{project_id}",
        headers=auth_header(),
        json={"name": "Renamed", "city": "Delhi"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Renamed"

    deleted = client.delete(
        f"/api/v1/projects/{project_id}", headers=auth_header()
    )
    assert deleted.status_code == 204
    assert client.get(
        f"/api/v1/projects/{project_id}", headers=auth_header()
    ).status_code == 404
    assert client.get("/api/v1/projects", headers=auth_header()).json() == []


def test_update_rejects_owner_id(
    project_client: tuple[TestClient, FakeProjectsRepository],
) -> None:
    """Ownership cannot be changed through the update contract."""
    client, _ = project_client
    created = client.post(
        "/api/v1/projects",
        headers=auth_header(),
        json=create_payload(),
    ).json()

    response = client.patch(
        f"/api/v1/projects/{created['id']}",
        headers=auth_header(),
        json={"owner_id": str(SECOND_USER_ID)},
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        {"project_type": "concept"},
        {"name": "Missing type", "project_type": "invalid"},
        {
            "name": "Owner update",
            "project_type": "concept",
            "owner_id": str(SECOND_USER_ID),
        },
    ],
)
def test_project_validation_rejects_invalid_input(
    project_client: tuple[TestClient, FakeProjectsRepository],
    payload: dict[str, str],
) -> None:
    """Required fields, allowed types, and ownership boundaries are validated."""
    client, _ = project_client
    response = client.post(
        "/api/v1/projects",
        headers=auth_header(),
        json=payload,
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "payload",
    [{"city": "Mumbai"}, {"project_type": "interior"}],
)
def test_patch_omitted_optional_fields_remain_valid(
    project_client: tuple[TestClient, FakeProjectsRepository],
    payload: dict[str, str],
) -> None:
    """PATCH permits omitted name or project_type fields."""
    client, _ = project_client
    created = client.post(
        "/api/v1/projects",
        headers=auth_header(),
        json=create_payload(),
    ).json()

    response = client.patch(
        f"/api/v1/projects/{created['id']}",
        headers=auth_header(),
        json=payload,
    )

    assert response.status_code == 200


@pytest.mark.parametrize("payload", [{"name": None}, {"project_type": None}])
def test_patch_rejects_explicit_null_non_nullable_fields(
    project_client: tuple[TestClient, FakeProjectsRepository],
    payload: dict[str, None],
) -> None:
    """PATCH rejects explicit null for name and project_type."""
    client, _ = project_client
    created = client.post(
        "/api/v1/projects",
        headers=auth_header(),
        json=create_payload(),
    ).json()

    response = client.patch(
        f"/api/v1/projects/{created['id']}",
        headers=auth_header(),
        json=payload,
    )

    assert response.status_code == 422