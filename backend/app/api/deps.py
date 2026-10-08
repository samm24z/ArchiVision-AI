"""
ArchiVision AI — API Request Dependencies.

Provides FastAPI dependency injection functions for settings, authentication,
and user context extraction.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.auth import (
    AuthError,
    CurrentUser,
    decode_supabase_jwt,
    parse_current_user_from_payload,
)
from app.core.config import Settings, get_settings

security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    """
    FastAPI dependency that extracts and validates the Bearer JWT token from the
    Authorization header. Raises HTTP 401 on missing, malformed, or invalid tokens.
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials.strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty authentication token provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_supabase_jwt(
            token,
            jwt_secret=settings.supabase_jwt_secret,
            supabase_url=settings.supabase_url,
        )
        return parse_current_user_from_payload(payload)
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    settings: Settings = Depends(get_settings),
) -> CurrentUser | None:
    """
    FastAPI dependency for optional authentication. Returns CurrentUser if a valid
    token is present, or None if no credentials were provided.
    """
    if credentials is None or not credentials.credentials:
        return None

    token = credentials.credentials.strip()
    if not token:
        return None

    try:
        payload = decode_supabase_jwt(
            token,
            jwt_secret=settings.supabase_jwt_secret,
            supabase_url=settings.supabase_url,
        )
        return parse_current_user_from_payload(payload)
    except AuthError:
        return None
