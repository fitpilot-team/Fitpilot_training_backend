from datetime import datetime, timedelta
from typing import Any, Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
import hashlib
import logging
import requests
import threading
import time
from core.config import settings
from core.redis_cache import get_json as redis_get_json
from core.redis_cache import set_json as redis_set_json

# Password hashing - using argon2 (more secure and no length limitations)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
logger = logging.getLogger(__name__)

# Cache for Nutrition token introspection: token_hash -> (payload, expires_at_epoch)
_auth_introspection_cache: dict[str, tuple[dict[str, Any], float]] = {}
_auth_cache_lock = threading.Lock()
_AUTH_CACHE_EXP_MARGIN_SECONDS = 5
_AUTH_CACHE_MAX_ENTRIES = 4096
_AUTH_REDIS_KEY_PREFIX = "training:auth:introspection:"


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
    """Normalize role names from local JWT/db and Nutrition API payloads."""
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


def _token_cache_key(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _token_redis_cache_key(token: str) -> str:
    return f"{_AUTH_REDIS_KEY_PREFIX}{_token_cache_key(token)}"


def _extract_unverified_exp(token: str) -> Optional[float]:
    try:
        claims = jwt.get_unverified_claims(token)
    except (JWTError, ValueError, TypeError):
        return None

    exp = claims.get("exp")
    if exp is None:
        return None

    try:
        return float(exp)
    except (TypeError, ValueError):
        return None


def _compute_cache_expires_at(token: str) -> Optional[float]:
    now = time.time()
    configured_ttl = max(int(settings.NUTRITION_AUTH_CACHE_TTL_SECONDS), 0)
    token_exp = _extract_unverified_exp(token)

    if token_exp is not None:
        ttl_until_exp = token_exp - _AUTH_CACHE_EXP_MARGIN_SECONDS - now
        if ttl_until_exp <= 0:
            return None
        ttl_seconds = min(configured_ttl, ttl_until_exp) if configured_ttl > 0 else ttl_until_exp
    else:
        if configured_ttl <= 0:
            return None
        ttl_seconds = float(configured_ttl)

    if ttl_seconds <= 0:
        return None

    return now + ttl_seconds


def _prune_cache_locked(now_epoch: float) -> None:
    expired_keys = [key for key, (_, expires_at) in _auth_introspection_cache.items() if expires_at <= now_epoch]
    for key in expired_keys:
        _auth_introspection_cache.pop(key, None)

    if len(_auth_introspection_cache) <= _AUTH_CACHE_MAX_ENTRIES:
        return

    overflow = len(_auth_introspection_cache) - _AUTH_CACHE_MAX_ENTRIES
    keys_by_expiry = sorted(_auth_introspection_cache.items(), key=lambda item: item[1][1])
    for key, _ in keys_by_expiry[:overflow]:
        _auth_introspection_cache.pop(key, None)


def _get_cached_introspection(token: str) -> Optional[dict[str, Any]]:
    redis_key = _token_redis_cache_key(token)
    redis_payload = redis_get_json(redis_key)
    if redis_payload is not None:
        redis_expires_at = _compute_cache_expires_at(token)
        if redis_expires_at is not None:
            with _auth_cache_lock:
                _auth_introspection_cache[_token_cache_key(token)] = (redis_payload, redis_expires_at)
        logger.debug("auth_cache_hit source=redis")
        return redis_payload

    now_epoch = time.time()
    key = _token_cache_key(token)

    with _auth_cache_lock:
        entry = _auth_introspection_cache.get(key)
        if not entry:
            logger.debug("auth_cache_miss source=memory reason=not_found")
            return None

        payload, expires_at = entry
        if expires_at <= now_epoch:
            _auth_introspection_cache.pop(key, None)
            logger.debug("auth_cache_miss source=memory reason=expired")
            return None

        logger.debug("auth_cache_hit source=memory ttl_remaining_seconds=%.2f", expires_at - now_epoch)
        return payload


def _set_cached_introspection(token: str, payload: dict[str, Any]) -> None:
    expires_at = _compute_cache_expires_at(token)
    if expires_at is None:
        return

    key = _token_cache_key(token)
    now_epoch = time.time()
    ttl_seconds = max(expires_at - now_epoch, 0.0)

    with _auth_cache_lock:
        _prune_cache_locked(now_epoch)
        _auth_introspection_cache[key] = (payload, expires_at)

    redis_cached = redis_set_json(_token_redis_cache_key(token), payload, max(int(ttl_seconds), 1))
    logger.debug("auth_cache_store ttl_seconds=%.2f redis_store=%s", ttl_seconds, redis_cached)


def introspect_nutrition_token(token: str) -> Optional[dict[str, Any]]:
    """
    Validate a token against the Nutrition API (/v1/auth/me).
    Returns user-like payload dict when valid, otherwise None.
    """
    if not settings.NUTRITION_API_URL:
        return None

    base_url = settings.NUTRITION_API_URL.rstrip("/")
    auth_me_path = settings.NUTRITION_AUTH_ME_PATH.strip() or "/v1/auth/me"
    if not auth_me_path.startswith("/"):
        auth_me_path = f"/{auth_me_path}"

    url = f"{base_url}{auth_me_path}"

    try:
        response = requests.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=settings.NUTRITION_AUTH_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        logger.info("auth_introspection_failed reason=request_exception error_type=%s", exc.__class__.__name__)
        return None

    if response.status_code != 200:
        logger.info("auth_introspection_failed reason=status_code status=%s", response.status_code)
        return None

    try:
        data = response.json()
    except ValueError:
        logger.info("auth_introspection_failed reason=invalid_json")
        return None

    if not isinstance(data, dict):
        logger.info("auth_introspection_failed reason=invalid_payload_type")
        return None

    # Common response wrappers
    if isinstance(data.get("user"), dict):
        return data["user"]
    if isinstance(data.get("data"), dict) and isinstance(data["data"].get("user"), dict):
        return data["data"]["user"]
    if isinstance(data.get("data"), dict):
        return data["data"]
    return data


def introspect_nutrition_token_cached(token: str) -> Optional[dict[str, Any]]:
    """
    Cached token introspection.
    Uses short in-memory cache keyed by token hash to reduce remote auth latency.
    """
    cached_payload = _get_cached_introspection(token)
    if cached_payload is not None:
        return cached_payload

    payload = introspect_nutrition_token(token)
    if payload is None:
        return None

    _set_cached_introspection(token, payload)
    return payload
