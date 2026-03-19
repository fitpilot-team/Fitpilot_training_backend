"""
Remote-only media storage helpers for training images.

All managed image uploads are stored in Cloudflare R2 and persisted as public
CDN URLs. Legacy local `/static/...` image paths are no longer supported.
"""
from __future__ import annotations

from typing import Optional
import logging
import mimetypes
import re
import uuid

from fastapi import UploadFile

from core.config import settings

logger = logging.getLogger(__name__)


class StorageError(RuntimeError):
    """Raised when media storage operations fail."""


def ensure_media_storage_config() -> None:
    _ensure_r2_config()


def upload_exercise_media(exercise_id: str, file: UploadFile) -> str:
    """
    Upload a custom trainer-provided exercise image to R2.
    Returns the public URL to persist in DB.
    """
    source_name = file.filename or f"{exercise_id}.bin"
    object_key = f"exercises/{_build_storage_filename(exercise_id, source_name)}"
    content_type = _guess_content_type(source_name, file.content_type)
    content = _read_upload_file(file, "uploaded exercise media")
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


def upload_profile_image(user_id: str, file: UploadFile) -> str:
    """
    Upload a user profile image to R2.
    Returns the public URL to persist in DB.
    """
    source_name = file.filename or f"{user_id}.bin"
    object_key = f"profiles/{_build_storage_filename(user_id, source_name)}"
    content_type = _guess_content_type(source_name, file.content_type)
    content = _read_upload_file(file, "uploaded profile image")
    return _put_object_to_r2(object_key=object_key, content=content, content_type=content_type)


def delete_managed_media(media_url: str | None) -> None:
    """
    Delete an R2-managed media object referenced by its public URL.
    Unmanaged or legacy local URLs are ignored.
    """
    if not media_url:
        return

    key = _r2_key_from_url(media_url)
    if not key:
        logger.info("Skipping media deletion for unmanaged URL: %s", media_url)
        return

    try:
        client = _build_r2_client()
        client.delete_object(Bucket=settings.R2_BUCKET, Key=key)
    except Exception as exc:
        raise StorageError(f"Failed to delete media from R2: {exc}") from exc


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
            + ". Local image storage fallback was removed."
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


def _build_storage_filename(entity_id: str, source_filename: str) -> str:
    ext = _resolve_extension(source_filename)
    return f"{entity_id}_{uuid.uuid4().hex[:8]}{ext}"


def _build_stable_storage_filename(entity_id: str, media_kind: str, source_filename: str) -> str:
    ext = _resolve_extension(source_filename)
    return f"{entity_id}_{_sanitize_media_segment(media_kind)}{ext}"


def _resolve_extension(source_filename: str) -> str:
    ext = source_filename.rsplit(".", 1)[-1].lower() if "." in source_filename else ""
    return f".{ext}" if ext else ".bin"


def _read_upload_file(file: UploadFile, description: str) -> bytes:
    try:
        file.file.seek(0)
        content = file.file.read()
    except Exception as exc:
        raise StorageError(f"Failed to read {description}: {exc}") from exc

    if not content:
        raise StorageError(f"{description.capitalize()} is empty")

    return content


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
