from pathlib import Path
import sys
import time


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from core import security  # noqa: E402


class _DummyResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def setup_function() -> None:
    security._auth_introspection_cache.clear()


def teardown_function() -> None:
    security._auth_introspection_cache.clear()


def test_introspection_memory_cache_hit_avoids_remote(monkeypatch) -> None:
    token = "memory-token"
    payload = {"id": 7, "email": "memory@fitpilot.com"}
    security._auth_introspection_cache[security._token_cache_key(token)] = (payload, time.time() + 60)

    monkeypatch.setattr(security, "redis_get_json", lambda key: None)
    monkeypatch.setattr(
        security,
        "introspect_nutrition_token",
        lambda token: (_ for _ in ()).throw(AssertionError("remote introspection should not run")),
    )

    assert security.introspect_nutrition_token_cached(token) == payload


def test_introspection_redis_cache_hit_avoids_remote(monkeypatch) -> None:
    token = "redis-token"
    payload = {"id": 11, "email": "redis@fitpilot.com"}

    monkeypatch.setattr(security, "redis_get_json", lambda key: payload)
    monkeypatch.setattr(security, "_compute_cache_expires_at", lambda token: time.time() + 60)
    monkeypatch.setattr(
        security,
        "introspect_nutrition_token",
        lambda token: (_ for _ in ()).throw(AssertionError("remote introspection should not run")),
    )

    assert security.introspect_nutrition_token_cached(token) == payload


def test_introspection_cache_miss_uses_default_lightweight_endpoint(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_get(url: str, headers: dict[str, str], timeout: int):
        captured["url"] = url
        captured["headers"] = headers
        captured["timeout"] = timeout
        return _DummyResponse(200, {"id": 21, "email": "remote@fitpilot.com"})

    monkeypatch.setattr(security, "redis_get_json", lambda key: None)
    monkeypatch.setattr(security.requests, "get", fake_get)
    monkeypatch.setattr(security.settings, "NUTRITION_API_URL", "http://nutrition-backend:3000")
    monkeypatch.setattr(security.settings, "NUTRITION_AUTH_ME_PATH", "")

    payload = security.introspect_nutrition_token_cached("remote-token")

    assert payload == {"id": 21, "email": "remote@fitpilot.com"}
    assert captured["url"] == "http://nutrition-backend:3000/v1/auth/introspect"
    assert captured["timeout"] == security.settings.NUTRITION_AUTH_TIMEOUT_SECONDS


def test_introspection_path_can_be_overridden_by_env_setting(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_get(url: str, headers: dict[str, str], timeout: int):
        captured["url"] = url
        return _DummyResponse(200, {"id": 22, "email": "override@fitpilot.com"})

    monkeypatch.setattr(security.requests, "get", fake_get)
    monkeypatch.setattr(security.settings, "NUTRITION_API_URL", "http://nutrition-backend:3000")
    monkeypatch.setattr(security.settings, "NUTRITION_AUTH_ME_PATH", "/custom/introspection")

    payload = security.introspect_nutrition_token("override-token")

    assert payload == {"id": 22, "email": "override@fitpilot.com"}
    assert captured["url"] == "http://nutrition-backend:3000/custom/introspection"
