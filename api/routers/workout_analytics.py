from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Iterable, Sequence

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from core.dependencies import get_current_user
from models.base import get_db
from models.exercise import Exercise
from models.mesocycle import DayExercise, TrainingDay
from models.user import User
from models.workout_analytics import ClientWorkoutAnalyticsPreference
from models.workout_log import ExerciseSetLog, WorkoutLog
from schemas.workout_analytics import (
    ExerciseTrendDetailResponse,
    ExerciseTrendDetailSummaryResponse,
    ExerciseTrendPointResponse,
    WorkoutAnalyticsHistoryPageResponse,
    WorkoutAnalyticsHistoryStatusFilter,
    ExerciseTrendSummaryResponse,
    RecentWorkoutHistoryItemResponse,
    RepRangeBucketResponse,
    RepRangeBucketUpsert,
    RepRangeChartPointResponse,
    WorkoutAnalyticsDashboardResponse,
    WorkoutAnalyticsPreferencesResponse,
    WorkoutAnalyticsPreferencesUpdate,
    WorkoutAnalyticsRange,
    WorkoutAnalyticsSummaryResponse,
)

router = APIRouter()

DEFAULT_REP_RANGE_COLORS = ("navy", "sky", "emerald", "amber", "rose", "violet")
DEFAULT_REP_RANGES: list[dict[str, Any]] = [
    {"id": "range_1", "min_reps": 1, "max_reps": 5, "color_token": "navy"},
    {"id": "range_2", "min_reps": 6, "max_reps": 8, "color_token": "sky"},
    {"id": "range_3", "min_reps": 9, "max_reps": 12, "color_token": "emerald"},
    {"id": "range_4", "min_reps": 13, "max_reps": None, "color_token": "amber"},
]
RANGE_TO_WEEKS = {"4w": 4, "8w": 8, "12w": 12, "24w": 24}
MAX_RECENT_HISTORY_ITEMS = 12
DEFAULT_HISTORY_PAGE_SIZE = 20


class RepRangeValidationError(ValueError):
    pass


def utc_today() -> date:
    return datetime.utcnow().date()


def stringify_enum(value: object) -> str:
    if value is None:
        return ""
    if hasattr(value, "value"):
        return str(getattr(value, "value"))
    return str(value)


def round_metric(value: float | None) -> float:
    if value is None:
        return 0.0
    return round(float(value), 2)


def build_rep_range_label(min_reps: int, max_reps: int | None) -> str:
    return f"{min_reps}+" if max_reps is None else f"{min_reps}-{max_reps}"


def _coerce_range_bucket(raw_bucket: RepRangeBucketUpsert | dict[str, Any]) -> dict[str, Any]:
    if isinstance(raw_bucket, RepRangeBucketUpsert):
        return raw_bucket.model_dump(exclude_none=True)
    return dict(raw_bucket)


def normalize_rep_ranges(raw_ranges: Sequence[RepRangeBucketUpsert | dict[str, Any]]) -> list[dict[str, Any]]:
    buckets = list(raw_ranges)
    if len(buckets) < 2 or len(buckets) > 6:
        raise RepRangeValidationError("Debes definir entre 2 y 6 rangos de repeticiones.")

    normalized: list[dict[str, Any]] = []
    expected_min = 1

    for index, raw_bucket in enumerate(buckets):
        bucket = _coerce_range_bucket(raw_bucket)
        min_reps = int(bucket.get("min_reps") or 0)
        max_reps = bucket.get("max_reps")
        max_reps = int(max_reps) if max_reps is not None else None

        if min_reps < 1:
            raise RepRangeValidationError("Cada rango debe comenzar en 1 repeticion o mas.")

        if min_reps != expected_min:
            raise RepRangeValidationError("Los rangos deben ser contiguos, ordenados y sin huecos.")

        is_last = index == len(buckets) - 1
        if max_reps is None and not is_last:
            raise RepRangeValidationError("Solo el ultimo rango puede quedar abierto.")
        if max_reps is not None and max_reps < min_reps:
            raise RepRangeValidationError("Cada rango debe terminar en un valor mayor o igual al inicio.")

        color_token = str(bucket.get("color_token") or DEFAULT_REP_RANGE_COLORS[index]).strip()
        if color_token not in DEFAULT_REP_RANGE_COLORS:
            color_token = DEFAULT_REP_RANGE_COLORS[index]

        normalized_bucket = {
            "id": str(bucket.get("id") or f"range_{index + 1}"),
            "label": str(bucket.get("label") or build_rep_range_label(min_reps, max_reps)).strip(),
            "min_reps": min_reps,
            "max_reps": max_reps,
            "color_token": color_token,
        }
        normalized.append(normalized_bucket)

        if max_reps is None:
            expected_min = max(expected_min, min_reps)
        else:
            expected_min = max_reps + 1

    if normalized[-1]["max_reps"] is not None and normalized[-1]["max_reps"] < normalized[-1]["min_reps"]:
        raise RepRangeValidationError("El ultimo rango es invalido.")

    return normalized


def default_rep_ranges() -> list[dict[str, Any]]:
    return normalize_rep_ranges(DEFAULT_REP_RANGES)


def serialize_preferences(rep_ranges: Sequence[dict[str, Any]]) -> WorkoutAnalyticsPreferencesResponse:
    return WorkoutAnalyticsPreferencesResponse(
        rep_ranges=[RepRangeBucketResponse(**bucket) for bucket in rep_ranges],
    )


def get_or_create_preferences(db: Session, client_id: int) -> ClientWorkoutAnalyticsPreference:
    preferences = (
        db.query(ClientWorkoutAnalyticsPreference)
        .filter(ClientWorkoutAnalyticsPreference.client_id == client_id)
        .first()
    )

    if not preferences:
        preferences = ClientWorkoutAnalyticsPreference(
            client_id=client_id,
            rep_ranges=default_rep_ranges(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(preferences)
        db.commit()
        db.refresh(preferences)
        return preferences

    try:
        normalized = normalize_rep_ranges(preferences.rep_ranges or default_rep_ranges())
    except RepRangeValidationError:
        normalized = default_rep_ranges()

    if normalized != (preferences.rep_ranges or []):
        preferences.rep_ranges = normalized
        preferences.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(preferences)

    return preferences


def resolve_range_start(range_key: WorkoutAnalyticsRange, today: date | None = None) -> date | None:
    if range_key == "all":
        return None

    reference_date = today or utc_today()
    weeks = RANGE_TO_WEEKS[range_key]
    return reference_date - timedelta(days=(weeks * 7) - 1)


def get_log_performed_date(workout_log: WorkoutLog | Any) -> date:
    performed_on_date = getattr(workout_log, "performed_on_date", None)
    if performed_on_date:
        return performed_on_date

    started_at = getattr(workout_log, "started_at", None)
    if started_at:
        return started_at.date()

    return utc_today()


def filter_logs_in_range(
    workout_logs: Iterable[WorkoutLog | Any],
    range_start: date | None,
) -> list[WorkoutLog | Any]:
    if range_start is None:
        return list(workout_logs)

    return [workout_log for workout_log in workout_logs if get_log_performed_date(workout_log) >= range_start]


def filter_workout_logs_by_status(
    workout_logs: Iterable[WorkoutLog | Any],
    status_filter: WorkoutAnalyticsHistoryStatusFilter,
) -> list[WorkoutLog | Any]:
    if status_filter == "all":
        return list(workout_logs)

    return [
        workout_log
        for workout_log in workout_logs
        if stringify_enum(getattr(workout_log, "status", "")) == status_filter
    ]


def calculate_duration_minutes(workout_log: WorkoutLog | Any) -> float | None:
    started_at = getattr(workout_log, "started_at", None)
    completed_at = getattr(workout_log, "completed_at", None)

    if not started_at or not completed_at:
        return None

    duration_seconds = (completed_at - started_at).total_seconds()
    if duration_seconds < 0:
        return None

    return round(duration_seconds / 60, 1)


def get_set_exercise_id(set_log: ExerciseSetLog | Any) -> int | None:
    exercise_id = getattr(set_log, "exercise_id", None)
    if exercise_id is not None:
        return int(exercise_id)

    day_exercise = getattr(set_log, "day_exercise", None)
    if day_exercise and getattr(day_exercise, "exercise_id", None) is not None:
        return int(day_exercise.exercise_id)

    return None


def get_exercise_name_for_set(set_log: ExerciseSetLog | Any, fallback_names: dict[int, str]) -> str:
    day_exercise = getattr(set_log, "day_exercise", None)
    exercise = getattr(day_exercise, "exercise", None) if day_exercise else None
    if exercise:
        return exercise.name_es or exercise.name_en

    exercise_id = get_set_exercise_id(set_log)
    if exercise_id is None:
        return "Ejercicio"

    return fallback_names.get(exercise_id, "Ejercicio")


def build_exercise_name_map(db: Session, workout_logs: Sequence[WorkoutLog | Any]) -> dict[int, str]:
    exercise_names: dict[int, str] = {}
    exercise_ids: set[int] = set()

    for workout_log in workout_logs:
        for set_log in getattr(workout_log, "exercise_sets", []) or []:
            exercise_id = get_set_exercise_id(set_log)
            if exercise_id is not None:
                exercise_ids.add(exercise_id)

    if not exercise_ids:
        return exercise_names

    exercises = db.query(Exercise).filter(Exercise.id.in_(exercise_ids)).all()
    for exercise in exercises:
        exercise_names[int(exercise.id)] = exercise.name_es or exercise.name_en

    return exercise_names


def find_rep_range_bucket(rep_ranges: Sequence[dict[str, Any]], reps_completed: int | None) -> dict[str, Any] | None:
    if reps_completed is None or reps_completed < 1:
        return None

    for bucket in rep_ranges:
        max_reps = bucket["max_reps"]
        if max_reps is None and reps_completed >= bucket["min_reps"]:
            return bucket
        if max_reps is not None and bucket["min_reps"] <= reps_completed <= max_reps:
            return bucket
    return None


def calculate_weighted_set_volume(set_log: ExerciseSetLog | Any) -> float:
    reps_completed = getattr(set_log, "reps_completed", None)
    weight_kg = getattr(set_log, "weight_kg", None)
    if reps_completed is None or reps_completed <= 0 or weight_kg is None or weight_kg <= 0:
        return 0.0
    return float(reps_completed) * float(weight_kg)


def calculate_workout_volume(workout_log: WorkoutLog | Any) -> float:
    return round_metric(
        sum(calculate_weighted_set_volume(set_log) for set_log in getattr(workout_log, "exercise_sets", []) or []),
    )


def calculate_exercises_count(workout_log: WorkoutLog | Any) -> int:
    training_day = getattr(workout_log, "training_day", None)
    if training_day and getattr(training_day, "exercises", None):
        return len(training_day.exercises)

    exercise_ids = {
        exercise_id
        for set_log in getattr(workout_log, "exercise_sets", []) or []
        for exercise_id in [get_set_exercise_id(set_log)]
        if exercise_id is not None
    }
    return len(exercise_ids)


def get_week_start(day_value: date) -> date:
    return day_value - timedelta(days=day_value.weekday())


def build_recent_history(
    workout_logs: Sequence[WorkoutLog | Any],
    *,
    skip: int = 0,
    limit: int = MAX_RECENT_HISTORY_ITEMS,
) -> list[RecentWorkoutHistoryItemResponse]:
    history_items: list[RecentWorkoutHistoryItemResponse] = []
    normalized_skip = max(skip, 0)
    normalized_limit = max(limit, 0)

    if normalized_limit == 0:
        return history_items

    for workout_log in list(workout_logs)[normalized_skip : normalized_skip + normalized_limit]:
        training_day = getattr(workout_log, "training_day", None)
        history_items.append(
            RecentWorkoutHistoryItemResponse(
                workout_log_id=getattr(workout_log, "id", None),
                training_day_name=getattr(training_day, "name", None) or "Sesion",
                performed_on_date=get_log_performed_date(workout_log),
                duration_minutes=calculate_duration_minutes(workout_log),
                exercises_count=calculate_exercises_count(workout_log),
                volume_kg=calculate_workout_volume(workout_log),
                status=stringify_enum(getattr(workout_log, "status", "")),
            ),
        )

    return history_items


def build_rep_range_chart(
    workout_logs: Sequence[WorkoutLog | Any],
    rep_ranges: Sequence[dict[str, Any]],
    range_start: date | None,
    today: date | None = None,
) -> list[RepRangeChartPointResponse]:
    if not workout_logs:
        return []

    reference_end = today or utc_today()
    if range_start is None:
        earliest_date = min(get_log_performed_date(workout_log) for workout_log in workout_logs)
        start_week = get_week_start(earliest_date)
    else:
        start_week = get_week_start(range_start)

    end_week = get_week_start(reference_end)
    weekly_totals: dict[date, dict[str, float]] = {}
    current_week = start_week
    while current_week <= end_week:
        weekly_totals[current_week] = {bucket["id"]: 0.0 for bucket in rep_ranges}
        current_week += timedelta(days=7)

    for workout_log in workout_logs:
        week_start = get_week_start(get_log_performed_date(workout_log))
        bucket_totals = weekly_totals.setdefault(
            week_start,
            {bucket["id"]: 0.0 for bucket in rep_ranges},
        )
        for set_log in getattr(workout_log, "exercise_sets", []) or []:
            volume = calculate_weighted_set_volume(set_log)
            if volume <= 0:
                continue
            bucket = find_rep_range_bucket(rep_ranges, getattr(set_log, "reps_completed", None))
            if not bucket:
                continue
            bucket_totals[bucket["id"]] = round_metric(bucket_totals[bucket["id"]] + volume)

    return [
        RepRangeChartPointResponse(week_start=week_start, totals=weekly_totals[week_start])
        for week_start in sorted(weekly_totals.keys())
    ]


def build_exercise_summaries(
    workout_logs: Sequence[WorkoutLog | Any],
    exercise_names: dict[int, str],
) -> list[ExerciseTrendSummaryResponse]:
    exercise_data: dict[int, dict[str, Any]] = {}

    for workout_log in sorted(workout_logs, key=get_log_performed_date):
        performed_on = get_log_performed_date(workout_log)
        per_log_metrics: dict[int, dict[str, Any]] = {}

        for set_log in getattr(workout_log, "exercise_sets", []) or []:
            exercise_id = get_set_exercise_id(set_log)
            if exercise_id is None:
                continue

            metrics = per_log_metrics.setdefault(
                exercise_id,
                {
                    "name": get_exercise_name_for_set(set_log, exercise_names),
                    "best_weight": None,
                    "volume": 0.0,
                },
            )

            volume = calculate_weighted_set_volume(set_log)
            if volume > 0:
                metrics["volume"] += volume
                weight_kg = float(getattr(set_log, "weight_kg", 0) or 0)
                if metrics["best_weight"] is None or weight_kg > metrics["best_weight"]:
                    metrics["best_weight"] = weight_kg

        for exercise_id, metrics in per_log_metrics.items():
            aggregate = exercise_data.setdefault(
                exercise_id,
                {
                    "exercise_name": metrics["name"],
                    "sessions_count": 0,
                    "last_performed_on": performed_on,
                    "points": defaultdict(lambda: {"best_weight": None, "volume": 0.0}),
                },
            )
            aggregate["sessions_count"] += 1
            if performed_on >= aggregate["last_performed_on"]:
                aggregate["last_performed_on"] = performed_on

            point = aggregate["points"][performed_on]
            point["volume"] += metrics["volume"]
            if metrics["best_weight"] is not None:
                current_best = point["best_weight"]
                point["best_weight"] = (
                    metrics["best_weight"]
                    if current_best is None or metrics["best_weight"] > current_best
                    else current_best
                )

    summaries: list[ExerciseTrendSummaryResponse] = []
    for exercise_id, aggregate in exercise_data.items():
        ordered_points = [aggregate["points"][point_date] for point_date in sorted(aggregate["points"].keys())]
        weighted_points = [
            float(point["best_weight"])
            for point in ordered_points
            if point["best_weight"] is not None
        ]
        latest_best_weight = weighted_points[-1] if weighted_points else None
        previous_best_weight = weighted_points[-2] if len(weighted_points) > 1 else None

        summaries.append(
            ExerciseTrendSummaryResponse(
                exercise_id=exercise_id,
                exercise_name=aggregate["exercise_name"],
                sessions_count=int(aggregate["sessions_count"]),
                last_performed_on=aggregate["last_performed_on"],
                latest_best_weight_kg=round_metric(latest_best_weight) if latest_best_weight is not None else None,
                best_weight_delta_kg=(
                    round_metric(latest_best_weight - previous_best_weight)
                    if latest_best_weight is not None and previous_best_weight is not None
                    else None
                ),
                sparkline_points=[round_metric(point) for point in weighted_points],
            ),
        )

    return sorted(
        summaries,
        key=lambda item: (item.last_performed_on or date.min, item.sessions_count),
        reverse=True,
    )


def build_exercise_detail_series(
    workout_logs: Sequence[WorkoutLog | Any],
    exercise_id: int,
    rep_ranges: Sequence[dict[str, Any]],
    exercise_name: str,
) -> ExerciseTrendDetailResponse:
    workout_logs = [
        workout_log
        for workout_log in workout_logs
        if getattr(workout_log, "is_authoritative", True)
    ]
    points_by_date: dict[date, dict[str, Any]] = defaultdict(
        lambda: {"best_weight": None, "volume": 0.0, "bucket_totals": defaultdict(float)},
    )
    sessions_count = 0

    for workout_log in sorted(workout_logs, key=get_log_performed_date):
        performed_on = get_log_performed_date(workout_log)
        relevant_sets = [
            set_log
            for set_log in getattr(workout_log, "exercise_sets", []) or []
            if get_set_exercise_id(set_log) == exercise_id
        ]
        if not relevant_sets:
            continue

        sessions_count += 1
        point = points_by_date[performed_on]
        for set_log in relevant_sets:
            volume = calculate_weighted_set_volume(set_log)
            if volume <= 0:
                continue

            weight_kg = float(getattr(set_log, "weight_kg", 0) or 0)
            point["volume"] += volume
            if point["best_weight"] is None or weight_kg > point["best_weight"]:
                point["best_weight"] = weight_kg

            bucket = find_rep_range_bucket(rep_ranges, getattr(set_log, "reps_completed", None))
            if bucket:
                point["bucket_totals"][bucket["id"]] += volume

    ordered_dates = sorted(points_by_date.keys())
    series = [
        ExerciseTrendPointResponse(
            performed_on_date=point_date,
            best_weight_kg=round_metric(points_by_date[point_date]["best_weight"])
            if points_by_date[point_date]["best_weight"] is not None
            else None,
            volume_kg=round_metric(points_by_date[point_date]["volume"]),
            reps_bucket_id=(
                max(
                    points_by_date[point_date]["bucket_totals"].items(),
                    key=lambda item: item[1],
                )[0]
                if points_by_date[point_date]["bucket_totals"]
                else None
            ),
        )
        for point_date in ordered_dates
    ]

    personal_best = max(
        (point.best_weight_kg for point in series if point.best_weight_kg is not None),
        default=None,
    )

    return ExerciseTrendDetailResponse(
        exercise_id=exercise_id,
        exercise_name=exercise_name,
        summary=ExerciseTrendDetailSummaryResponse(
            personal_best_kg=round_metric(personal_best) if personal_best is not None else None,
            total_sessions=sessions_count,
            first_logged_at=ordered_dates[0] if ordered_dates else None,
            last_logged_at=ordered_dates[-1] if ordered_dates else None,
        ),
        series=series,
        preferences=serialize_preferences(rep_ranges),
    )


def build_dashboard_response(
    workout_logs: Sequence[WorkoutLog | Any],
    rep_ranges: Sequence[dict[str, Any]],
    range_key: WorkoutAnalyticsRange,
    exercise_names: dict[int, str] | None = None,
    today: date | None = None,
) -> WorkoutAnalyticsDashboardResponse:
    reference_date = today or utc_today()
    range_start = resolve_range_start(range_key, reference_date)
    authoritative_logs = [
        workout_log
        for workout_log in workout_logs
        if getattr(workout_log, "is_authoritative", True)
    ]
    ordered_logs = sorted(
        authoritative_logs,
        key=lambda workout_log: (get_log_performed_date(workout_log), getattr(workout_log, "id", 0)),
        reverse=True,
    )
    filtered_logs = filter_logs_in_range(ordered_logs, range_start)
    duration_values = [
        duration
        for duration in (calculate_duration_minutes(workout_log) for workout_log in filtered_logs)
        if duration is not None
    ]

    return WorkoutAnalyticsDashboardResponse(
        summary=WorkoutAnalyticsSummaryResponse(
            total_sessions=len(ordered_logs),
            sessions_in_range=len(filtered_logs),
            active_days=len({get_log_performed_date(workout_log) for workout_log in filtered_logs}),
            total_volume_kg=round_metric(
                sum(calculate_workout_volume(workout_log) for workout_log in filtered_logs),
            ),
            avg_duration_minutes=round_metric(
                sum(duration_values) / len(duration_values) if duration_values else 0.0,
            ),
        ),
        rep_range_chart=build_rep_range_chart(filtered_logs, rep_ranges, range_start, reference_date),
        exercise_summaries=build_exercise_summaries(filtered_logs, exercise_names or {}),
        recent_history=build_recent_history(ordered_logs),
        preferences=serialize_preferences(rep_ranges),
    )


def fetch_client_workout_logs(db: Session, client_id: int) -> list[WorkoutLog]:
    query = db.query(WorkoutLog)
    if hasattr(query, "options"):
        query = query.options(
            joinedload(WorkoutLog.exercise_sets)
            .joinedload(ExerciseSetLog.day_exercise)
            .joinedload(DayExercise.exercise),
            joinedload(WorkoutLog.training_day).joinedload(TrainingDay.exercises),
        )

    return (
        query
        .filter(
            WorkoutLog.client_id == client_id,
            WorkoutLog.is_authoritative.is_(True),
        )
        .order_by(WorkoutLog.performed_on_date.desc(), WorkoutLog.started_at.desc(), WorkoutLog.id.desc())
        .all()
    )


def get_exercise_or_404(db: Session, exercise_id: int) -> Exercise:
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exercise with id {exercise_id} not found",
        )
    return exercise


@router.get("/me/preferences", response_model=WorkoutAnalyticsPreferencesResponse)
def get_my_workout_analytics_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    preferences = get_or_create_preferences(db, current_user.id)
    return serialize_preferences(preferences.rep_ranges)


@router.put("/me/preferences", response_model=WorkoutAnalyticsPreferencesResponse)
def update_my_workout_analytics_preferences(
    payload: WorkoutAnalyticsPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        normalized_ranges = normalize_rep_ranges(payload.rep_ranges)
    except RepRangeValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    preferences = get_or_create_preferences(db, current_user.id)
    preferences.rep_ranges = normalized_ranges
    preferences.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(preferences)
    return serialize_preferences(preferences.rep_ranges)


@router.get("/me/dashboard", response_model=WorkoutAnalyticsDashboardResponse)
def get_my_workout_analytics_dashboard(
    range: WorkoutAnalyticsRange = Query("12w"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    preferences = get_or_create_preferences(db, current_user.id)
    workout_logs = fetch_client_workout_logs(db, current_user.id)
    exercise_names = build_exercise_name_map(db, workout_logs)
    return build_dashboard_response(
        workout_logs=workout_logs,
        rep_ranges=preferences.rep_ranges,
        range_key=range,
        exercise_names=exercise_names,
    )


@router.get("/me/history", response_model=WorkoutAnalyticsHistoryPageResponse)
def get_my_workout_analytics_history(
    range: WorkoutAnalyticsRange = Query("12w"),
    status_filter: WorkoutAnalyticsHistoryStatusFilter = Query("all", alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_HISTORY_PAGE_SIZE, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workout_logs = fetch_client_workout_logs(db, current_user.id)
    filtered_logs = filter_logs_in_range(workout_logs, resolve_range_start(range))
    ordered_logs = sorted(
        filtered_logs,
        key=lambda workout_log: (get_log_performed_date(workout_log), getattr(workout_log, "id", 0)),
        reverse=True,
    )
    status_logs = filter_workout_logs_by_status(ordered_logs, status_filter)
    return WorkoutAnalyticsHistoryPageResponse(
        total=len(status_logs),
        items=build_recent_history(status_logs, skip=skip, limit=limit),
    )


@router.get("/me/exercises/{exercise_id}", response_model=ExerciseTrendDetailResponse)
def get_my_exercise_trend_detail(
    exercise_id: int,
    range: WorkoutAnalyticsRange = Query("12w"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    preferences = get_or_create_preferences(db, current_user.id)
    exercise = get_exercise_or_404(db, exercise_id)
    workout_logs = fetch_client_workout_logs(db, current_user.id)
    filtered_logs = filter_logs_in_range(workout_logs, resolve_range_start(range))
    return build_exercise_detail_series(
        workout_logs=filtered_logs,
        exercise_id=exercise_id,
        rep_ranges=preferences.rep_ranges,
        exercise_name=exercise.name_es or exercise.name_en,
    )
