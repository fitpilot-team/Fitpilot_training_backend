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
        if isinstance(self.result, list):
            return self.result[0] if self.result else None
        return self.result

    def all(self):
        if self.result is None:
            return []
        if isinstance(self.result, list):
            return self.result
        return [self.result]

    def scalar(self):
        return self.result


class FakeExecuteResult:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class StartWorkoutSession:
    def __init__(self):
        self.created_workout = None

    def execute(self, *_args, **_kwargs):
        return FakeExecuteResult([("segment_index",)])

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

    def execute(self, *_args, **_kwargs):
        return FakeExecuteResult([("segment_index",)])

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
        self.created_sets = []
        self.deleted_sets = []
        self.existing_sets = []
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

    def execute(self, *_args, **_kwargs):
        return FakeExecuteResult([("segment_index",)])

    def query(self, model):
        if model is WorkoutLog:
            return FakeQuery(self.workout_log)
        if model is DayExercise:
            return FakeQuery(self.day_exercise)
        if model is workout_logs_router.ExerciseSetLog:
            return FakeQuery(self.existing_sets)
        raise AssertionError(f"Unexpected model queried: {model}")

    def add(self, set_log):
        self.created_sets.append(set_log)

    def delete(self, set_log):
        self.deleted_sets.append(set_log)

    def commit(self):
        for index, set_log in enumerate(self.created_sets, start=1):
            set_log.id = 900 + index

    def refresh(self, set_log):
        return None


class SchemaMismatchSession:
    def execute(self, *_args, **_kwargs):
        return FakeExecuteResult([])

    def query(self, _model):
        raise AssertionError("Schema compatibility check should block before querying workout data")


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
    assert len(session.created_sets) == 1
    assert session.created_sets[0].exercise_id == 205
    payload = response.json()
    assert payload["day_exercise_id"] == "28"
    assert payload["set_number"] == 1
    assert payload["segment_count"] == 1
    assert payload["best_weight_kg"] == 20.0
    assert payload["total_reps_completed"] == 8
    assert len(payload["segments"]) == 1
    assert payload["segments"][0]["id"] == "901"
    assert payload["segments"][0]["workout_log_id"] == "37"
    assert payload["segments"][0]["weight_kg"] == 20.0
    assert payload["segments"][0]["effort_value"] is None


def test_log_exercise_set_accepts_segmented_payload_and_replaces_existing_group() -> None:
    session = LogSetSession()
    session.existing_sets = [
        SimpleNamespace(id=701, workout_log_id=37, day_exercise_id=28, set_number=1, segment_index=1),
        SimpleNamespace(id=702, workout_log_id=37, day_exercise_id=28, set_number=1, segment_index=2),
    ]
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
                        "segments": [
                            {
                                "segment_index": 1,
                                "reps_completed": 10,
                                "weight_kg": 40.0,
                            },
                            {
                                "segment_index": 2,
                                "reps_completed": 8,
                                "weight_kg": 32.5,
                            },
                        ],
                    },
                )

        response = asyncio.run(request())
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert [set_log.id for set_log in session.deleted_sets] == [701, 702]
    assert len(session.created_sets) == 2
    assert [set_log.segment_index for set_log in session.created_sets] == [1, 2]

    payload = response.json()
    assert payload["segment_count"] == 2
    assert payload["total_reps_completed"] == 18
    assert payload["best_weight_kg"] == 40.0
    assert [segment["segment_index"] for segment in payload["segments"]] == [1, 2]


def test_delete_exercise_set_group_removes_all_segments() -> None:
    session = LogSetSession()
    session.existing_sets = [
        SimpleNamespace(id=701, workout_log_id=37, day_exercise_id=28, set_number=1, segment_index=1),
        SimpleNamespace(id=702, workout_log_id=37, day_exercise_id=28, set_number=1, segment_index=2),
    ]
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
                return await client.delete("/api/workout-logs/37/day-exercises/28/sets/1")

        response = asyncio.run(request())
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 204
    assert [set_log.id for set_log in session.deleted_sets] == [701, 702]


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


def test_log_exercise_set_returns_actionable_error_when_segment_index_column_is_missing() -> None:
    session = SchemaMismatchSession()
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
                        "segments": [
                            {
                                "segment_index": 1,
                                "reps_completed": 8,
                                "weight_kg": 20.0,
                            }
                        ],
                    },
                )

        response = asyncio.run(request())
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert "segment_index" in response.json()["detail"]
    assert "upgrade_training_schema_shared_db.py --apply" in response.json()["detail"]


def test_build_current_workout_state_groups_segments_per_set_number() -> None:
    training_day = SimpleNamespace(
        id=112,
        microcycle_id=9,
        day_number=1,
        name="Torso - A",
        focus="Torso",
        date=datetime(2026, 3, 14).date(),
        session_index=1,
        session_label=None,
        rest_day=False,
        notes=None,
        created_at=datetime(2026, 3, 1, 8, 0, 0),
        updated_at=datetime(2026, 3, 1, 8, 0, 0),
        exercises=[
            SimpleNamespace(
                id=28,
                training_day_id=112,
                exercise_id=205,
                sets=3,
                order_index=0,
                phase="main",
                reps_min=8,
                reps_max=12,
                rest_seconds=90,
                effort_type="RIR",
                effort_value=2.0,
                tempo="standard",
                set_type="drop_set",
                duration_seconds=None,
                intensity_zone=None,
                distance_meters=None,
                target_calories=None,
                intervals=None,
                work_seconds=None,
                interval_rest_seconds=None,
                notes=None,
                created_at=datetime(2026, 3, 1, 8, 0, 0),
                updated_at=datetime(2026, 3, 1, 8, 0, 0),
                exercise=SimpleNamespace(
                    id=205,
                    name_es="Press inclinado",
                    name_en="Incline Press",
                    type="multiarticular",
                    resistance_profile="flat",
                    category="chest",
                    video_url=None,
                    thumbnail_url=None,
                    image_url=None,
                    anatomy_image_url=None,
                    equipment_needed=None,
                    difficulty_level=None,
                    primary_muscles=[],
                    secondary_muscles=[],
                    created_at=datetime(2026, 3, 1, 8, 0, 0),
                    updated_at=datetime(2026, 3, 1, 8, 0, 0),
                    exercise_class="strength",
                    cardio_subclass=None,
                    intensity_zone=None,
                    target_heart_rate_min=None,
                    target_heart_rate_max=None,
                    calories_per_minute=None,
                    description_es=None,
                    description_en=None,
                ),
            )
        ],
    )
    workout_log = SimpleNamespace(
        id=37,
        client_id=13,
        training_day_id=112,
        training_day=training_day,
        performed_on_date=datetime(2026, 3, 14).date(),
        started_at=datetime(2026, 3, 14, 8, 0, 0),
        completed_at=None,
        is_authoritative=True,
        status="in_progress",
        exercise_sets=[
            SimpleNamespace(
                id=801,
                workout_log_id=37,
                day_exercise_id=28,
                set_number=1,
                segment_index=1,
                reps_completed=10,
                weight_kg=30.0,
                effort_value=2.0,
                completed_at=datetime(2026, 3, 14, 8, 10, 0),
            ),
            SimpleNamespace(
                id=802,
                workout_log_id=37,
                day_exercise_id=28,
                set_number=1,
                segment_index=2,
                reps_completed=8,
                weight_kg=25.0,
                effort_value=1.0,
                completed_at=datetime(2026, 3, 14, 8, 11, 0),
            ),
            SimpleNamespace(
                id=803,
                workout_log_id=37,
                day_exercise_id=28,
                set_number=2,
                segment_index=1,
                reps_completed=9,
                weight_kg=32.5,
                effort_value=2.0,
                completed_at=datetime(2026, 3, 14, 8, 20, 0),
            ),
        ],
    )

    state = workout_logs_router.build_current_workout_state(workout_log)

    assert state.completed_exercises == 0
    assert state.exercises_progress[0].completed_sets == 2
    assert len(state.exercises_progress[0].sets_data) == 2
    assert state.exercises_progress[0].sets_data[0].segment_count == 2
    assert state.exercises_progress[0].sets_data[0].total_reps_completed == 18
    assert state.exercises_progress[0].sets_data[0].best_weight_kg == 30.0
    assert [segment.segment_index for segment in state.exercises_progress[0].sets_data[0].segments] == [1, 2]


def test_build_current_workout_state_marks_exercise_completed_when_final_contiguous_set_is_logged() -> None:
    training_day = SimpleNamespace(
        id=112,
        microcycle_id=9,
        day_number=1,
        name="Torso - A",
        focus="Torso",
        date=datetime(2026, 3, 14).date(),
        session_index=1,
        session_label=None,
        rest_day=False,
        notes=None,
        created_at=datetime(2026, 3, 1, 8, 0, 0),
        updated_at=datetime(2026, 3, 1, 8, 0, 0),
        exercises=[
            SimpleNamespace(
                id=28,
                training_day_id=112,
                exercise_id=205,
                sets=2,
                order_index=0,
                phase="main",
                reps_min=8,
                reps_max=12,
                rest_seconds=90,
                effort_type="RIR",
                effort_value=2.0,
                tempo="standard",
                set_type="straight",
                duration_seconds=None,
                intensity_zone=None,
                distance_meters=None,
                target_calories=None,
                intervals=None,
                work_seconds=None,
                interval_rest_seconds=None,
                notes=None,
                created_at=datetime(2026, 3, 1, 8, 0, 0),
                updated_at=datetime(2026, 3, 1, 8, 0, 0),
                exercise=SimpleNamespace(
                    id=205,
                    name_es="Press inclinado",
                    name_en="Incline Press",
                    type="multiarticular",
                    resistance_profile="flat",
                    category="chest",
                    video_url=None,
                    thumbnail_url=None,
                    image_url=None,
                    anatomy_image_url=None,
                    equipment_needed=None,
                    difficulty_level=None,
                    primary_muscles=[],
                    secondary_muscles=[],
                    created_at=datetime(2026, 3, 1, 8, 0, 0),
                    updated_at=datetime(2026, 3, 1, 8, 0, 0),
                    exercise_class="strength",
                    cardio_subclass=None,
                    intensity_zone=None,
                    target_heart_rate_min=None,
                    target_heart_rate_max=None,
                    calories_per_minute=None,
                    description_es=None,
                    description_en=None,
                ),
            )
        ],
    )
    workout_log = SimpleNamespace(
        id=37,
        client_id=13,
        training_day_id=112,
        training_day=training_day,
        performed_on_date=datetime(2026, 3, 14).date(),
        started_at=datetime(2026, 3, 14, 8, 0, 0),
        completed_at=None,
        is_authoritative=True,
        status="in_progress",
        exercise_sets=[
            SimpleNamespace(
                id=801,
                workout_log_id=37,
                day_exercise_id=28,
                set_number=1,
                segment_index=1,
                reps_completed=10,
                weight_kg=30.0,
                effort_value=2.0,
                completed_at=datetime(2026, 3, 14, 8, 10, 0),
            ),
            SimpleNamespace(
                id=802,
                workout_log_id=37,
                day_exercise_id=28,
                set_number=2,
                segment_index=1,
                reps_completed=9,
                weight_kg=32.5,
                effort_value=1.5,
                completed_at=datetime(2026, 3, 14, 8, 20, 0),
            ),
        ],
    )

    state = workout_logs_router.build_current_workout_state(workout_log)

    assert state.completed_exercises == 1
    assert state.exercises_progress[0].completed_sets == 2
    assert state.exercises_progress[0].is_completed is True
