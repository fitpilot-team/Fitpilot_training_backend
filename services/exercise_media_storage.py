"""
Exercise media storage abstraction.

Supports dual mode:
- local filesystem (/static/exercises/...)
- Cloudflare R2 (public CDN URL)
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse
from typing import Optional
import logging
import mimetypes
import uuid

from fastapi import UploadFile

from core.config import settings

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
STATIC_ROOT = PROJECT_ROOT / "static"
EXERCISE_STATIC_DIR = STATIC_ROOT / "exercises"
EXERCISE_STATIC_DIR.mkdir(parents=True, exist_ok=True)


class StorageError(RuntimeError):
    """Raised when media storage operations fail."""


def get_media_provider() -> str:
    provider = (settings.EXERCISE_MEDIA_PROVIDER or "local").strip().lower()
    if provider not in {"local", "r2"}:
        return "local"
    return provider


def is_legacy_static_exercise_url(url: Optional[str]) -> bool:
    if not url:
        return False

    parsed = urlparse(url)
    path = parsed.path or url
    return path.startswith("/static/exercises/")


def static_exercise_path_from_url(url: str) -> Path:
    parsed = urlparse(url)
    path = parsed.path or url
    filename = Path(path).name
    return EXERCISE_STATIC_DIR / filename


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
        raise StorageError(f"R2 configuration missing: {', '.join(missing)}")


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
    return f"{base}/{object_key}"


def _r2_key_from_url(url: str) -> Optional[str]:
    if not settings.R2_PUBLIC_BASE_URL:
        return None

    base = settings.R2_PUBLIC_BASE_URL.rstrip("/")
    if not url.startswith(base):
        return None

    key = url[len(base):].lstrip("/")
    return key or None


def _build_storage_filename(exercise_id: str, source_filename: str) -> str:
    ext = Path(source_filename).suffix.lower()
    return f"{exercise_id}_{uuid.uuid4().hex[:8]}{ext}"


def upload_exercise_media(exercise_id: str, file: UploadFile) -> str:
    """
    Upload exercise media using configured provider.
    Returns public URL that should be persisted in DB.
    """
    source_name = file.filename or f"{exercise_id}.bin"
    storage_filename = _build_storage_filename(exercise_id, source_name)
    provider = get_media_provider()

    try:
        file.file.seek(0)
    except Exception:
        pass

    if provider == "local":
        destination = EXERCISE_STATIC_DIR / storage_filename
        try:
            with open(destination, "wb") as output:
                output.write(file.file.read())
        except OSError as exc:
            raise StorageError(f"Failed to write local exercise media: {exc}") from exc
        return f"/static/exercises/{storage_filename}"

    # R2 provider
    object_key = f"exercises/{storage_filename}"
    content_type = _guess_content_type(source_name, file.content_type)

    try:
        client = _build_r2_client()
        file.file.seek(0)
        client.upload_fileobj(
            Fileobj=file.file,
            Bucket=settings.R2_BUCKET,
            Key=object_key,
            ExtraArgs={"ContentType": content_type},
        )
    except Exception as exc:
        raise StorageError(f"Failed to upload media to R2: {exc}") from exc

    return _build_r2_public_url(object_key)


def upload_local_file_to_r2(local_file_path: Path, exercise_id: str, source_filename: Optional[str] = None) -> str:
    """
    Upload a local existing exercise file to R2.
    Used by migration script.
    """
    if not local_file_path.exists():
        raise StorageError(f"Local media file not found: {local_file_path}")

    _ensure_r2_config()

    file_name = source_filename or local_file_path.name
    storage_filename = _build_storage_filename(exercise_id, file_name)
    object_key = f"exercises/{storage_filename}"
    content_type = _guess_content_type(file_name)

    try:
        client = _build_r2_client()
        with open(local_file_path, "rb") as input_file:
            client.upload_fileobj(
                Fileobj=input_file,
                Bucket=settings.R2_BUCKET,
                Key=object_key,
                ExtraArgs={"ContentType": content_type},
            )
    except Exception as exc:
        raise StorageError(f"Failed to migrate media to R2: {exc}") from exc

    return _build_r2_public_url(object_key)


def delete_exercise_media(media_url: str) -> None:
    """
    Delete media URL from whichever provider owns it.
    Supports both:
    - local legacy /static/exercises/*
    - R2 URL configured with R2_PUBLIC_BASE_URL
    """
    if not media_url:
        return

    # Legacy/local static URLs can always be removed regardless of current provider.
    if is_legacy_static_exercise_url(media_url):
        local_path = static_exercise_path_from_url(media_url)
        if local_path.exists():
            try:
                local_path.unlink()
            except OSError as exc:
                raise StorageError(f"Failed to delete local media file {local_path}: {exc}") from exc
        return

    # R2 URL
    key = _r2_key_from_url(media_url)
    if key:
        try:
            client = _build_r2_client()
            client.delete_object(Bucket=settings.R2_BUCKET, Key=key)
        except Exception as exc:
            raise StorageError(f"Failed to delete media from R2: {exc}") from exc
        return

    logger.info("Skipping media deletion for unmanaged URL: %s", media_url)
