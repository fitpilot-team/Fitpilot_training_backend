import json
import logging
import threading
import time
from typing import Any, Optional

import redis
from redis.exceptions import RedisError

from core.config import settings

logger = logging.getLogger(__name__)

_REDIS_CONNECT_TIMEOUT_SECONDS = 0.2
_REDIS_SOCKET_TIMEOUT_SECONDS = 0.2
_REDIS_ERROR_COOLDOWN_SECONDS = 30.0

_redis_client: Optional[redis.Redis] = None
_redis_lock = threading.Lock()
_redis_disabled_until_epoch = 0.0


def _mark_redis_unavailable(exc: Exception) -> None:
    global _redis_client, _redis_disabled_until_epoch
    _redis_client = None
    _redis_disabled_until_epoch = time.time() + _REDIS_ERROR_COOLDOWN_SECONDS
    logger.warning("redis_cache_unavailable error_type=%s", exc.__class__.__name__)


def _get_client() -> Optional[redis.Redis]:
    global _redis_client

    now_epoch = time.time()
    if now_epoch < _redis_disabled_until_epoch:
        return None

    with _redis_lock:
        if _redis_client is not None:
            return _redis_client

        try:
            _redis_client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=_REDIS_CONNECT_TIMEOUT_SECONDS,
                socket_timeout=_REDIS_SOCKET_TIMEOUT_SECONDS,
                retry_on_timeout=True,
                health_check_interval=30,
            )
        except (ValueError, RedisError) as exc:
            _mark_redis_unavailable(exc)
            return None

        return _redis_client


def get_json(key: str) -> Optional[dict[str, Any]]:
    client = _get_client()
    if client is None:
        return None

    try:
        raw = client.get(key)
    except RedisError as exc:
        _mark_redis_unavailable(exc)
        return None

    if raw is None:
        return None

    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        logger.debug("redis_cache_invalid_json key=%s", key)
        return None

    return parsed if isinstance(parsed, dict) else None


def set_json(key: str, payload: dict[str, Any], ttl_seconds: int) -> bool:
    if ttl_seconds <= 0:
        return False

    client = _get_client()
    if client is None:
        return False

    try:
        client.set(key, json.dumps(payload, separators=(",", ":")), ex=ttl_seconds)
        return True
    except RedisError as exc:
        _mark_redis_unavailable(exc)
        return False
