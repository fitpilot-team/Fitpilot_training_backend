import asyncio
from datetime import date, datetime, timezone
import os
from pathlib import Path
from types import SimpleNamespace
import sys
import types

from fastapi import FastAPI, HTTPException
import httpx
from sqlalchemy import Enum as SqlAlchemyEnum


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
from models.mesocycle import (  # noqa: E402
    DayExercise,
    EffortType,
    ExercisePhase,
    IntensityLevel,
    Macrocycle,
    Mesocycle,
    MesocycleStatus,
    Microcycle,
    TrainingDay,
)


UTC = timezone.utc


class DuplicationSession:
    def __init__(self, macrocycle: Macrocycle):
        self.macrocycle = macrocycle
        self.commit_calls = 0
        self.rollback_calls = 0
        self._next_microcycle_id = 900
        self._next_training_day_id = 1200
        self._next_day_exercise_id = 1500
        self._reindex()

    def _reindex(self) -> None:
        self.mesocycles_by_id = {
            mesocycle.id: mesocycle
            for mesocycle in self.macrocycle.mesocycles or []
        }
        self.microcycles_by_id = {}
        self.training_days_by_id = {}

        for mesocycle in self.macrocycle.mesocycles or []:
            for microcycle in mesocycle.microcycles or []:
                self.microcycles_by_id[microcycle.id] = microcycle
                for training_day in microcycle.training_days or []:
                    self.training_days_by_id[training_day.id] = training_day

    def add(self, obj):
        if isinstance(obj, Microcycle):
            if obj.id is None:
                obj.id = self._next_microcycle_id
                self._next_microcycle_id += 1
            obj.training_days = list(obj.training_days or [])
            obj.created_at = obj.created_at or _dt(2026, 3, 26)
            obj.updated_at = obj.updated_at or _dt(2026, 3, 26)
            self.mesocycles_by_id[obj.mesocycle_id].microcycles.append(obj)
        elif isinstance(obj, TrainingDay):
            if obj.id is None:
                obj.id = self._next_training_day_id
                self._next_training_day_id += 1
            obj.exercises = list(obj.exercises or [])
            obj.created_at = obj.created_at or _dt(2026, 3, 26)
            obj.updated_at = obj.updated_at or _dt(2026, 3, 26)
            self.microcycles_by_id[obj.microcycle_id].training_days.append(obj)
        elif isinstance(obj, DayExercise):
            if obj.id is None:
                obj.id = self._next_day_exercise_id
                self._next_day_exercise_id += 1
            obj.created_at = obj.created_at or _dt(2026, 3, 26)
            obj.updated_at = obj.updated_at or _dt(2026, 3, 26)
            self.training_days_by_id[obj.training_day_id].exercises.append(obj)

        self._reindex()

    def flush(self):
        return None

    def commit(self):
        self.commit_calls += 1

    def rollback(self):
        self.rollback_calls += 1

    def refresh(self, obj):
        return obj

    def query(self, model):
        return _QueryStub(self, model)


class _QueryStub:
    def __init__(self, session: DuplicationSession, model):
        self.session = session
        self.model = model

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        if self.model is Macrocycle:
            return self.session.macrocycle
        return None


def _dt(year: int, month: int, day: int) -> datetime:
    return datetime(year, month, day, 12, 0, tzinfo=UTC)


def _make_day_exercise(day_exercise_id: int, training_day_id: int, order_index: int) -> DayExercise:
    return DayExercise(
        id=day_exercise_id,
        training_day_id=training_day_id,
        exercise_id=20 + order_index,
        order_index=order_index,
        phase=ExercisePhase.MAIN.value,
        sets=4,
        reps_min=8,
        reps_max=10,
        rest_seconds=90,
        effort_type=EffortType.RIR,
        effort_value=2.0,
        tempo="3-1-1-0",
        set_type="straight",
        duration_seconds=None,
        intensity_zone=None,
        distance_meters=None,
        target_calories=None,
        intervals=None,
        work_seconds=None,
        interval_rest_seconds=None,
        notes="Keep it strict",
        created_at=_dt(2026, 3, 18),
        updated_at=_dt(2026, 3, 18),
        rpe_target=None,
    )


def _make_training_day(
    training_day_id: int,
    microcycle_id: int,
    current_date: date,
    day_number: int,
    session_index: int,
    exercise_order_indexes: tuple[int, ...] = (1,),
) -> TrainingDay:
    training_day = TrainingDay(
        id=training_day_id,
        microcycle_id=microcycle_id,
        day_number=day_number,
        date=current_date,
        session_index=session_index,
        session_label="AM" if session_index == 1 else "PM",
        name=f"Day {day_number}",
        focus="Torso",
        rest_day=False,
        notes="Primary session",
        created_at=_dt(2026, 3, 18),
        updated_at=_dt(2026, 3, 18),
    )
    training_day.exercises = [
        _make_day_exercise(training_day_id * 10 + order_index, training_day_id, order_index)
        for order_index in exercise_order_indexes
    ]
    return training_day


def _make_microcycle(
    microcycle_id: int,
    mesocycle_id: int,
    week_number: int,
    start_date: date,
    end_date: date,
    training_days: list[TrainingDay],
) -> Microcycle:
    microcycle = Microcycle(
        id=microcycle_id,
        mesocycle_id=mesocycle_id,
        week_number=week_number,
        name=f"Week {week_number}",
        start_date=start_date,
        end_date=end_date,
        intensity_level=IntensityLevel.MEDIUM,
        notes="Notes",
        created_at=_dt(2026, 3, 18),
        updated_at=_dt(2026, 3, 18),
    )
    microcycle.training_days = training_days
    return microcycle


def _make_mesocycle(
    mesocycle_id: int,
    macrocycle_id: int,
    block_number: int,
    start_date: date,
    end_date: date,
    microcycles: list[Microcycle],
) -> Mesocycle:
    mesocycle = Mesocycle(
        id=mesocycle_id,
        macrocycle_id=macrocycle_id,
        block_number=block_number,
        name=f"Block {block_number}",
        description=None,
        start_date=start_date,
        end_date=end_date,
        focus="Hypertrophy",
        notes=None,
        created_at=_dt(2026, 3, 18),
        updated_at=_dt(2026, 3, 18),
    )
    mesocycle.microcycles = microcycles
    return mesocycle


def _make_macrocycle(mesocycles: list[Mesocycle]) -> Macrocycle:
    macrocycle = Macrocycle(
        id=77,
        name="Program 77",
        description=None,
        objective="Hypertrophy",
        start_date=date(2026, 3, 3),
        end_date=date(2026, 3, 30),
        status=MesocycleStatus.DRAFT,
        trainer_id=5,
        client_id=33,
        created_at=_dt(2026, 3, 18),
        updated_at=_dt(2026, 3, 18),
    )
    macrocycle.mesocycles = mesocycles
    return macrocycle


def _build_macrocycle_tree() -> Macrocycle:
    original_day_one = _make_training_day(501, 401, date(2026, 3, 3), 1, 1, (1, 2))
    original_day_two = _make_training_day(502, 401, date(2026, 3, 3), 1, 2, (1,))
    original_day_three = _make_training_day(503, 401, date(2026, 3, 5), 3, 1, (1,))
    original_microcycle = _make_microcycle(
        401,
        301,
        1,
        date(2026, 3, 3),
        date(2026, 3, 9),
        [original_day_one, original_day_two, original_day_three],
    )

    downstream_same_block_day = _make_training_day(601, 402, date(2026, 3, 10), 1, 1, (1,))
    downstream_same_block_microcycle = _make_microcycle(
        402,
        301,
        2,
        date(2026, 3, 10),
        date(2026, 3, 16),
        [downstream_same_block_day],
    )

    downstream_next_block_day = _make_training_day(701, 403, date(2026, 3, 17), 1, 1, (1,))
    downstream_next_block_microcycle = _make_microcycle(
        403,
        302,
        1,
        date(2026, 3, 17),
        date(2026, 3, 23),
        [downstream_next_block_day],
    )

    first_mesocycle = _make_mesocycle(
        301,
        77,
        1,
        date(2026, 3, 3),
        date(2026, 3, 16),
        [original_microcycle, downstream_same_block_microcycle],
    )
    second_mesocycle = _make_mesocycle(
        302,
        77,
        2,
        date(2026, 3, 17),
        date(2026, 3, 23),
        [downstream_next_block_microcycle],
    )
    return _make_macrocycle([first_mesocycle, second_mesocycle])


def _build_last_microcycle_macrocycle() -> Macrocycle:
    last_day = _make_training_day(801, 404, date(2026, 4, 1), 1, 1, (1,))
    last_microcycle = _make_microcycle(
        404,
        303,
        2,
        date(2026, 4, 1),
        date(2026, 4, 7),
        [last_day],
    )
    mesocycle = _make_mesocycle(
        303,
        77,
        1,
        date(2026, 3, 25),
        date(2026, 4, 7),
        [last_microcycle],
    )
    macrocycle = _make_macrocycle([mesocycle])
    macrocycle.start_date = date(2026, 3, 25)
    macrocycle.end_date = date(2026, 4, 7)
    return macrocycle


def _build_app(session: DuplicationSession, current_user):
    def override_db():
        yield session

    app = FastAPI()
    app.include_router(mesocycles_router.router, prefix="/api/mesocycles")
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current_user
    return app


def _request(app: FastAPI, method: str, path: str, **kwargs):
    async def do_request():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.request(method, path, **kwargs)

    return asyncio.run(do_request())


def test_day_exercise_phase_column_uses_native_postgres_enum() -> None:
    phase_type = DayExercise.__table__.c.phase.type

    assert isinstance(phase_type, SqlAlchemyEnum)
    assert phase_type.native_enum is True
    assert phase_type.name == "exercise_phase"
    assert phase_type.schema == "training"


def test_create_microcycle_persists_canonical_name_and_normalizes_existing_names(monkeypatch) -> None:
    macrocycle = _build_macrocycle_tree()
    session = DuplicationSession(macrocycle)
    current_user = SimpleNamespace(id=5, role="trainer", is_active=True)
    app = _build_app(session, current_user)
    mesocycle = session.mesocycles_by_id[301]
    mesocycle.microcycles[0].name = "Semana de Base"
    mesocycle.microcycles[1].name = "Personalizado"

    monkeypatch.setattr(
        mesocycles_router,
        "_get_mesocycle_or_404",
        lambda db, macrocycle_id, mesocycle_id: mesocycle if macrocycle_id == 77 and mesocycle_id == 301 else None,
    )
    monkeypatch.setattr(mesocycles_router, "_check_trainer_access", lambda macrocycle, user: None)

    try:
        response = _request(
            app,
            "POST",
            "/api/mesocycles/77/mesocycles/301/microcycles",
            json={
                "week_number": 3,
                "name": "Mi nombre libre",
                "start_date": "2026-03-17",
                "end_date": "2026-03-23",
                "intensity_level": "medium",
                "notes": "Notas",
                "training_days": [],
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    payload = response.json()
    created_microcycle = session.microcycles_by_id[int(payload["id"])]

    assert payload["name"] == "Microciclo 3"
    assert payload["week_number"] == 3
    assert created_microcycle.name == "Microciclo 3"
    assert session.microcycles_by_id[401].name == "Microciclo 1"
    assert session.microcycles_by_id[402].name == "Microciclo 2"
    assert session.commit_calls == 1
    assert session.rollback_calls == 0


def test_duplicate_microcycle_copies_nested_content_and_shifts_downstream_schedule(monkeypatch) -> None:
    macrocycle = _build_macrocycle_tree()
    session = DuplicationSession(macrocycle)
    current_user = SimpleNamespace(id=5, role="trainer", is_active=True)
    app = _build_app(session, current_user)

    monkeypatch.setattr(
        mesocycles_router,
        "_get_macrocycle_with_nested_data",
        lambda db, macrocycle_id: macrocycle if macrocycle_id == 77 else None,
    )
    monkeypatch.setattr(mesocycles_router, "_check_trainer_access", lambda macrocycle, user: None)
    monkeypatch.setattr(
        mesocycles_router,
        "_get_microcycle_with_nested_data",
        lambda db, mesocycle_id, microcycle_id: session.microcycles_by_id.get(microcycle_id),
    )

    try:
        response = _request(app, "POST", "/api/mesocycles/77/mesocycles/301/microcycles/401/duplicate")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    payload = response.json()

    cloned_microcycle = session.microcycles_by_id[int(payload["id"])]
    downstream_same_block_microcycle = session.microcycles_by_id[402]
    downstream_next_block_microcycle = session.microcycles_by_id[403]
    first_mesocycle = session.mesocycles_by_id[301]
    second_mesocycle = session.mesocycles_by_id[302]

    assert payload["name"] == "Microciclo 2"
    assert payload["week_number"] == 2
    assert payload["start_date"] == "2026-03-10"
    assert payload["end_date"] == "2026-03-16"
    assert len(payload["training_days"]) == 3
    assert payload["training_days"][0]["day_number"] == 1
    assert payload["training_days"][1]["session_index"] == 2
    assert payload["training_days"][0]["date"] == "2026-03-10"
    assert payload["training_days"][0]["exercises"][0]["order_index"] == 1
    assert payload["training_days"][0]["exercises"][1]["order_index"] == 2

    assert cloned_microcycle.week_number == 2
    assert cloned_microcycle.name == "Microciclo 2"
    assert cloned_microcycle.start_date == date(2026, 3, 10)
    assert cloned_microcycle.end_date == date(2026, 3, 16)
    assert cloned_microcycle.training_days[0].date == date(2026, 3, 10)
    assert cloned_microcycle.training_days[1].session_index == 2
    assert cloned_microcycle.training_days[0].exercises[0].exercise_id == 21

    assert downstream_same_block_microcycle.week_number == 3
    assert downstream_same_block_microcycle.name == "Microciclo 3"
    assert downstream_same_block_microcycle.start_date == date(2026, 3, 17)
    assert downstream_same_block_microcycle.end_date == date(2026, 3, 23)
    assert downstream_same_block_microcycle.training_days[0].date == date(2026, 3, 17)

    assert second_mesocycle.start_date == date(2026, 3, 24)
    assert second_mesocycle.end_date == date(2026, 3, 30)
    assert downstream_next_block_microcycle.start_date == date(2026, 3, 24)
    assert downstream_next_block_microcycle.end_date == date(2026, 3, 30)
    assert downstream_next_block_microcycle.training_days[0].date == date(2026, 3, 24)

    assert first_mesocycle.end_date == date(2026, 3, 23)
    assert macrocycle.end_date == date(2026, 4, 6)
    assert session.commit_calls == 1
    assert session.rollback_calls == 0


def test_duplicate_last_microcycle_creates_shifted_copy_without_other_schedule_changes(monkeypatch) -> None:
    macrocycle = _build_last_microcycle_macrocycle()
    session = DuplicationSession(macrocycle)
    current_user = SimpleNamespace(id=5, role="trainer", is_active=True)
    app = _build_app(session, current_user)

    monkeypatch.setattr(
        mesocycles_router,
        "_get_macrocycle_with_nested_data",
        lambda db, macrocycle_id: macrocycle if macrocycle_id == 77 else None,
    )
    monkeypatch.setattr(mesocycles_router, "_check_trainer_access", lambda macrocycle, user: None)
    monkeypatch.setattr(
        mesocycles_router,
        "_get_microcycle_with_nested_data",
        lambda db, mesocycle_id, microcycle_id: session.microcycles_by_id.get(microcycle_id),
    )

    try:
        response = _request(app, "POST", "/api/mesocycles/77/mesocycles/303/microcycles/404/duplicate")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    payload = response.json()
    assert payload["name"] == "Microciclo 3"
    assert payload["week_number"] == 3
    assert payload["start_date"] == "2026-04-08"
    assert payload["training_days"][0]["date"] == "2026-04-08"
    assert macrocycle.end_date == date(2026, 4, 14)
    assert session.commit_calls == 1


def test_duplicate_microcycle_returns_404_when_macrocycle_does_not_exist(monkeypatch) -> None:
    macrocycle = _build_macrocycle_tree()
    session = DuplicationSession(macrocycle)
    current_user = SimpleNamespace(id=5, role="trainer", is_active=True)
    app = _build_app(session, current_user)

    monkeypatch.setattr(
        mesocycles_router,
        "_get_macrocycle_with_nested_data",
        lambda db, macrocycle_id: None,
    )

    try:
        response = _request(app, "POST", "/api/mesocycles/77/mesocycles/301/microcycles/401/duplicate")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json()["detail"] == "Macrocycle with id 77 not found"


def test_duplicate_microcycle_propagates_forbidden_access(monkeypatch) -> None:
    macrocycle = _build_macrocycle_tree()
    session = DuplicationSession(macrocycle)
    current_user = SimpleNamespace(id=99, role="trainer", is_active=True)
    app = _build_app(session, current_user)

    monkeypatch.setattr(
        mesocycles_router,
        "_get_macrocycle_with_nested_data",
        lambda db, macrocycle_id: macrocycle,
    )
    monkeypatch.setattr(
        mesocycles_router,
        "_check_trainer_access",
        lambda macrocycle, user: (_ for _ in ()).throw(
            HTTPException(status_code=403, detail="Not authorized to modify this macrocycle")
        ),
    )

    try:
        response = _request(app, "POST", "/api/mesocycles/77/mesocycles/301/microcycles/401/duplicate")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"] == "Not authorized to modify this macrocycle"
