"""
ArchiVision AI — Authentication Endpoints.

Milestone M2: Validated user identity handshake.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.auth import CurrentUser

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class AuthMeResponse(BaseModel):
    """Authenticated user profile response."""

    id: UUID
    email: str | None
    role: str
    app_metadata: dict[str, Any] = Field(default_factory=dict)
    user_metadata: dict[str, Any] = Field(default_factory=dict)


@router.get("/me", response_model=AuthMeResponse)
async def get_my_profile(
    current_user: CurrentUser = Depends(get_current_user),
) -> AuthMeResponse:
    """
    Return the authenticated user's identity verified from Supabase JWT claims.
    Requires Bearer token authorization.
    """
    return AuthMeResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        app_metadata=current_user.app_metadata,
        user_metadata=current_user.user_metadata,
    )
