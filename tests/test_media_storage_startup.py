import logging

from core.startup import validate_media_storage_startup_health
from services.media_storage import StorageError


def test_validate_media_storage_startup_health_warns_without_crashing(
    monkeypatch,
    caplog,
) -> None:
    def fake_ensure_media_storage_config() -> None:
        raise StorageError("R2 configuration missing: R2_ACCESS_KEY_ID")

    monkeypatch.setattr(
        "core.startup.ensure_media_storage_config",
        fake_ensure_media_storage_config,
    )

    with caplog.at_level(logging.WARNING):
        result = validate_media_storage_startup_health()

    assert result is False
    assert "media_storage_startup_warning" in caplog.text
    assert "R2 configuration missing: R2_ACCESS_KEY_ID" in caplog.text


def test_validate_media_storage_startup_health_returns_true_when_configured(
    monkeypatch,
    caplog,
) -> None:
    monkeypatch.setattr(
        "core.startup.ensure_media_storage_config",
        lambda: None,
    )

    with caplog.at_level(logging.WARNING):
        result = validate_media_storage_startup_health()

    assert result is True
    assert "media_storage_startup_warning" not in caplog.text
