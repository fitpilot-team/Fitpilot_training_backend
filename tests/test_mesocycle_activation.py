import asyncio
from datetime import date, datetime, timezone
import os
from pathlib import Path
from types import SimpleNamespace
import sys
import types

from fastapi import FastAPI, HTTPException
import httpx


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://user:password@remote-db.example.com:5432/fitpilot?sslmode=require",
)
os.environ.setdefault("NUTRITION_JWT_SECRETS", "test-secret")

if "redis" not in sys.modules:
    redis_module = types.ModuleType("redis")

    class DummyRedis:
        @staticmethod
        def from_url(*args, **kwargs):
            return None

    redis_module.Redis = DummyRedis
    sys.modules["redis"] = redis_module

if "redis.exceptions" not in sys.modules:
    redis_exceptions = types.ModuleType("redis.exceptions")

    class RedisError(Exception):
        pass

    redis_exceptions.RedisError = RedisError
    sys.modules["redis.exceptions"] = redis_exceptions

from api.routers import mesocycles as mesocycles_router  # noqa: E402
from core.dependencies import get_current_user  # noqa: E402
from models.base import get_db  # noqa: E402
from models.mesocycle import IntensityLevel, MesocycleStatus  # noqa: E402
from schemas.mesocycle import MacrocycleCreate  # noqa: E402


UTC = timezone.utc


class CommitTrackingSession:
    def __init__(self):
        self.commit_calls = 0
        self.rollback_calls = 0

    def commit(self):
        self.commit_calls += 1

    def rollback(self):
        self.rollback_calls += 1


class CreateMacrocycleSession(CommitTrackingSession):
    def __init__(self):
        super().__init__()
        self.added = []
        self.refreshed = []
        self._next_id = 700

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        for obj in self.added:
            if getattr(obj, "id", None) is None:
                obj.id = self._next_id
                self._next_id += 1

    def refresh(self, obj):
        self.refreshed.append(obj)


def _dt(year: int, month: int, day: int) -> datetime:
    return datetime(year, month, day, 12, 0, tzinfo=UTC)


def _make_training_day(
    training_day_id: int,
    *,
    day_number: int,
    current_date: date,
    session_index: int,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=training_day_id,
        microcycle_id=401,
        day_number=day_number,
        date=current_date,
        session_index=session_index,
        session_label="AM" if session_index == 1 else "PM",
        name=f"Day {day_number}",
        focus="Upper Body",
        rest_day=False,
        notes=None,
        exercises=[],
        created_at=_dt(2026, 3, 18),
        updated_at=_dt(2026, 3, 18),
    )


def _make_microcycle(microcycle_id: int, *, start_date: date, end_date: date, training_days: list[SimpleNamespace]) -> SimpleNamespace:
    return SimpleNamespace(
        id=microcycle_id,
        mesocycle_id=301,
        week_number=1,
        name="Week 1",
        start_date=start_date,
        end_date=end_date,
        intensity_level=IntensityLevel.MEDIUM,
        notes=None,
        training_days=training_days,
        created_at=_dt(2026, 3, 18),
        updated_at=_dt(2026, 3, 18),
    )


def _make_mesocycle(mesocycle_id: int, *, start_date: date, end_date: date, microcycles: list[SimpleNamespace]) -> SimpleNamespace:
    return SimpleNamespace(
        id=mesocycle_id,
        macrocycle_id=77,
        block_number=1,
        name="Block 1",
        description=None,
        start_date=start_date,
        end_date=end_date,
        focus="Hypertrophy",
        notes=None,
        microcycles=microcycles,
        created_at=_dt(2026, 3, 18),
        updated_at=_dt(2026, 3, 18),
    )


def _make_macrocycle(
    macrocycle_id: int,
    *,
    client_id: int | None,
    status: MesocycleStatus,
    start_date: date,
    end_date: date,
    mesocycles: list[SimpleNamespace] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=macrocycle_id,
        name=f"Program {macrocycle_id}",
        description=None,
        objective="Hypertrophy",
        start_date=start_date,
        end_date=end_date,
        status=status,
        trainer_id=5,
        client_id=client_id,
        mesocycles=mesocycles or [],
        created_at=_dt(2026, 3, 18),
        updated_at=_dt(2026, 3, 18),
    )


def _build_app(session: CommitTrackingSession, current_user):
    def override_db():
        yield session

    app = FastAPI()
    app.include_router(mesocycles_router.router, prefix="/api/mesocycles")
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current_user
    return app


def _request(app: FastAPI, method: str, path: str):
    async def do_request():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.request(method, path)

    return asyncio.run(do_request())


def test_activate_macrocycle_reschedules_nested_dates_and_closes_previous_active_programs(monkeypatch) -> None:
    training_day_one = _make_training_day(501, day_number=1, current_date=date(2026, 3, 20), session_index=1)
    training_day_two = _make_training_day(502, day_number=1, current_date=date(2026, 3, 20), session_index=2)
    microcycle = _make_microcycle(
        401,
        start_date=date(2026, 3, 20),
        end_date=date(2026, 3, 26),
        training_days=[training_day_one, training_day_two],
    )
    mesocycle = _make_mesocycle(
        301,
        start_date=date(2026, 3, 20),
        end_date=date(2026, 3, 26),
        microcycles=[microcycle],
    )
    target_macrocycle = _make_macrocycle(
        77,
        client_id=33,
        status=MesocycleStatus.DRAFT,
        start_date=date(2026, 3, 20),
        end_date=date(2026, 4, 16),
        mesocycles=[mesocycle],
    )
    archived_macrocycle = _make_macrocycle(
        88,
        client_id=33,
        status=MesocycleStatus.ACTIVE,
        start_date=date(2026, 3, 1),
        end_date=date(2026, 4, 2),
    )
    completed_macrocycle = _make_macrocycle(
        89,
        client_id=33,
        status=MesocycleStatus.ACTIVE,
        start_date=date(2026, 2, 1),
        end_date=date(2026, 3, 10),
    )
    session = CommitTrackingSession()
    current_user = SimpleNamespace(id=5, role="trainer", is_active=True)
    app = _build_app(session, current_user)

    monkeypatch.setattr(
        mesocycles_router,
        "_get_macrocycle_with_nested_data",
        lambda db, macrocycle_id: target_macrocycle if macrocycle_id == 77 else None,
    )
    monkeypatch.setattr(
        mesocycles_router,
        "_load_other_active_macrocycles",
        lambda db, client_id, exclude_macrocycle_id: [archived_macrocycle, completed_macrocycle],
    )
    monkeypatch.setattr(mesocycles_router, "_check_trainer_access", lambda macrocycle, user: None)
    monkeypatch.setattr(mesocycles_router, "_today", lambda: date(2026, 3, 26))

    try:
        response = _request(app, "POST", "/api/mesocycles/77/activate")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["effective_start_date"] == "2026-03-26"
    assert payload["shifted_training_day_count"] == 2
    assert payload["archived_macrocycle_ids"] == ["88"]
    assert payload["completed_macrocycle_ids"] == ["89"]
    assert payload["macrocycle"]["id"] == "77"
    assert payload["macrocycle"]["status"] == "active"
    assert payload["macrocycle"]["start_date"] == "2026-03-26"
    assert payload["macrocycle"]["mesocycles"][0]["microcycles"][0]["training_days"][0]["date"] == "2026-03-26"
    assert payload["macrocycle"]["mesocycles"][0]["microcycles"][0]["training_days"][1]["session_index"] == 2

    assert target_macrocycle.status == MesocycleStatus.ACTIVE
    assert target_macrocycle.start_date == date(2026, 3, 26)
    assert target_macrocycle.end_date == date(2026, 4, 22)
    assert microcycle.start_date == date(2026, 3, 26)
    assert microcycle.end_date == date(2026, 4, 1)
    assert training_day_one.date == date(2026, 3, 26)
    assert training_day_two.date == date(2026, 3, 26)
    assert training_day_one.day_number == 1
    assert training_day_two.session_index == 2
    assert archived_macrocycle.status == MesocycleStatus.ARCHIVED
    assert completed_macrocycle.status == MesocycleStatus.COMPLETED
    assert session.commit_calls == 1
    assert session.rollback_calls == 0


def test_activate_macrocycle_returns_404_when_macrocycle_does_not_exist(monkeypatch) -> None:
    session = CommitTrackingSession()
    current_user = SimpleNamespace(id=5, role="trainer", is_active=True)
    app = _build_app(session, current_user)

    monkeypatch.setattr(mesocycles_router, "_get_macrocycle_with_nested_data", lambda db, macrocycle_id: None)

    try:
        response = _request(app, "POST", "/api/mesocycles/999/activate")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json()["detail"] == "Macrocycle with id 999 not found"


def test_activate_macrocycle_rejects_templates(monkeypatch) -> None:
    target_macrocycle = _make_macrocycle(
        77,
        client_id=None,
        status=MesocycleStatus.DRAFT,
        start_date=date(2026, 3, 20),
        end_date=date(2026, 4, 16),
    )
    session = CommitTrackingSession()
    current_user = SimpleNamespace(id=5, role="trainer", is_active=True)
    app = _build_app(session, current_user)

    monkeypatch.setattr(
        mesocycles_router,
        "_get_macrocycle_with_nested_data",
        lambda db, macrocycle_id: target_macrocycle,
    )
    monkeypatch.setattr(mesocycles_router, "_check_trainer_access", lambda macrocycle, user: None)

    try:
        response = _request(app, "POST", "/api/mesocycles/77/activate")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json()["detail"] == "Templates cannot be activated"


def test_activate_macrocycle_rejects_already_active_programs(monkeypatch) -> None:
    target_macrocycle = _make_macrocycle(
        77,
        client_id=33,
        status=MesocycleStatus.ACTIVE,
        start_date=date(2026, 3, 20),
        end_date=date(2026, 4, 16),
    )
    session = CommitTrackingSession()
    current_user = SimpleNamespace(id=5, role="trainer", is_active=True)
    app = _build_app(session, current_user)

    monkeypatch.setattr(
        mesocycles_router,
        "_get_macrocycle_with_nested_data",
        lambda db, macrocycle_id: target_macrocycle,
    )
    monkeypatch.setattr(mesocycles_router, "_check_trainer_access", lambda macrocycle, user: None)

    try:
        response = _request(app, "POST", "/api/mesocycles/77/activate")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert response.json()["detail"] == "Macrocycle is already active"


def test_activate_macrocycle_propagates_forbidden_access(monkeypatch) -> None:
    target_macrocycle = _make_macrocycle(
        77,
        client_id=33,
        status=MesocycleStatus.DRAFT,
        start_date=date(2026, 3, 20),
        end_date=date(2026, 4, 16),
    )
    session = CommitTrackingSession()
    current_user = SimpleNamespace(id=99, role="trainer", is_active=True)
    app = _build_app(session, current_user)

    monkeypatch.setattr(
        mesocycles_router,
        "_get_macrocycle_with_nested_data",
        lambda db, macrocycle_id: target_macrocycle,
    )
    monkeypatch.setattr(
        mesocycles_router,
        "_check_trainer_access",
        lambda macrocycle, user: (_ for _ in ()).throw(
            HTTPException(status_code=403, detail="Not authorized to modify this macrocycle")
        ),
    )

    try:
        response = _request(app, "POST", "/api/mesocycles/77/activate")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"] == "Not authorized to modify this macrocycle"


def test_create_macrocycle_dispatches_assignment_notification(monkeypatch) -> None:
    session = CreateMacrocycleSession()
    current_user = SimpleNamespace(id=5, role="trainer", is_active=True)
    dispatched = {}

    monkeypatch.setattr(
        mesocycles_router,
        "assert_training_professional_access",
        lambda user: None,
    )
    monkeypatch.setattr(
        mesocycles_router,
        "send_assignment_notification_sync",
        lambda **kwargs: dispatched.update(kwargs),
    )

    payload = MacrocycleCreate(
        name="Programa base",
        description="Bloque inicial",
        objective="hypertrophy",
        start_date=date(2026, 4, 1),
        end_date=date(2026, 4, 28),
        client_id=33,
        notify_client=True,
        assignment_kind="manual_create",
        mesocycles=[],
    )

    response = mesocycles_router.create_macrocycle(
        payload,
        request=SimpleNamespace(headers={"Authorization": "Bearer training-token"}),
        db=session,
        current_user=current_user,
    )

    assert response.client_id == 33
    assert session.commit_calls == 1
    assert dispatched == {
        "authorization": "Bearer training-token",
        "client_id": 33,
        "domain": "training",
        "entity_id": 700,
        "entity_name": "Programa base",
        "assignment_kind": "manual_create",
        "start_date": "2026-04-01",
        "end_date": "2026-04-28",
    }


def test_create_macrocycle_skips_assignment_notification_without_opt_in(monkeypatch) -> None:
    session = CreateMacrocycleSession()
    current_user = SimpleNamespace(id=5, role="trainer", is_active=True)
    dispatched = {"called": False}

    monkeypatch.setattr(
        mesocycles_router,
        "assert_training_professional_access",
        lambda user: None,
    )
    monkeypatch.setattr(
        mesocycles_router,
        "send_assignment_notification_sync",
        lambda **kwargs: dispatched.__setitem__("called", True),
    )

    payload = MacrocycleCreate(
        name="Programa plantilla",
        description=None,
        objective="strength",
        start_date=date(2026, 4, 1),
        end_date=date(2026, 4, 28),
        client_id=33,
        notify_client=False,
        mesocycles=[],
    )

    mesocycles_router.create_macrocycle(
        payload,
        request=SimpleNamespace(headers={"Authorization": "Bearer training-token"}),
        db=session,
        current_user=current_user,
    )

    assert session.commit_calls == 1
    assert dispatched["called"] is False
