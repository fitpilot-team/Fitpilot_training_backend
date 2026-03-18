"""
Exercise media storage abstraction.

New exercise media is stored only in Cloudflare R2.
Legacy local `/static/exercises/...` URLs remain readable/deletable for migration cleanup.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse
from typing import Optional
import logging
import mimetypes
import re
import uuid

from fastapi import UploadFile

from core.config import settings

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
STATIC_ROOT = PROJECT_ROOT / "static"
EXERCISE_STATIC_DIR = STATIC_ROOT / "exercises"
STATIC_EXERCISE_URL_PREFIX = "/static/exercises/"


class StorageError(RuntimeError):
    """Raised when media storage operations fail."""


def ensure_exercise_media_storage_config() -> None:
    _ensure_r2_config()


def is_legacy_static_exercise_url(url: Optional[str]) -> bool:
    if not url:
        return False

    parsed = urlparse(url)
    path = parsed.path or url
    return path.startswith(STATIC_EXERCISE_URL_PREFIX)


def static_exercise_path_from_url(url: str) -> Path:
    parsed = urlparse(url)
    path = parsed.path or url
    relative_path = path[len(STATIC_EXERCISE_URL_PREFIX):].lstrip("/") if path.startswith(STATIC_EXERCISE_URL_PREFIX) else Path(path).name
    safe_segments = [segment for segment in Path(relative_path).parts if segment not in {"", ".", ".."}]

    if not safe_segments:
        raise StorageError(f"Invalid legacy static exercise URL: {url}")

    return EXERCISE_STATIC_DIR.joinpath(*safe_segments)


def _guess_content_type(file_name: str, provided_content_type: Optional[str] = None) -> str:
    if provided_content_type and provided_content_type.startswith("image/"):
        return provided_content_type

    guessed, _ = mimetypes.guess_type(file_name)
    if guessed:
        return guessed
    return "application/octet-stream"


def _ensure_r2_config() -> None:
    required_fields = {
        "R2_ENDPOINT": settings.R2_ENDPOINT,
        "R2_BUCKET": settings.R2_BUCKET,
        "R2_ACCESS_KEY_ID": settings.R2_ACCESS_KEY_ID,
        "R2_SECRET_ACCESS_KEY": settings.R2_SECRET_ACCESS_KEY,
        "R2_PUBLIC_BASE_URL": settings.R2_PUBLIC_BASE_URL,
    }
    missing = [key for key, value in required_fields.items() if not value]
    if missing:
        raise StorageError(
            "R2 configuration missing: "
            + ", ".join(missing)
            + ". Local exercise media fallback was removed."
        )


def _build_r2_client():
    import boto3
    from botocore.config import Config as BotoConfig

    _ensure_r2_config()
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name=settings.R2_REGION,
        config=BotoConfig(signature_version="s3v4"),
    )


def _build_r2_public_url(object_key: str) -> str:
    base = (settings.R2_PUBLIC_BASE_URL or "").rstrip("/")
    return f"{base}/{object_key.lstrip('/')}"


def _r2_key_from_url(url: str) -> Optional[str]:
    if not settings.R2_PUBLIC_BASE_URL:
        return None

    base = settings.R2_PUBLIC_BASE_URL.rstrip("/")
    if not url.startswith(base):
        return None

    key = url[len(base):].lstrip("/")
    return key or None


def _sanitize_media_segment(value: str) -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9_-]+", "_", value.strip().lower())
    return sanitized.strip("_") or "media"


def _build_storage_filename(exercise_id: str, source_filename: str) -> str:
    ext = Path(source_filename).suffix.lower() or ".bin"
    return f"{exercise_id}_{uuid.uuid4().hex[:8]}{ext}"


def _build_stable_storage_filename(exercise_id: str, media_kind: str, source_filename: str) -> str:
    ext = Path(source_filename).suffix.lower() or ".bin"
    return f"{exercise_id}_{_sanitize_media_segment(media_kind)}{ext}"


def _put_object_to_r2(*, object_key: str, content: bytes, content_type: str) -> str:
    try:
        client = _build_r2_client()
        client.put_object(
            Bucket=settings.R2_BUCKET,
            Key=object_key,
            Body=content,
            ContentType=content_type,
        )
    except Exception as exc:
        raise StorageError(f"Failed to upload media to R2: {exc}") from exc

    return _build_r2_public_url(object_key)


def upload_exercise_media(exercise_id: str, file: UploadFile) -> str:
    """
    Upload a custom trainer-provided exercise image to R2.
    Returns the public URL to persist in DB.
    """
    source_name = file.filename or f"{exercise_id}.bin"
    object_key = f"exercises/{_build_storage_filename(exercise_id, source_name)}"
    content_type = _guess_content_type(source_name, file.content_type)

    try:
        file.file.seek(0)
        content = file.file.read()
    except Exception as exc:
        raise StorageError(f"Failed to read uploaded media file: {exc}") from exc

    if not content:
        raise StorageError("Uploaded exercise media is empty")

    return _put_object_to_r2(object_key=object_key, content=content, content_type=content_type)


def upload_exercise_media_bytes(
    *,
    exercise_id: str,
    media_kind: str,
    source_filename: str,
    content: bytes,
    content_type: Optional[str] = None,
) -> str:
    """
    Upload generated/downloaded exercise media bytes to a deterministic R2 key.
    """
    if not content:
        raise StorageError("Generated exercise media is empty")

    object_key = f"exercises/{_build_stable_storage_filename(exercise_id, media_kind, source_filename)}"
    resolved_content_type = _guess_content_type(source_filename, content_type)
    return _put_object_to_r2(
        object_key=object_key,
        content=content,
        content_type=resolved_content_type,
    )


def upload_local_file_to_r2(local_file_path: Path, exercise_id: str, source_filename: Optional[str] = None) -> str:
    """
    Upload a legacy local exercise file to R2.
    Used by migration script.
    """
    if not local_file_path.exists():
        raise StorageError(f"Local media file not found: {local_file_path}")

    file_name = source_filename or local_file_path.name
    object_key = f"exercises/{_build_storage_filename(exercise_id, file_name)}"
    content_type = _guess_content_type(file_name)

    try:
        content = local_file_path.read_bytes()
    except OSError as exc:
        raise StorageError(f"Failed to read local media file {local_file_path}: {exc}") from exc

    return _put_object_to_r2(object_key=object_key, content=content, content_type=content_type)


def delete_exercise_media(media_url: str) -> None:
    """
    Delete media from whichever managed provider owns it.
    Supports:
    - legacy local `/static/exercises/*`
    - managed R2 URLs configured with `R2_PUBLIC_BASE_URL`
    """
    if not media_url:
        return

    if is_legacy_static_exercise_url(media_url):
        local_path = static_exercise_path_from_url(media_url)
        if local_path.exists():
            try:
                local_path.unlink()
            except OSError as exc:
                raise StorageError(f"Failed to delete local media file {local_path}: {exc}") from exc
        return

    key = _r2_key_from_url(media_url)
    if key:
        try:
            client = _build_r2_client()
            client.delete_object(Bucket=settings.R2_BUCKET, Key=key)
        except Exception as exc:
            raise StorageError(f"Failed to delete media from R2: {exc}") from exc
        return

    logger.info("Skipping media deletion for unmanaged URL: %s", media_url)
