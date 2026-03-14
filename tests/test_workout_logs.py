import asyncio
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
import sys
import types

from fastapi import FastAPI
import httpx


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

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

from api.routers import workout_logs as workout_logs_router  # noqa: E402
from core.dependencies import get_current_user  # noqa: E402
from models.base import get_db  # noqa: E402
from models.mesocycle import DayExercise, Macrocycle, TrainingDay  # noqa: E402
from models.user import UserRole  # noqa: E402
from models.workout_log import WorkoutLog  # noqa: E402


class FakeQuery:
    def __init__(self, result):
        self.result = result

    def join(self, *args, **kwargs):
        return self

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def offset(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def first(self):
        return self.result

    def all(self):
        return self.result

    def scalar(self):
        return self.result


class StartWorkoutSession:
    def __init__(self):
        self.created_workout = None

    def query(self, model):
        if model is WorkoutLog:
            return FakeQuery(None)
        raise AssertionError(f"Unexpected model queried: {model}")

    def add(self, workout_log):
        self.created_workout = workout_log

    def commit(self):
        now = datetime(2026, 3, 14, 20, 30, 0)
        self.created_workout.id = 501
        self.created_workout.started_at = self.created_workout.started_at or now

    def refresh(self, workout_log):
        return None


class NextWorkoutSession:
    def __init__(self):
        self.macrocycle = SimpleNamespace(id=77)
        self.training_days = [
            SimpleNamespace(
                id=112,
                name="Torso - A",
                focus="Torso",
                day_number=1,
                rest_day=False,
            )
        ]

    def query(self, model):
        if model is Macrocycle:
            return FakeQuery(self.macrocycle)
        if model is TrainingDay:
            return FakeQuery(self.training_days)
        if model is WorkoutLog.training_day_id:
            return FakeQuery([])
        raise AssertionError(f"Unexpected model queried: {model}")


class LogSetSession:
    def __init__(self):
        self.created_set = None
        self.workout_log = SimpleNamespace(
            id=37,
            client_id=13,
            training_day_id=112,
            status="in_progress",
        )
        self.day_exercise = SimpleNamespace(
            id=28,
            training_day_id=112,
            exercise_id=205,
        )

    def query(self, model):
        if model is WorkoutLog:
            return FakeQuery(self.workout_log)
        if model is DayExercise:
            return FakeQuery(self.day_exercise)
        raise AssertionError(f"Unexpected model queried: {model}")

    def add(self, set_log):
        self.created_set = set_log

    def commit(self):
        self.created_set.id = 901

    def refresh(self, set_log):
        return None


def test_start_workout_accepts_string_training_day_id_and_returns_string_ids(monkeypatch) -> None:
    session = StartWorkoutSession()
    current_user = SimpleNamespace(id=13, is_active=True, role=UserRole.CLIENT)
    training_day = SimpleNamespace(id=112)

    def override_db():
        yield session

    app = FastAPI()
    app.include_router(workout_logs_router.router, prefix="/api/workout-logs")
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current_user
    monkeypatch.setattr(
        workout_logs_router,
        "verify_training_day_access",
        lambda db, training_day_id, user: training_day,
    )

    try:
        async def request():
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.post("/api/workout-logs", json={"training_day_id": "112"})

        response = asyncio.run(request())
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    payload = response.json()
    assert payload["id"] == "501"
    assert payload["client_id"] == "13"
    assert payload["training_day_id"] == "112"
    assert payload["status"] == "in_progress"
    assert payload["exercise_sets"] == []


def test_get_next_workout_serializes_training_day_id_as_string() -> None:
    session = NextWorkoutSession()
    current_user = SimpleNamespace(id=13, is_active=True, role=UserRole.CLIENT)

    def override_db():
        yield session

    app = FastAPI()
    app.include_router(workout_logs_router.router, prefix="/api/workout-logs")
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current_user

    try:
        async def request():
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.get("/api/workout-logs/next")

        response = asyncio.run(request())
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["training_day"]["id"] == "112"
    assert payload["training_day"]["name"] == "Torso - A"
    assert payload["position"] == 1
    assert payload["total"] == 1
    assert payload["all_completed"] is False


def test_log_exercise_set_derives_exercise_id_and_omits_series_notes() -> None:
    session = LogSetSession()
    current_user = SimpleNamespace(id=13, is_active=True, role=UserRole.CLIENT)

    def override_db():
        yield session

    app = FastAPI()
    app.include_router(workout_logs_router.router, prefix="/api/workout-logs")
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current_user

    try:
        async def request():
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.post(
                    "/api/workout-logs/37/sets",
                    json={
                        "day_exercise_id": "28",
                        "set_number": 1,
                        "reps_completed": 8,
                        "weight_kg": 20.0,
                    },
                )

        response = asyncio.run(request())
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert session.created_set.exercise_id == 205
    payload = response.json()
    assert payload["id"] == "901"
    assert payload["workout_log_id"] == "37"
    assert payload["day_exercise_id"] == "28"
    assert payload["weight_kg"] == 20.0
    assert payload["effort_value"] is None
    assert "notes" not in payload


def test_log_exercise_set_rejects_series_notes_in_payload() -> None:
    session = LogSetSession()
    current_user = SimpleNamespace(id=13, is_active=True, role=UserRole.CLIENT)

    def override_db():
        yield session

    app = FastAPI()
    app.include_router(workout_logs_router.router, prefix="/api/workout-logs")
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current_user

    try:
        async def request():
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.post(
                    "/api/workout-logs/37/sets",
                    json={
                        "day_exercise_id": "28",
                        "set_number": 1,
                        "reps_completed": 8,
                        "weight_kg": 20.0,
                        "notes": "No debe existir",
                    },
                )

        response = asyncio.run(request())
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["detail"][0]["type"] == "extra_forbidden"
