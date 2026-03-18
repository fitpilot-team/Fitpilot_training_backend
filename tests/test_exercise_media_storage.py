import io
from pathlib import Path
import sys

import pytest
from fastapi import UploadFile


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services import exercise_media_storage as media_storage  # noqa: E402


def _set_valid_r2_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(media_storage.settings, "R2_ENDPOINT", "https://account-id.r2.cloudflarestorage.com")
    monkeypatch.setattr(media_storage.settings, "R2_REGION", "auto")
    monkeypatch.setattr(media_storage.settings, "R2_BUCKET", "fitpilot-exercise-media")
    monkeypatch.setattr(media_storage.settings, "R2_ACCESS_KEY_ID", "test-access-key")
    monkeypatch.setattr(media_storage.settings, "R2_SECRET_ACCESS_KEY", "test-secret-key")
    monkeypatch.setattr(media_storage.settings, "R2_PUBLIC_BASE_URL", "https://cdn.fitpilot.fit")


def test_ensure_exercise_media_storage_config_requires_r2(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_valid_r2_config(monkeypatch)
    monkeypatch.setattr(media_storage.settings, "R2_BUCKET", None)

    with pytest.raises(media_storage.StorageError, match="Local exercise media fallback was removed"):
        media_storage.ensure_exercise_media_storage_config()


def test_upload_exercise_media_uploads_custom_image_to_r2(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_valid_r2_config(monkeypatch)
    uploaded = {}

    class FakeClient:
        def put_object(self, **kwargs):
            uploaded.update(kwargs)

    monkeypatch.setattr(media_storage, "_build_r2_client", lambda: FakeClient())

    file = UploadFile(filename="bench-press.png", file=io.BytesIO(b"image-bytes"))
    url = media_storage.upload_exercise_media("25", file)

    assert uploaded["Bucket"] == "fitpilot-exercise-media"
    assert uploaded["Key"].startswith("exercises/25_")
    assert uploaded["Body"] == b"image-bytes"
    assert uploaded["ContentType"] == "image/png"
    assert url.startswith("https://cdn.fitpilot.fit/exercises/25_")


def test_upload_exercise_media_bytes_uses_stable_r2_key_for_generated_images(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_valid_r2_config(monkeypatch)
    uploaded = {}

    class FakeClient:
        def put_object(self, **kwargs):
            uploaded.update(kwargs)

    monkeypatch.setattr(media_storage, "_build_r2_client", lambda: FakeClient())

    url = media_storage.upload_exercise_media_bytes(
        exercise_id="41",
        media_kind="movement",
        source_filename="jumping_jack.gif",
        content=b"gif-bytes",
        content_type="image/gif",
    )

    assert uploaded["Key"] == "exercises/41_movement.gif"
    assert uploaded["ContentType"] == "image/gif"
    assert url == "https://cdn.fitpilot.fit/exercises/41_movement.gif"


def test_static_exercise_path_from_url_preserves_legacy_subdirectories() -> None:
    path = media_storage.static_exercise_path_from_url("/static/exercises/movement/push_up.gif")

    assert path == media_storage.EXERCISE_STATIC_DIR / "movement" / "push_up.gif"
