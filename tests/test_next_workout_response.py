from pathlib import Path
from types import SimpleNamespace
import sys
import types


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

from api.routers.workout_logs import build_next_workout_response  # noqa: E402


def make_training_day(training_day_id: str, day_number: int) -> SimpleNamespace:
    return SimpleNamespace(
        id=training_day_id,
        name=f"Day {day_number}",
        focus="Strength",
        day_number=day_number,
        rest_day=False,
    )


def test_build_next_workout_response_returns_reason_when_no_training_days() -> None:
    response = build_next_workout_response([], set())

    assert response.training_day is None
    assert response.position is None
    assert response.total is None
    assert response.all_completed is False
    assert response.reason == "no_training_days"


def test_build_next_workout_response_returns_first_incomplete_training_day() -> None:
    training_days = [
        make_training_day("1", 1),
        make_training_day("2", 2),
        make_training_day("3", 3),
    ]

    response = build_next_workout_response(training_days, {"1"})

    assert response.training_day is not None
    assert response.training_day.id == "2"
    assert isinstance(response.training_day.id, str)
    assert response.position == 2
    assert response.total == 3
    assert response.all_completed is False
    assert response.reason is None


def test_build_next_workout_response_returns_all_completed_reason() -> None:
    training_days = [
        make_training_day("1", 1),
        make_training_day("2", 2),
    ]

    response = build_next_workout_response(training_days, {"1", "2"})

    assert response.training_day is None
    assert response.position == 2
    assert response.total == 2
    assert response.all_completed is True
    assert response.reason == "all_completed"
