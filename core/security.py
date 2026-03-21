from datetime import datetime, timedelta
from typing import Any, Optional, Union
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from passlib.context import CryptContext
import logging
import time
from core.config import settings
from core.timing import elapsed_ms

# Password hashing - using argon2 (more secure and no length limitations)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
logger = logging.getLogger(__name__)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return encoded_jwt


def decode_access_token(token: str) -> Union[dict, None]:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def normalize_auth_role(role: Optional[str]) -> Optional[str]:
    """Normalize role names from local DB and Nutrition JWT payloads."""
    if not role:
        return None

    role_key = str(role).strip().lower()
    role_map = {
        "admin": "admin",
        "administrator": "admin",
        "super_admin": "admin",
        "trainer": "trainer",
        "professional": "trainer",
        "coach": "trainer",
        "client": "client",
        "patient": "client",
        "user": "client",
    }
    return role_map.get(role_key, role_key)


def get_nutrition_jwt_secrets() -> list[str]:
    raw_value = str(settings.NUTRITION_JWT_SECRETS or "")
    secrets: list[str] = []
    seen: set[str] = set()

    for item in raw_value.split(","):
        secret = item.strip()
        if not secret or secret in seen:
            continue
        secrets.append(secret)
        seen.add(secret)

    return secrets


def _has_resolvable_identity(payload: dict[str, Any]) -> bool:
    for key in ("sub", "id", "user_id", "uuid"):
        value = payload.get(key)
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return True

    email = payload.get("email") or payload.get("user_email")
    return isinstance(email, str) and bool(email.strip())


def verify_nutrition_access_token_locally(token: str) -> Optional[dict[str, Any]]:
    started_at = time.perf_counter()
    secrets = get_nutrition_jwt_secrets()
    if not secrets:
        logger.error("nutrition_jwt_local_failed reason=missing_secrets")
        return None

    algorithm = str(settings.NUTRITION_JWT_ALGORITHM or "HS256").strip() or "HS256"
    last_error_type: str | None = None
    expired = False

    for index, secret in enumerate(secrets):
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=[algorithm],
                options={"verify_sub": False},
            )
        except ExpiredSignatureError:
            expired = True
            last_error_type = "ExpiredSignatureError"
            continue
        except JWTError as exc:
            last_error_type = exc.__class__.__name__
            continue

        if payload.get("token_type") != "access":
            logger.info(
                "[auth.jwt_local] auth_source=jwt_local status=invalid_token_type total=%.2fms",
                elapsed_ms(started_at),
            )
            logger.info("nutrition_jwt_local_failed reason=invalid_token_type")
            return None

        if not _has_resolvable_identity(payload):
            logger.info(
                "[auth.jwt_local] auth_source=jwt_local status=invalid_payload total=%.2fms",
                elapsed_ms(started_at),
            )
            logger.info("nutrition_jwt_local_failed reason=missing_identity_fields")
            return None

        logger.info(
            "[auth.jwt_local] auth_source=jwt_local status=ok secret_index=%s total=%.2fms",
            index,
            elapsed_ms(started_at),
        )
        return payload

    failure_reason = "expired" if expired else "invalid_signature"
    logger.info(
        "[auth.jwt_local] auth_source=jwt_local status=%s total=%.2fms",
        failure_reason,
        elapsed_ms(started_at),
    )
    logger.info(
        "nutrition_jwt_local_failed reason=%s error_type=%s",
        failure_reason,
        last_error_type or "unknown",
    )
    return None
