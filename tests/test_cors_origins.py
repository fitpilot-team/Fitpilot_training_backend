from types import SimpleNamespace

from core.cors import resolve_allowed_origins


def test_resolve_allowed_origins_includes_public_app_domains():
    settings = SimpleNamespace(
        CORS_ALLOWED_ORIGINS=None,
        FRONTEND_URL="http://localhost:3000",
    )

    origins = resolve_allowed_origins(settings)

    assert "https://pro.fitpilot.fit" in origins
    assert "https://fitpilot.fit" in origins
    assert "https://app.fitpilot.fit" in origins
    assert "http://localhost:3000" in origins
    assert "http://localhost:4000" in origins


def test_resolve_allowed_origins_dedupes_values():
    settings = SimpleNamespace(
        CORS_ALLOWED_ORIGINS="https://pro.fitpilot.fit, https://custom.fitpilot.fit, https://pro.fitpilot.fit/",
        FRONTEND_URL="https://custom.fitpilot.fit/",
    )

    origins = resolve_allowed_origins(settings)

    assert origins.count("https://pro.fitpilot.fit") == 1
    assert origins.count("https://custom.fitpilot.fit") == 1
