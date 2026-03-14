from pathlib import Path
from types import SimpleNamespace
import sys
import types

import pytest
from fastapi import HTTPException


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

from core.dependencies import parse_numeric_identifier  # noqa: E402
from schemas.workout_log import ExerciseSetLogCreate, WorkoutLogCreate  # noqa: E402
from services.metrics_calculator import calculate_muscle_volume  # noqa: E402


def test_parse_numeric_identifier_accepts_numeric_strings() -> None:
    assert parse_numeric_identifier("112", "training_day_id") == 112
    assert parse_numeric_identifier(42, "day_exercise_id") == 42


def test_parse_numeric_identifier_rejects_invalid_values() -> None:
    with pytest.raises(HTTPException) as exc_info:
        parse_numeric_identifier("abc", "training_day_id")

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == "training_day_id must be a numeric identifier"


def test_workout_input_models_accept_numeric_ids() -> None:
    workout = WorkoutLogCreate(training_day_id=112, notes="Ready")
    set_log = ExerciseSetLogCreate(
        day_exercise_id=77,
        set_number=1,
        reps_completed=10,
        weight_kg=20,
    )

    assert workout.training_day_id == "112"
    assert set_log.day_exercise_id == "77"


def test_calculate_muscle_volume_stringifies_training_day_id() -> None:
    training_day = SimpleNamespace(
        id=112,
        name="Torso - A",
        day_number=1,
        exercises=[],
    )

    response = calculate_muscle_volume(training_day)

    assert response.training_day_id == "112"
    assert response.training_day_name == "Torso - A"
    assert response.total_effective_sets == 0
    assert response.muscles == []
