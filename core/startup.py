from __future__ import annotations

import logging

from services.media_storage import StorageError, ensure_media_storage_config

logger = logging.getLogger(__name__)


def validate_media_storage_startup_health() -> bool:
    try:
        ensure_media_storage_config()
    except StorageError as exc:
        logger.warning(
            "media_storage_startup_warning uploads_disabled=true detail=%s",
            exc,
        )
        return False

    return True
