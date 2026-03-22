from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
import sys

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt
from pydantic import ValidationError
import pytest


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from core import dependencies, security  # noqa: E402
from core.config import Settings  # noqa: E402


REMOTE_DATABASE_URL = "postgresql://user:password@remote.example.com:5432/fitpilot?sslmode=require"


def _build_nutrition_token(secret: str, payload: dict, expires_delta: timedelta = timedelta(minutes=5)) -> str:
    claims = {
        **payload,
        "exp": int((datetime.now(timezone.utc) + expires_delta).timestamp()),
    }
    return jwt.encode(claims, secret, algorithm="HS256")


def test_verify_nutrition_access_token_locally_accepts_valid_access_token(monkeypatch) -> None:
    monkeypatch.setattr(security.settings, "NUTRITION_JWT_SECRETS", "new-secret")
    monkeypatch.setattr(security.settings, "NUTRITION_JWT_ALGORITHM", "HS256")

    token = _build_nutrition_token(
        "new-secret",
        {
            "sub": 9,
            "email": "coach@fitpilot.com",
            "role": "PROFESSIONAL",
            "professional_role": ["TRAINER"],
            "token_type": "access",
        },
    )

    payload = security.verify_nutrition_access_token_locally(token)

    assert payload is not None
    assert payload["sub"] == 9
    assert payload["token_type"] == "access"


def test_verify_nutrition_access_token_locally_accepts_secondary_secret_during_rotation(monkeypatch) -> None:
    monkeypatch.setattr(security.settings, "NUTRITION_JWT_SECRETS", "new-secret,old-secret")
    monkeypatch.setattr(security.settings, "NUTRITION_JWT_ALGORITHM", "HS256")

    token = _build_nutrition_token(
        "old-secret",
        {
            "sub": 11,
            "email": "legacy@fitpilot.com",
            "role": "PROFESSIONAL",
            "token_type": "access",
        },
    )

    payload = security.verify_nutrition_access_token_locally(token)

    assert payload is not None
    assert payload["sub"] == 11


def test_verify_nutrition_access_token_locally_rejects_invalid_secret(monkeypatch) -> None:
    monkeypatch.setattr(security.settings, "NUTRITION_JWT_SECRETS", "new-secret")
    monkeypatch.setattr(security.settings, "NUTRITION_JWT_ALGORITHM", "HS256")

    token = _build_nutrition_token(
        "wrong-secret",
        {
            "sub": 12,
            "email": "wrong-secret@fitpilot.com",
            "role": "PROFESSIONAL",
            "token_type": "access",
        },
    )

    assert security.verify_nutrition_access_token_locally(token) is None


def test_verify_nutrition_access_token_locally_rejects_expired_tokens(monkeypatch) -> None:
    monkeypatch.setattr(security.settings, "NUTRITION_JWT_SECRETS", "new-secret")
    monkeypatch.setattr(security.settings, "NUTRITION_JWT_ALGORITHM", "HS256")

    token = _build_nutrition_token(
        "new-secret",
        {
            "sub": 13,
            "email": "expired@fitpilot.com",
            "role": "PROFESSIONAL",
            "token_type": "access",
        },
        expires_delta=timedelta(minutes=-5),
    )

    assert security.verify_nutrition_access_token_locally(token) is None


def test_verify_nutrition_access_token_locally_rejects_refresh_tokens(monkeypatch) -> None:
    monkeypatch.setattr(security.settings, "NUTRITION_JWT_SECRETS", "new-secret")
    monkeypatch.setattr(security.settings, "NUTRITION_JWT_ALGORITHM", "HS256")

    token = _build_nutrition_token(
        "new-secret",
        {
            "sub": 15,
            "email": "refresh@fitpilot.com",
            "role": "PROFESSIONAL",
            "token_type": "refresh",
        },
    )

    assert security.verify_nutrition_access_token_locally(token) is None


def test_verify_nutrition_access_token_locally_rejects_payload_without_identity(monkeypatch) -> None:
    monkeypatch.setattr(security.settings, "NUTRITION_JWT_SECRETS", "new-secret")
    monkeypatch.setattr(security.settings, "NUTRITION_JWT_ALGORITHM", "HS256")

    token = _build_nutrition_token(
        "new-secret",
        {
            "role": "PROFESSIONAL",
            "token_type": "access",
        },
    )

    assert security.verify_nutrition_access_token_locally(token) is None


def test_settings_require_nutrition_jwt_secrets() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, DATABASE_URL=REMOTE_DATABASE_URL)


def test_get_current_user_uses_local_jwt_payload_for_training_access(monkeypatch) -> None:
    payload = {
        "sub": 21,
        "id": 21,
        "email": "coach@fitpilot.com",
        "role": "PROFESSIONAL",
        "professional_role": ["TRAINER"],
        "professional_roles": ["TRAINER"],
        "professionalRole": ["TRAINER"],
        "professionalRoles": ["TRAINER"],
        "has_active_subscription": True,
        "current_subscription": {
            "plan_id": 3,
            "status": "active",
            "plan": {
                "id": 3,
                "name": "Training Pro",
            },
            "plan_details": {
                "id": 3,
                "name": "Training Pro",
            },
        },
        "subscription_vigency": {
            "is_vigent": True,
        },
        "token_type": "access",
    }
    user = SimpleNamespace(
        id=21,
        email="coach@fitpilot.com",
        role="PROFESSIONAL",
        is_active=True,
        professional_roles=[],
    )

    monkeypatch.setattr(dependencies, "get_nutrition_jwt_secrets", lambda: ["new-secret"])
    monkeypatch.setattr(dependencies, "verify_nutrition_access_token_locally", lambda token: payload)
    monkeypatch.setattr(dependencies, "_resolve_user", lambda db, user_id, email: user)

    request = SimpleNamespace(url=SimpleNamespace(path="/api/mesocycles"), method="GET")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="local-token")

    resolved_user = dependencies.get_current_user(request, credentials, db=object())
    context = dependencies.get_training_access_context(resolved_user)

    assert getattr(resolved_user, "_auth_payload") == payload
    assert getattr(resolved_user, "_effective_auth_role") == "trainer"
    assert context.effective_role == "trainer"
    assert context.has_training_plan_access is True
    assert context.has_trainer_professional_role is True


def test_get_current_user_rejects_invalid_local_jwt_with_401(monkeypatch) -> None:
    monkeypatch.setattr(dependencies, "get_nutrition_jwt_secrets", lambda: ["new-secret"])
    monkeypatch.setattr(dependencies, "verify_nutrition_access_token_locally", lambda token: None)

    request = SimpleNamespace(url=SimpleNamespace(path="/api/mesocycles"), method="GET")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-token")

    with pytest.raises(HTTPException) as exc_info:
        dependencies.get_current_user(request, credentials, db=object())

    assert exc_info.value.status_code == 401


def test_get_current_user_rejects_inactive_user_with_403(monkeypatch) -> None:
    payload = {
        "sub": 24,
        "email": "inactive@fitpilot.com",
        "role": "PROFESSIONAL",
        "token_type": "access",
    }
    inactive_user = SimpleNamespace(
        id=24,
        email="inactive@fitpilot.com",
        role="PROFESSIONAL",
        is_active=False,
        professional_roles=[],
    )

    monkeypatch.setattr(dependencies, "get_nutrition_jwt_secrets", lambda: ["new-secret"])
    monkeypatch.setattr(dependencies, "verify_nutrition_access_token_locally", lambda token: payload)
    monkeypatch.setattr(dependencies, "_resolve_user", lambda db, user_id, email: inactive_user)

    request = SimpleNamespace(url=SimpleNamespace(path="/api/mesocycles"), method="GET")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="local-token")

    with pytest.raises(HTTPException) as exc_info:
        dependencies.get_current_user(request, credentials, db=object())

    assert exc_info.value.status_code == 403


def test_local_jwt_payload_without_training_plan_still_forbids_module_access(monkeypatch) -> None:
    payload = {
        "sub": 22,
        "email": "coach-no-plan@fitpilot.com",
        "role": "PROFESSIONAL",
        "professional_role": ["TRAINER"],
        "has_active_subscription": False,
        "current_subscription": None,
        "subscription_vigency": None,
        "token_type": "access",
    }
    user = SimpleNamespace(
        id=22,
        email="coach-no-plan@fitpilot.com",
        role="PROFESSIONAL",
        is_active=True,
        professional_roles=[],
        _auth_payload=payload,
        _effective_auth_role="trainer",
    )

    with pytest.raises(HTTPException) as exc_info:
        dependencies.assert_training_module_access(user)

    assert exc_info.value.status_code == 403
