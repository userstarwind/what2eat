import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.database import get_session
from .config import auth_settings
from .exceptions import AdminRequiredException, InvalidOrExpiredTokenException
from .models import User


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("utf-8")


def _b64url_decode(raw: str) -> bytes:
    padding = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(raw + padding)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(auth_settings.password_salt_bytes)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        auth_settings.password_hash_iterations,
    )
    return (
        f"{auth_settings.password_hash_algorithm}"
        f"${auth_settings.password_hash_iterations}"
        f"${_b64url_encode(salt)}"
        f"${_b64url_encode(dk)}"
    )


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, hash_text = hashed_password.split("$", maxsplit=3)
        if algorithm != auth_settings.password_hash_algorithm:
            return False

        iterations = int(iterations_text)
        salt = _b64url_decode(salt_text)
        expected_hash = _b64url_decode(hash_text)

        actual_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            iterations,
        )
        return hmac.compare_digest(actual_hash, expected_hash)
    except (ValueError, TypeError):
        return False


def _jwt_sign(message: bytes) -> str:
    if auth_settings.jwt_algorithm != "HS256":
        raise ValueError(f"Unsupported JWT algorithm: {auth_settings.jwt_algorithm}")

    signature = hmac.new(
        auth_settings.jwt_secret_key.encode("utf-8"),
        message,
        hashlib.sha256,
    ).digest()
    return _b64url_encode(signature)


def _jwt_encode(payload: dict[str, Any]) -> str:
    header = {"alg": auth_settings.jwt_algorithm, "typ": "JWT"}
    encoded_header = _b64url_encode(
        json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    encoded_payload = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    signature = _jwt_sign(signing_input)
    return f"{encoded_header}.{encoded_payload}.{signature}"


def create_access_token(
    subject: str,
    expires_delta: timedelta | None = None,
    additional_claims: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta or timedelta(minutes=auth_settings.access_token_expire_minutes)
    )

    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "access",
    }
    if additional_claims:
        payload.update(additional_claims)

    return _jwt_encode(payload)


def decode_token(token: str) -> dict[str, Any]:
    try:
        encoded_header, encoded_payload, encoded_signature = token.split(".", maxsplit=2)
    except ValueError as exc:
        raise InvalidOrExpiredTokenException() from exc

    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    expected_signature = _jwt_sign(signing_input)
    if not hmac.compare_digest(expected_signature, encoded_signature):
        raise InvalidOrExpiredTokenException()

    try:
        payload = json.loads(_b64url_decode(encoded_payload))
    except (json.JSONDecodeError, ValueError) as exc:
        raise InvalidOrExpiredTokenException() from exc

    exp = payload.get("exp")
    if not isinstance(exp, int):
        raise InvalidOrExpiredTokenException()

    now_ts = int(datetime.now(timezone.utc).timestamp())
    if exp < now_ts:
        raise InvalidOrExpiredTokenException()

    return payload


bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise InvalidOrExpiredTokenException()

    payload = decode_token(credentials.credentials)
    subject = payload.get("sub")
    if not isinstance(subject, str):
        raise InvalidOrExpiredTokenException()

    try:
        user_id = UUID(subject)
    except ValueError as exc:
        raise InvalidOrExpiredTokenException() from exc

    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    user = result.scalar_one_or_none()
    if user is None:
        raise InvalidOrExpiredTokenException()
    return user


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if not getattr(current_user, "is_admin", False):
        raise AdminRequiredException()
    return current_user

