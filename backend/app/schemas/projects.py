"""Project API schemas."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class ProjectType(StrEnum):
    """Supported project categories."""

    CONCEPT = "concept"
    INTERIOR = "interior"
    MIXED = "mixed"


class ProjectCreate(BaseModel):
    """Fields accepted when creating a project."""

    model_config = ConfigDict(extra="forbid")

    name: str
    description: str | None = None
    project_type: ProjectType
    city: str | None = None
    climate: str | None = None
    cover_image_url: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        """Reject blank project names while preserving the submitted value."""
        if not value.strip():
            raise ValueError("Project name must not be blank.")
        return value


class ProjectUpdate(BaseModel):
    """Editable project fields."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    description: str | None = None
    project_type: ProjectType | None = None
    city: str | None = None
    climate: str | None = None
    cover_image_url: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        """Reject null or blank names when the name is included in an update."""
        if value is None or not value.strip():
            raise ValueError("Project name must not be blank.")
        return value

    @field_validator("project_type", mode="before")
    @classmethod
    def validate_project_type(cls, value: ProjectType | None) -> ProjectType | None:
        """Reject null project types when the field is included in an update."""
        if value is None:
            raise ValueError("Project type must not be null.")
        return value


class ProjectResponse(BaseModel):
    """Project returned by the API."""

    id: UUID
    owner_id: UUID
    name: str
    description: str | None = None
    project_type: ProjectType
    city: str | None = None
    climate: str | None = None
    cover_image_url: str | None = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class ProjectMemoryResponse(BaseModel):
    """Internal project-memory record shape used by persistence tests."""

    id: UUID
    project_id: UUID
    brief: str | None = None
    style_preferences: dict[str, Any] | None = None
    palette_preferences: dict[str, Any] | None = None
    material_preferences: dict[str, Any] | None = None
    constraints: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime