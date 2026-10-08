"""
ArchiVision AI — Backend Authentication & JWT Verification.

Local validation of Supabase Auth JWT access tokens using PyJWT.
Supports asymmetric signing keys (ES256, RS256) via the Supabase project's
JWKS endpoint ({SUPABASE_URL}/auth/v1/.well-known/jwks.json) with in-memory key
caching, as well as symmetric HMAC-SHA256 (HS256) via SUPABASE_JWT_SECRET
for backward compatibility and offline testing.

Enforces signature verification, expiration ('exp'), subject ('sub'),
and audience claim ('authenticated').
"""

from functools import lru_cache
from typing import Any
from uuid import UUID

import jwt
from jwt import PyJWKClient
from pydantic import BaseModel, Field

ALLOWED_ALGORITHMS = frozenset({"HS256", "ES256", "RS256"})
ASYMMETRIC_ALGORITHMS = frozenset({"ES256", "RS256"})


class CurrentUser(BaseModel):
    """Authenticated user context extracted from validated JWT claims."""

    id: UUID
    email: str | None = None
    role: str = "authenticated"
    app_metadata: dict[str, Any] = Field(default_factory=dict)
    user_metadata: dict[str, Any] = Field(default_factory=dict)


class AuthError(Exception):
    """Authentication verification error."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


@lru_cache(maxsize=4)
def get_jwks_client(supabase_url: str) -> PyJWKClient:
    """
    Return a cached PyJWKClient instance for the Supabase project's JWKS endpoint.
    Public keys are cached in memory.
    """
    clean_url = supabase_url.rstrip("/")
    jwks_url = f"{clean_url}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(jwks_url, cache_keys=True, max_cached_keys=16)


def decode_supabase_jwt(
    token: str,
    jwt_secret: str = "",
    supabase_url: str = "",
    jwks_client: PyJWKClient | None = None,
) -> dict[str, Any]:
    """
    Decode and validate a Supabase JWT access token.

    Args:
        token: Raw JWT bearer token string.
        jwt_secret: Supabase project JWT secret (HS256 fallback).
        supabase_url: Supabase project URL (used for JWKS key discovery).
        jwks_client: Optional custom/mock PyJWKClient instance (for testing).

    Returns:
        Decoded payload dictionary.

    Raises:
        AuthError: If the token is invalid, expired, malformed, or
            missing required claims.
    """
    if not token or not token.strip():
        raise AuthError("Token cannot be empty.")

    clean_token = token.strip()

    try:
        header = jwt.get_unverified_header(clean_token)
    except Exception as e:
        raise AuthError("Malformed or invalid token header.") from e

    alg = header.get("alg")
    if not alg or alg not in ALLOWED_ALGORITHMS:
        raise AuthError(
            f"Unsupported algorithm '{alg}'. Allowed: {sorted(ALLOWED_ALGORITHMS)}"
        )

    # Resolve verification key based on algorithm
    if alg in ASYMMETRIC_ALGORITHMS:
        if jwks_client is None:
            if not supabase_url or not supabase_url.strip():
                raise AuthError(
                    f"SUPABASE_URL is required to verify asymmetric ({alg}) tokens."
                )
            jwks_client = get_jwks_client(supabase_url.strip())

        try:
            signing_key = jwks_client.get_signing_key_from_jwt(clean_token)
            key = signing_key.key
        except Exception as e:
            raise AuthError(
                f"Unable to retrieve matching public key from JWKS: {e}"
            ) from e

        allowed_algs = [alg]
    elif alg == "HS256":
        if not jwt_secret or not jwt_secret.strip():
            raise AuthError("SUPABASE_JWT_SECRET is required to verify HS256 tokens.")
        key = jwt_secret.strip()
        allowed_algs = ["HS256"]
    else:
        raise AuthError(f"Algorithm '{alg}' is not permitted.")

    try:
        payload = jwt.decode(
            clean_token,
            key,
            algorithms=allowed_algs,
            audience="authenticated",
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": True,
                "require": ["exp", "sub", "aud"],
            },
        )
        return payload
    except jwt.ExpiredSignatureError as e:
        raise AuthError("Token has expired.") from e
    except jwt.InvalidAudienceError as e:
        raise AuthError("Invalid token audience.") from e
    except jwt.InvalidSignatureError as e:
        raise AuthError("Invalid token signature.") from e
    except jwt.DecodeError as e:
        raise AuthError("Malformed or invalid token.") from e
    except jwt.PyJWTError as e:
        raise AuthError(f"Token validation failed: {e}") from e


def parse_current_user_from_payload(payload: dict[str, Any]) -> CurrentUser:
    """
    Parse a validated JWT payload into a CurrentUser model.

    Args:
        payload: Decoded JWT claims dictionary.

    Returns:
        CurrentUser instance.

    Raises:
        AuthError: If required claims are missing or invalid.
    """
    sub = payload.get("sub")
    if not sub:
        raise AuthError("Token is missing subject ('sub') claim.")

    try:
        user_id = UUID(str(sub))
    except (ValueError, TypeError) as e:
        raise AuthError("Token subject ('sub') is not a valid UUID.") from e

    email = payload.get("email")
    role = payload.get("role", "authenticated")
    app_metadata = payload.get("app_metadata", {})
    user_metadata = payload.get("user_metadata", {})

    return CurrentUser(
        id=user_id,
        email=str(email) if email else None,
        role=str(role),
        app_metadata=app_metadata if isinstance(app_metadata, dict) else {},
        user_metadata=user_metadata if isinstance(user_metadata, dict) else {},
    )
