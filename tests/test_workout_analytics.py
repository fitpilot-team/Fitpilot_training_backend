from __future__ import annotations

from datetime import date, datetime
from types import SimpleNamespace
from pathlib import Path
import sys
import types

import pytest


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

from api.routers.workout_analytics import (  # noqa: E402
    RepRangeValidationError,
    build_dashboard_response,
    build_recent_history,
    build_exercise_detail_series,
    default_rep_ranges,
    filter_workout_logs_by_status,
    normalize_rep_ranges,
)


def make_set(
    *,
    exercise_id: int,
    reps: int,
    weight: float | None,
):
    return SimpleNamespace(
        exercise_id=exercise_id,
        reps_completed=reps,
        weight_kg=weight,
        day_exercise=None,
    )


def make_log(
    *,
    log_id: int,
    performed_on: date,
    started_at: datetime,
    completed_at: datetime | None,
    status: str,
    training_day_name: str,
    sets,
    exercises_count: int = 0,
):
    training_day = SimpleNamespace(name=training_day_name, exercises=[object()] * exercises_count)
    return SimpleNamespace(
        id=log_id,
        performed_on_date=performed_on,
        started_at=started_at,
        completed_at=completed_at,
        status=status,
        training_day=training_day,
        exercise_sets=list(sets),
        is_authoritative=True,
    )


def test_normalize_rep_ranges_generates_labels_and_rejects_gaps() -> None:
    normalized = normalize_rep_ranges(
        [
            {"min_reps": 1, "max_reps": 3},
            {"min_reps": 4, "max_reps": 6},
            {"min_reps": 7, "max_reps": None},
        ]
    )

    assert normalized[0]["label"] == "1-3"
    assert normalized[1]["color_token"] == "sky"
    assert normalized[2]["label"] == "7+"

    with pytest.raises(RepRangeValidationError, match="sin huecos"):
        normalize_rep_ranges(
            [
                {"min_reps": 1, "max_reps": 5},
                {"min_reps": 7, "max_reps": None},
            ]
        )


def test_build_dashboard_response_aggregates_volume_and_ignores_unweighted_sets() -> None:
    rep_ranges = default_rep_ranges()
    logs = [
        make_log(
            log_id=10,
            performed_on=date(2026, 3, 19),
            started_at=datetime(2026, 3, 19, 8, 0, 0),
            completed_at=datetime(2026, 3, 19, 9, 0, 0),
            status="completed",
            training_day_name="Torso A",
            exercises_count=2,
            sets=[
                make_set(exercise_id=1, reps=5, weight=100),
                make_set(exercise_id=1, reps=8, weight=80),
                make_set(exercise_id=2, reps=12, weight=None),
            ],
        ),
        make_log(
            log_id=11,
            performed_on=date(2026, 3, 12),
            started_at=datetime(2026, 3, 12, 8, 0, 0),
            completed_at=datetime(2026, 3, 12, 8, 45, 0),
            status="completed",
            training_day_name="Pierna B",
            exercises_count=1,
            sets=[
                make_set(exercise_id=1, reps=6, weight=82.5),
            ],
        ),
    ]

    response = build_dashboard_response(
        workout_logs=logs,
        rep_ranges=rep_ranges,
        range_key="12w",
        exercise_names={1: "Press de banca", 2: "Dominadas"},
        today=date(2026, 3, 21),
    )

    assert response.summary.total_sessions == 2
    assert response.summary.sessions_in_range == 2
    assert response.summary.active_days == 2
    assert response.summary.total_volume_kg == 1635.0
    assert response.summary.avg_duration_minutes == 52.5
    assert response.recent_history[0].training_day_name == "Torso A"
    assert response.recent_history[0].volume_kg == 1140.0
    assert response.recent_history[0].exercises_count == 2

    exercise_summary = response.exercise_summaries[0]
    assert exercise_summary.exercise_name == "Press de banca"
    assert exercise_summary.latest_best_weight_kg == 100.0
    assert exercise_summary.best_weight_delta_kg == 17.5
    assert exercise_summary.sparkline_points == [82.5, 100.0]

    weekly_points = {point.week_start.isoformat(): point.totals for point in response.rep_range_chart}
    assert weekly_points["2026-03-09"]["range_2"] == 495.0
    assert weekly_points["2026-03-16"]["range_1"] == 500.0
    assert weekly_points["2026-03-16"]["range_2"] == 640.0


def test_build_exercise_detail_series_tracks_personal_best_and_dominant_bucket() -> None:
    rep_ranges = default_rep_ranges()
    logs = [
        make_log(
            log_id=21,
            performed_on=date(2026, 3, 10),
            started_at=datetime(2026, 3, 10, 8, 0, 0),
            completed_at=datetime(2026, 3, 10, 8, 50, 0),
            status="completed",
            training_day_name="Empuje",
            sets=[
                make_set(exercise_id=1, reps=8, weight=80),
                make_set(exercise_id=1, reps=8, weight=82.5),
            ],
        ),
        make_log(
            log_id=22,
            performed_on=date(2026, 3, 17),
            started_at=datetime(2026, 3, 17, 8, 0, 0),
            completed_at=datetime(2026, 3, 17, 8, 55, 0),
            status="completed",
            training_day_name="Empuje",
            sets=[
                make_set(exercise_id=1, reps=5, weight=100),
                make_set(exercise_id=1, reps=5, weight=102.5),
            ],
        ),
    ]

    response = build_exercise_detail_series(
        workout_logs=logs,
        exercise_id=1,
        rep_ranges=rep_ranges,
        exercise_name="Press de banca",
    )

    assert response.exercise_name == "Press de banca"
    assert response.summary.total_sessions == 2
    assert response.summary.personal_best_kg == 102.5
    assert response.summary.first_logged_at == date(2026, 3, 10)
    assert response.summary.last_logged_at == date(2026, 3, 17)
    assert response.series[0].reps_bucket_id == "range_2"
    assert response.series[0].best_weight_kg == 82.5
    assert response.series[1].reps_bucket_id == "range_1"
    assert response.series[1].volume_kg == 1012.5


def test_recent_history_supports_status_filter_and_pagination() -> None:
    logs = [
        make_log(
            log_id=30,
            performed_on=date(2026, 3, 20),
            started_at=datetime(2026, 3, 20, 8, 0, 0),
            completed_at=datetime(2026, 3, 20, 8, 30, 0),
            status="completed",
            training_day_name="Torso A",
            exercises_count=2,
            sets=[],
        ),
        make_log(
            log_id=31,
            performed_on=date(2026, 3, 18),
            started_at=datetime(2026, 3, 18, 8, 0, 0),
            completed_at=None,
            status="in_progress",
            training_day_name="Pierna B",
            exercises_count=3,
            sets=[],
        ),
        make_log(
            log_id=32,
            performed_on=date(2026, 3, 14),
            started_at=datetime(2026, 3, 14, 8, 0, 0),
            completed_at=datetime(2026, 3, 14, 8, 35, 0),
            status="completed",
            training_day_name="Empuje",
            exercises_count=1,
            sets=[],
        ),
    ]

    completed_logs = filter_workout_logs_by_status(logs, "completed")
    assert [log.id for log in completed_logs] == [30, 32]

    paged_history = build_recent_history(completed_logs, skip=1, limit=1)
    assert len(paged_history) == 1
    assert paged_history[0].workout_log_id == "32"
    assert paged_history[0].training_day_name == "Empuje"
