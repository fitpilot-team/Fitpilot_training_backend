import asyncio
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

from api.routers import training_days as training_days_router  # noqa: E402
from core.dependencies import get_current_user  # noqa: E402
from models.base import get_db  # noqa: E402
from services.metrics_calculator import calculate_muscle_volume  # noqa: E402


class EnumValue:
    def __init__(self, value: str):
        self.value = value


def make_exercise_muscle(role: str, muscle_name: str | None):
    muscle = None if muscle_name is None else SimpleNamespace(name=muscle_name)
    return SimpleNamespace(muscle_role=role, muscle=muscle)


def make_exercise(muscles=None):
    return SimpleNamespace(exercise_muscles=muscles or [])


def make_day_exercise(
    day_exercise_id: int,
    *,
    phase: str = "main",
    sets: int | float | None = 3,
    effort_type: str | None = "RIR",
    effort_value: float | None = 2.0,
    exercise=None,
):
    return SimpleNamespace(
        id=day_exercise_id,
        phase=None if phase is None else EnumValue(phase),
        sets=sets,
        effort_type=None if effort_type is None else EnumValue(effort_type),
        effort_value=effort_value,
        exercise=exercise,
    )


def make_training_day(
    training_day_id: int | str = 112,
    *,
    name: str = "Torso - A",
    day_number: int = 1,
    rest_day: bool = False,
    exercises=None,
):
    return SimpleNamespace(
        id=training_day_id,
        name=name,
        day_number=day_number,
        rest_day=rest_day,
        exercises=exercises or [],
    )


def test_calculate_muscle_volume_counts_primary_and_secondary_sets() -> None:
    training_day = make_training_day(
        exercises=[
            make_day_exercise(
                1,
                sets=4,
                exercise=make_exercise(
                    [
                        make_exercise_muscle("primary", "chest"),
                        make_exercise_muscle("secondary", "triceps"),
                    ]
                ),
            )
        ]
    )

    response = calculate_muscle_volume(training_day, count_secondary=True)
    muscles = {item.muscle_name: item for item in response.muscles}

    assert response.training_day_id == "112"
    assert response.training_day_name == "Torso - A"
    assert response.total_effective_sets == 6.0
    assert muscles["chest"].effective_sets == 4.0
    assert muscles["triceps"].effective_sets == 2.0


def test_calculate_muscle_volume_returns_zero_for_rest_day() -> None:
    training_day = make_training_day(training_day_id=88, rest_day=True)

    response = calculate_muscle_volume(training_day)

    assert response.training_day_id == "88"
    assert response.training_day_name == "Torso - A"
    assert response.total_effective_sets == 0
    assert response.muscles == []


def test_calculate_muscle_volume_skips_missing_exercise_rows() -> None:
    training_day = make_training_day(
        exercises=[
            make_day_exercise(1, exercise=None),
            make_day_exercise(
                2,
                sets=3,
                exercise=make_exercise([make_exercise_muscle("primary", "biceps")]),
            ),
        ]
    )

    response = calculate_muscle_volume(training_day)

    assert response.total_effective_sets == 3.0
    assert [item.muscle_name for item in response.muscles] == ["biceps"]


def test_calculate_muscle_volume_skips_missing_muscle_relations() -> None:
    training_day = make_training_day(
        exercises=[
            make_day_exercise(
                1,
                sets=3,
                exercise=make_exercise(
                    [
                        make_exercise_muscle("primary", None),
                        make_exercise_muscle("primary", "lats"),
                    ]
                ),
            )
        ]
    )

    response = calculate_muscle_volume(training_day)

    assert response.total_effective_sets == 3.0
    assert [item.muscle_name for item in response.muscles] == ["lats"]


def test_calculate_muscle_volume_tolerates_missing_effort_value() -> None:
    training_day = make_training_day(
        exercises=[
            make_day_exercise(
                1,
                effort_type="RIR",
                effort_value=None,
                sets=3,
                exercise=make_exercise([make_exercise_muscle("primary", "chest")]),
            )
        ]
    )

    response = calculate_muscle_volume(training_day)

    assert response.total_effective_sets == 3.0
    assert response.muscles[0].muscle_name == "chest"


class FakeQuery:
    def __init__(self, result):
        self.result = result

    def options(self, *args, **kwargs):
        return self

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.result


class FakeSession:
    def __init__(self, result):
        self.result = result

    def query(self, model):
        return FakeQuery(self.result)


def test_get_muscle_volume_route_returns_200_for_authorized_client(monkeypatch) -> None:
    training_day = make_training_day(
        exercises=[
            make_day_exercise(
                1,
                sets=3,
                exercise=make_exercise([make_exercise_muscle("primary", "chest")]),
            )
        ]
    )
    current_user = SimpleNamespace(id=13, is_active=True, role="client")

    def override_db():
        yield FakeSession(training_day)

    app = FastAPI()
    app.include_router(training_days_router.router, prefix="/api/training-days")
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current_user
    monkeypatch.setattr(
        training_days_router,
        "get_training_day_with_access",
        lambda db, training_day_id, user: training_day,
    )

    try:
        async def request():
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.get("/api/training-days/112/muscle-volume?count_secondary=true")

        response = asyncio.run(request())
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["training_day_id"] == "112"
    assert payload["training_day_name"] == "Torso - A"
    assert payload["total_effective_sets"] == 3.0
    assert payload["muscles"] == [
        {
            "muscle_name": "chest",
            "display_name": "Pecho",
            "effective_sets": 3.0,
            "total_sets": 3.0,
        }
    ]
