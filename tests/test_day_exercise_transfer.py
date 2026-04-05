from datetime import datetime, timezone
import os
from pathlib import Path
from types import SimpleNamespace
import sys
import types

import pytest


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

from api.routers import day_exercises as day_exercises_router  # noqa: E402
from models.mesocycle import DayExercise, EffortType, ExercisePhase, TrainingDay  # noqa: E402
from schemas.mesocycle import DayExerciseTransferRequest  # noqa: E402


UTC = timezone.utc


def _dt(year: int, month: int, day: int) -> datetime:
    return datetime(year, month, day, 12, 0, tzinfo=UTC)


def _make_day_exercise(
    exercise_id: int,
    training_day_id: int,
    order_index: int,
    *,
    phase: ExercisePhase = ExercisePhase.MAIN,
    set_type: str = "cluster",
    notes: str = "Preserve everything",
) -> DayExercise:
    return DayExercise(
        id=exercise_id,
        training_day_id=training_day_id,
        exercise_id=900 + exercise_id,
        order_index=order_index,
        phase=phase,
        sets=5,
        reps_min=6,
        reps_max=8,
        rest_seconds=150,
        effort_type=EffortType.RPE,
        effort_value=8.5,
        tempo="3-1-1-0",
        set_type=set_type,
        duration_seconds=480,
        intensity_zone=3,
        distance_meters=1600,
        target_calories=180,
        intervals=6,
        work_seconds=45,
        interval_rest_seconds=30,
        notes=notes,
        created_at=_dt(2026, 4, 1),
        updated_at=_dt(2026, 4, 1),
        rpe_target=8.0,
    )


def _make_training_day(training_day_id: int, exercises: list[DayExercise]) -> TrainingDay:
    day = TrainingDay(
        id=training_day_id,
        microcycle_id=400 + training_day_id,
        day_number=training_day_id,
        date=datetime(2026, 4, training_day_id + 1, 12, 0, tzinfo=UTC).date(),
        session_index=1,
        session_label="AM",
        name=f"Day {training_day_id}",
        focus="Strength",
        rest_day=False,
        notes=None,
        created_at=_dt(2026, 4, 1),
        updated_at=_dt(2026, 4, 1),
    )
    day.exercises = exercises
    return day


class TransferSession:
    def __init__(self, training_days: list[TrainingDay]):
        self.training_days_by_id = {training_day.id: training_day for training_day in training_days}
        self.day_exercises_by_id = {
            exercise.id: exercise
            for training_day in training_days
            for exercise in training_day.exercises
        }
        self.commit_calls = 0
        self._next_day_exercise_id = 2000

    def add(self, obj):
        if isinstance(obj, DayExercise):
            if obj.id is None:
                obj.id = self._next_day_exercise_id
                self._next_day_exercise_id += 1
            self.day_exercises_by_id[obj.id] = obj

    def commit(self):
        self.commit_calls += 1
        for training_day in self.training_days_by_id.values():
            training_day.exercises = []

        for exercise in self.day_exercises_by_id.values():
            self.training_days_by_id[exercise.training_day_id].exercises.append(exercise)

        for training_day in self.training_days_by_id.values():
            training_day.exercises.sort(key=lambda exercise: (exercise.order_index, exercise.id))

    def refresh(self, obj):
        return obj

    def query(self, model):
        return _QueryStub(self, model)


class _QueryStub:
    def __init__(self, session: TransferSession, model):
        self.session = session
        self.model = model
        self.conditions = []
        self.ordering = []

    def options(self, *args, **kwargs):
        return self

    def filter(self, *conditions):
        self.conditions.extend(conditions)
        return self

    def order_by(self, *ordering):
        self.ordering.extend(ordering)
        return self

    def first(self):
        records = self.all()
        return records[0] if records else None

    def all(self):
        if self.model is not DayExercise:
            return []

        records = list(self.session.day_exercises_by_id.values())
        filtered_records = [
            record
            for record in records
            if all(_matches(record, condition) for condition in self.conditions)
        ]

        if self.ordering:
            filtered_records.sort(
                key=lambda record: tuple(getattr(record, ordering.key) for ordering in self.ordering)
            )

        return filtered_records


def _matches(record: DayExercise, condition) -> bool:
    left_key = condition.left.key
    right_value = getattr(condition.right, "value", condition.right)
    operator_name = getattr(condition.operator, "__name__", "")
    left_value = getattr(record, left_key)

    if operator_name == "eq":
        return left_value == right_value
    if operator_name == "gt":
        return left_value > right_value
    if operator_name == "ge":
        return left_value >= right_value

    raise AssertionError(f"Unsupported operator {operator_name}")


@pytest.fixture(autouse=True)
def stub_access(monkeypatch):
    monkeypatch.setattr(day_exercises_router, "assert_training_professional_access", lambda current_user: None)
    monkeypatch.setattr(
        day_exercises_router,
        "verify_training_day_access",
        lambda db, training_day_id, current_user: db.training_days_by_id[training_day_id],
    )


def test_transfer_move_preserves_fields_and_reindexes():
    source_day = _make_training_day(
        1,
        [
            _make_day_exercise(101, 1, 0, phase=ExercisePhase.WARMUP, set_type="straight"),
            _make_day_exercise(102, 1, 1, phase=ExercisePhase.MAIN, set_type="drop_set"),
        ],
    )
    target_day = _make_training_day(
        2,
        [
            _make_day_exercise(201, 2, 0, phase=ExercisePhase.MAIN, set_type="backoff"),
        ],
    )
    session = TransferSession([source_day, target_day])

    response = day_exercises_router.transfer_day_exercise_between_days(
        102,
        DayExerciseTransferRequest(
            mode="move",
            from_day_id=1,
            to_day_id=2,
            new_index=0,
            phase=ExercisePhase.COOLDOWN,
        ),
        db=session,
        current_user=SimpleNamespace(id=7),
    )

    moved_exercise = response["transferred_exercise"]

    assert moved_exercise.id == 102
    assert moved_exercise.training_day_id == 2
    assert moved_exercise.phase == ExercisePhase.COOLDOWN
    assert moved_exercise.set_type == "drop_set"
    assert moved_exercise.duration_seconds == 480
    assert moved_exercise.target_calories == 180
    assert [exercise.id for exercise in source_day.exercises] == [101]
    assert [exercise.order_index for exercise in source_day.exercises] == [0]
    assert [exercise.id for exercise in target_day.exercises] == [102, 201]
    assert [exercise.order_index for exercise in target_day.exercises] == [0, 1]
    assert [exercise.id for exercise in response["source_day_exercises"]] == [101]
    assert [exercise.id for exercise in response["target_day_exercises"]] == [102, 201]


def test_transfer_clone_preserves_all_parameters_and_leaves_original_untouched():
    source_day = _make_training_day(
        1,
        [_make_day_exercise(103, 1, 0, phase=ExercisePhase.MAIN, set_type="myo_reps")],
    )
    target_day = _make_training_day(
        2,
        [_make_day_exercise(202, 2, 0, phase=ExercisePhase.COOLDOWN, set_type="cluster")],
    )
    session = TransferSession([source_day, target_day])

    response = day_exercises_router.transfer_day_exercise_between_days(
        103,
        DayExerciseTransferRequest(
            mode="clone",
            from_day_id=1,
            to_day_id=2,
            new_index=1,
            phase=ExercisePhase.WARMUP,
        ),
        db=session,
        current_user=SimpleNamespace(id=7),
    )

    cloned_exercise = response["transferred_exercise"]
    original_exercise = source_day.exercises[0]

    assert cloned_exercise.id != original_exercise.id
    assert original_exercise.training_day_id == 1
    assert cloned_exercise.training_day_id == 2
    assert cloned_exercise.phase == ExercisePhase.WARMUP
    assert cloned_exercise.exercise_id == original_exercise.exercise_id
    assert cloned_exercise.set_type == "myo_reps"
    assert cloned_exercise.distance_meters == 1600
    assert cloned_exercise.intervals == 6
    assert cloned_exercise.interval_rest_seconds == 30
    assert [exercise.id for exercise in source_day.exercises] == [103]
    assert [exercise.id for exercise in target_day.exercises] == [202, cloned_exercise.id]
    assert [exercise.order_index for exercise in target_day.exercises] == [0, 1]


def test_duplicate_day_exercise_uses_full_copy_helper():
    source_day = _make_training_day(
        1,
        [_make_day_exercise(104, 1, 0, phase=ExercisePhase.WARMUP, set_type="cluster")],
    )
    session = TransferSession([source_day])

    duplicated_exercise = day_exercises_router.duplicate_day_exercise(
        104,
        db=session,
        current_user=SimpleNamespace(id=7),
    )

    assert duplicated_exercise.id != 104
    assert duplicated_exercise.training_day_id == 1
    assert duplicated_exercise.phase == ExercisePhase.WARMUP
    assert duplicated_exercise.set_type == "cluster"
    assert duplicated_exercise.duration_seconds == 480
    assert duplicated_exercise.work_seconds == 45
    assert duplicated_exercise.rpe_target == 8.0
    assert duplicated_exercise.notes.endswith("(Copy)")
    assert [exercise.order_index for exercise in source_day.exercises] == [0, 1]
