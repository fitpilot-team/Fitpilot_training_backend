from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload

from core.dependencies import (
    assert_macrocycle_access,
    assert_training_professional_access,
    get_current_user,
    get_effective_user_role,
)
from models.base import get_db
from models.mesocycle import (
    DayExercise,
    Macrocycle,
    Mesocycle,
    MesocycleStatus,
    Microcycle,
    TrainingDay,
)
from models.exercise import Exercise, ExerciseClass
from models.user import User
from models.workout_log import ExerciseSetLog, WorkoutLog, WorkoutStatus
from schemas.mesocycle import TrainingDayResponse
from schemas.workout_log import (
    ActualMicrocycleMetrics,
    CurrentWorkoutState,
    DayProgress,
    ExerciseProgress,
    ExerciseSetLogCreate,
    ExerciseSetGroupResponse,
    ExerciseSetLogResponse,
    ExerciseSetSegmentPayload,
    MicrocycleDayProgress,
    MicrocycleProgressResponse,
    MicrocycleSessionProgress,
    MissedWorkoutResponse,
    MissedWorkoutsListResponse,
    NextWorkoutResponse,
    NextWorkoutTrainingDay,
    PlannedMicrocycleMetrics,
    WeeklyProgressResponse,
    WorkoutLogCreate,
    WorkoutLogListResponse,
    WorkoutLogResponse,
    WorkoutLogUpdate,
    WorkoutSetLogUpdate,
)

router = APIRouter()

PHASE_ORDER = {"warmup": 0, "main": 1, "cooldown": 2}
REQUIRED_EXERCISE_SET_LOG_COLUMNS = ("segment_index",)
EXERCISE_SET_LOGS_SCHEMA_ERROR_DETAIL = (
    "Training schema mismatch: training.exercise_set_logs.segment_index is missing. "
    "Run scripts/upgrade_training_schema_shared_db.py --apply against the target database "
    "and restart the training backend."
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _extract_scalar_row_value(row: object) -> object:
    if row is None:
        return None
    if isinstance(row, tuple):
        return row[0] if row else None
    mapping = getattr(row, "_mapping", None)
    if mapping:
        if "column_name" in mapping:
            return mapping["column_name"]
        values = list(mapping.values())
        return values[0] if values else None
    return getattr(row, "column_name", row)


def assert_exercise_set_logs_schema_compatibility(db: Session) -> None:
    execute = getattr(db, "execute", None)
    if not callable(execute):
        return

    result = execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'training'
              AND table_name = 'exercise_set_logs'
              AND column_name IN ('segment_index')
            """
        )
    )

    if hasattr(result, "all"):
        rows = result.all()
    elif hasattr(result, "fetchall"):
        rows = result.fetchall()
    else:
        rows = list(result or [])

    available_columns = {
        str(value)
        for value in (_extract_scalar_row_value(row) for row in rows)
        if value is not None
    }
    missing_columns = [
        column_name
        for column_name in REQUIRED_EXERCISE_SET_LOG_COLUMNS
        if column_name not in available_columns
    ]
    if missing_columns:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=EXERCISE_SET_LOGS_SCHEMA_ERROR_DETAIL,
        )


def parse_int_id(raw_id: str | int, field_name: str) -> int:
    try:
        return int(str(raw_id))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} must be a valid integer id",
        ) from exc


def enum_value(value: object) -> str | None:
    if value is None:
        return None
    if hasattr(value, "value"):
        return str(getattr(value, "value"))
    return str(value)


def get_day_name_es(day_number: int) -> str:
    days = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
    return days[(day_number - 1) % 7]


def date_range(start_date: date, end_date: date) -> list[date]:
    if start_date > end_date:
        return []
    total_days = (end_date - start_date).days + 1
    return [start_date + timedelta(days=offset) for offset in range(total_days)]


def normalize_workout_log_defaults(workout_log: WorkoutLog | object) -> None:
    if workout_log is None:
        return

    if getattr(workout_log, "performed_on_date", None) is None:
        started_at = getattr(workout_log, "started_at", None)
        training_day = getattr(workout_log, "training_day", None)
        training_day_date = getattr(training_day, "date", None)
        fallback_date = training_day_date or (started_at.date() if started_at else date.today())
        setattr(workout_log, "performed_on_date", fallback_date)

    if getattr(workout_log, "is_authoritative", None) is None:
        setattr(workout_log, "is_authoritative", True)

    if getattr(workout_log, "exercise_sets", None) is None:
        setattr(workout_log, "exercise_sets", [])
        return

    for set_log in getattr(workout_log, "exercise_sets", []) or []:
        if getattr(set_log, "segment_index", None) is None:
            setattr(set_log, "segment_index", 1)


def serialize_training_day(training_day: TrainingDay) -> TrainingDayResponse:
    return TrainingDayResponse.model_validate(training_day)


def serialize_workout_log(workout_log: WorkoutLog) -> WorkoutLogResponse:
    normalize_workout_log_defaults(workout_log)
    return WorkoutLogResponse.model_validate(workout_log)


def serialize_set_log(set_log: ExerciseSetLog) -> ExerciseSetLogResponse:
    return ExerciseSetLogResponse.model_validate(set_log)


def get_set_number(set_log: ExerciseSetLog | object) -> int:
    raw_value = getattr(set_log, "set_number", None)
    return int(raw_value or 0)


def get_segment_index(set_log: ExerciseSetLog | object) -> int:
    raw_value = getattr(set_log, "segment_index", None)
    return int(raw_value or 1)


def sort_set_logs(left: ExerciseSetLog | object, right: ExerciseSetLog | object) -> int:
    left_key = (
        get_set_number(left),
        get_segment_index(left),
        getattr(left, "completed_at", None) or datetime.min,
        getattr(left, "id", 0) or 0,
    )
    right_key = (
        get_set_number(right),
        get_segment_index(right),
        getattr(right, "completed_at", None) or datetime.min,
        getattr(right, "id", 0) or 0,
    )
    return (left_key > right_key) - (left_key < right_key)


def sort_set_logs_key(set_log: ExerciseSetLog | object) -> tuple[int, int, datetime, int]:
    return (
        get_set_number(set_log),
        get_segment_index(set_log),
        getattr(set_log, "completed_at", None) or datetime.min,
        int(getattr(set_log, "id", 0) or 0),
    )


def group_set_logs_by_set_number(
    set_logs: list[ExerciseSetLog | object],
) -> dict[int, list[ExerciseSetLog | object]]:
    grouped: dict[int, list[ExerciseSetLog | object]] = defaultdict(list)
    for set_log in set_logs:
        set_number = get_set_number(set_log)
        if set_number < 1:
            continue
        grouped[set_number].append(set_log)

    for group in grouped.values():
        group.sort(key=sort_set_logs_key)

    return grouped


def count_contiguous_completed_sets(set_numbers: set[int], total_sets: int) -> int:
    completed_sets = 0
    while completed_sets < total_sets and (completed_sets + 1) in set_numbers:
        completed_sets += 1
    return completed_sets


def build_set_group_response(
    set_logs: list[ExerciseSetLog | object],
) -> ExerciseSetGroupResponse:
    if not set_logs:
        raise ValueError("set_logs must not be empty")

    ordered_logs = sorted(set_logs, key=sort_set_logs_key)
    first_log = ordered_logs[0]
    completed_candidates = [
        getattr(set_log, "completed_at", None)
        for set_log in ordered_logs
        if getattr(set_log, "completed_at", None) is not None
    ]
    weight_candidates = [
        float(getattr(set_log, "weight_kg", 0))
        for set_log in ordered_logs
        if getattr(set_log, "weight_kg", None) is not None
    ]

    return ExerciseSetGroupResponse(
        day_exercise_id=str(getattr(first_log, "day_exercise_id")),
        set_number=get_set_number(first_log),
        segment_count=len(ordered_logs),
        total_reps_completed=sum(int(getattr(set_log, "reps_completed", 0) or 0) for set_log in ordered_logs),
        best_weight_kg=max(weight_candidates) if weight_candidates else None,
        completed_at=max(completed_candidates) if completed_candidates else None,
        segments=[serialize_set_log(set_log) for set_log in ordered_logs],
    )


def resolve_set_segments_payload(set_data: ExerciseSetLogCreate) -> list[ExerciseSetSegmentPayload]:
    if set_data.segments is not None:
        return list(sorted(set_data.segments, key=lambda segment: segment.segment_index))

    return [
        ExerciseSetSegmentPayload(
            segment_index=1,
            reps_completed=int(set_data.reps_completed or 0),
            weight_kg=set_data.weight_kg,
            effort_value=set_data.effort_value,
        )
    ]


def get_active_macrocycle(db: Session, client_id: int) -> Macrocycle | None:
    return (
        db.query(Macrocycle)
        .filter(
            Macrocycle.client_id == client_id,
            Macrocycle.status == MesocycleStatus.ACTIVE,
        )
        .order_by(Macrocycle.start_date.desc(), Macrocycle.id.desc())
        .first()
    )


def get_macrocycle_for_training_day(db: Session, training_day: TrainingDay) -> Macrocycle:
    microcycle = (
        db.query(Microcycle)
        .filter(Microcycle.id == training_day.microcycle_id)
        .first()
    )
    if not microcycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Microcycle with id {training_day.microcycle_id} not found",
        )

    mesocycle = (
        db.query(Mesocycle)
        .filter(Mesocycle.id == microcycle.mesocycle_id)
        .first()
    )
    if not mesocycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mesocycle with id {microcycle.mesocycle_id} not found",
        )

    macrocycle = (
        db.query(Macrocycle)
        .filter(Macrocycle.id == mesocycle.macrocycle_id)
        .first()
    )
    if not macrocycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Macrocycle with id {mesocycle.macrocycle_id} not found",
        )

    return macrocycle


def verify_training_day_access(db: Session, training_day_id: int, current_user: User) -> TrainingDay:
    query = db.query(TrainingDay)
    if hasattr(query, "options"):
        query = query.options(joinedload(TrainingDay.exercises).joinedload(DayExercise.exercise))
    training_day = query.filter(TrainingDay.id == training_day_id).first()
    if not training_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training day with id {training_day_id} not found",
        )

    macrocycle = get_macrocycle_for_training_day(db, training_day)
    assert_macrocycle_access(
        macrocycle=macrocycle,
        current_user=current_user,
        forbidden_detail="Not authorized to access this workout",
    )
    return training_day


def get_workout_log_or_404(db: Session, workout_log_id: int) -> WorkoutLog:
    assert_exercise_set_logs_schema_compatibility(db)
    query = db.query(WorkoutLog)
    if hasattr(query, "options"):
        query = query.options(
            joinedload(WorkoutLog.exercise_sets),
            joinedload(WorkoutLog.training_day)
            .joinedload(TrainingDay.exercises)
            .joinedload(DayExercise.exercise),
        )
    workout_log = query.filter(WorkoutLog.id == workout_log_id).first()
    if not workout_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workout log with id {workout_log_id} not found",
        )
    normalize_workout_log_defaults(workout_log)
    return workout_log


def verify_workout_log_access(db: Session, workout_log_id: int, current_user: User) -> WorkoutLog:
    workout_log = get_workout_log_or_404(db, workout_log_id)
    role = get_effective_user_role(current_user)

    if role == "client":
        if workout_log.client_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this workout",
            )
        return workout_log

    if role in {"trainer", "admin"}:
        assert_training_professional_access(current_user)
        if workout_log.training_day_id is not None:
            verify_training_day_access(db, int(workout_log.training_day_id), current_user)
        return workout_log

    if workout_log.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this workout",
        )
    return workout_log


def verify_workout_log_ownership(workout_log: WorkoutLog, current_user: User) -> None:
    if workout_log.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this workout",
        )


def verify_client_log_access(db: Session, client_id: int, current_user: User) -> None:
    role = get_effective_user_role(current_user)
    if role == "client":
        if current_user.id != client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access these workout logs",
            )
        return

    if role == "admin":
        return

    assert_training_professional_access(current_user)
    linked_macrocycle = (
        db.query(Macrocycle)
        .filter(
            Macrocycle.client_id == client_id,
            Macrocycle.trainer_id == current_user.id,
        )
        .first()
    )
    if not linked_macrocycle:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access these workout logs",
        )


def get_ordered_program_training_days(
    db: Session,
    macrocycle_id: int,
    *,
    include_rest_days: bool,
) -> list[TrainingDay]:
    query = (
        db.query(TrainingDay)
        .join(Microcycle, TrainingDay.microcycle_id == Microcycle.id)
        .join(Mesocycle, Microcycle.mesocycle_id == Mesocycle.id)
        .filter(Mesocycle.macrocycle_id == macrocycle_id)
        .order_by(
            Mesocycle.block_number,
            Microcycle.week_number,
            TrainingDay.day_number,
            TrainingDay.session_index,
            TrainingDay.id,
        )
    )
    if not include_rest_days:
        query = query.filter(TrainingDay.rest_day.is_(False))
    return query.all()


def get_ordered_macrocycle_microcycles(db: Session, macrocycle_id: int) -> list[Microcycle]:
    return (
        db.query(Microcycle)
        .join(Mesocycle, Microcycle.mesocycle_id == Mesocycle.id)
        .filter(Mesocycle.macrocycle_id == macrocycle_id)
        .order_by(Mesocycle.block_number, Microcycle.week_number, Microcycle.id)
        .all()
    )


def get_authoritative_workout_log(
    db: Session,
    *,
    client_id: int,
    training_day_id: int,
) -> WorkoutLog | None:
    workout_log = (
        db.query(WorkoutLog)
        .filter(
            WorkoutLog.client_id == client_id,
            WorkoutLog.training_day_id == training_day_id,
            WorkoutLog.is_authoritative.is_(True),
        )
        .order_by(WorkoutLog.started_at.desc(), WorkoutLog.id.desc())
        .first()
    )
    if workout_log:
        normalize_workout_log_defaults(workout_log)
    return workout_log


def get_authoritative_logs_for_training_days(
    db: Session,
    *,
    client_id: int,
    training_day_ids: list[int],
) -> dict[int, WorkoutLog]:
    if not training_day_ids:
        return {}

    assert_exercise_set_logs_schema_compatibility(db)
    query = db.query(WorkoutLog)
    if hasattr(query, "options"):
        query = query.options(joinedload(WorkoutLog.exercise_sets))
    workout_logs = (
        query.filter(
            WorkoutLog.client_id == client_id,
            WorkoutLog.training_day_id.in_(training_day_ids),
            WorkoutLog.is_authoritative.is_(True),
        )
        .order_by(WorkoutLog.training_day_id, WorkoutLog.started_at.desc(), WorkoutLog.id.desc())
        .all()
    )

    result: dict[int, WorkoutLog] = {}
    for workout_log in workout_logs:
        normalize_workout_log_defaults(workout_log)
        training_day_id = int(workout_log.training_day_id)
        if training_day_id not in result:
            result[training_day_id] = workout_log
    return result


def get_completed_training_day_ids(db: Session, client_id: int, training_day_ids: list[int]) -> set[int]:
    if not training_day_ids:
        return set()

    rows = (
        db.query(WorkoutLog.training_day_id)
        .filter(
            WorkoutLog.client_id == client_id,
            WorkoutLog.training_day_id.in_(training_day_ids),
            WorkoutLog.is_authoritative.is_(True),
            WorkoutLog.status == WorkoutStatus.COMPLETED,
        )
        .all()
    )

    completed_ids: set[int] = set()
    for row in rows:
        if isinstance(row, tuple):
            value = row[0]
        else:
            value = getattr(row, "training_day_id", row)
        if value is not None:
            completed_ids.add(int(value))
    return completed_ids


def get_completed_set_counts(db: Session, *, workout_log_ids: list[int]) -> dict[int, int]:
    if not workout_log_ids:
        return {}

    assert_exercise_set_logs_schema_compatibility(db)
    set_logs = (
        db.query(ExerciseSetLog)
        .filter(ExerciseSetLog.workout_log_id.in_(workout_log_ids))
        .all()
    )

    grouped_pairs: dict[int, set[tuple[int, int]]] = defaultdict(set)
    for set_log in set_logs:
        workout_log_id = getattr(set_log, "workout_log_id", None)
        day_exercise_id = getattr(set_log, "day_exercise_id", None)
        set_number = getattr(set_log, "set_number", None)
        if workout_log_id is None or day_exercise_id is None or set_number is None:
            continue
        grouped_pairs[int(workout_log_id)].add((int(day_exercise_id), int(set_number)))

    return {
        workout_log_id: len(completed_pairs)
        for workout_log_id, completed_pairs in grouped_pairs.items()
    }


def get_ordered_exercises_for_training_day(training_day: TrainingDay) -> list[DayExercise]:
    return sorted(
        list(training_day.exercises or []),
        key=lambda exercise: (
            PHASE_ORDER.get(enum_value(getattr(exercise, "phase", None)) or "main", 99),
            getattr(exercise, "order_index", 0),
            getattr(exercise, "id", 0),
        ),
    )


def calculate_training_day_total_sets(training_day: TrainingDay) -> int:
    return sum(int(getattr(exercise, "sets", 0) or 0) for exercise in training_day.exercises or [])


def calculate_completion_percentage(total_sets: int, completed_sets: int) -> float:
    if total_sets <= 0:
        return 0.0
    return round((completed_sets / total_sets) * 100, 2)


def resolve_exercise_name(day_exercise: DayExercise) -> str:
    exercise = getattr(day_exercise, "exercise", None)
    if exercise is None:
        return f"Exercise {day_exercise.id}"
    get_name = getattr(exercise, "get_name", None)
    if callable(get_name):
        return get_name("es")
    return exercise.name_es or exercise.name_en


def is_cardio_day_exercise(day_exercise: DayExercise) -> bool:
    """Matches frontend isCardioExercise logic."""
    if not day_exercise:
        return False
    
    exercise = getattr(day_exercise, "exercise", None)
    if exercise:
        if exercise.exercise_class == ExerciseClass.CARDIO:
            return True
        if getattr(exercise, "cardio_subclass", None):
            return True
            
    return any([
        day_exercise.duration_seconds is not None,
        day_exercise.intensity_zone is not None,
        day_exercise.distance_meters is not None,
        day_exercise.target_calories is not None,
        day_exercise.intervals is not None,
        day_exercise.work_seconds is not None,
        day_exercise.interval_rest_seconds is not None,
    ])


def get_cardio_effective_sets(day_exercise: DayExercise) -> int:
    """Matches frontend getCardioEffectiveSets logic."""
    if not day_exercise:
        return 1
        
    sets = day_exercise.sets or 1
    has_intervals = (day_exercise.intervals or 0) > 0
    
    # HIIT with intervals: each "set" is a round of intervals
    if has_intervals and sets > 1:
        return sets
        
    # Steady-state cardio: always 1 continuous block
    return 1


def build_exercise_progress(training_day: TrainingDay, workout_log: WorkoutLog) -> list[ExerciseProgress]:
    set_logs_by_day_exercise: dict[int, list[ExerciseSetLog]] = defaultdict(list)
    for set_log in workout_log.exercise_sets or []:
        if set_log.day_exercise_id is None:
            continue
        set_logs_by_day_exercise[int(set_log.day_exercise_id)].append(set_log)

    exercise_progress: list[ExerciseProgress] = []
    for day_exercise in get_ordered_exercises_for_training_day(training_day):
        set_logs = sorted(set_logs_by_day_exercise.get(int(day_exercise.id), []), key=sort_set_logs_key)
        grouped_set_logs = group_set_logs_by_set_number(set_logs)
        
        # Calculate total sets considering cardio specific logic
        if is_cardio_day_exercise(day_exercise):
            total_sets = get_cardio_effective_sets(day_exercise)
        else:
            total_sets = int(day_exercise.sets or 0)
            
        completed_sets = count_contiguous_completed_sets(set(grouped_set_logs.keys()), total_sets)
        exercise_progress.append(
            ExerciseProgress(
                day_exercise_id=str(day_exercise.id),
                exercise_name=resolve_exercise_name(day_exercise),
                total_sets=total_sets,
                completed_sets=completed_sets,
                is_completed=(total_sets > 0 and completed_sets >= total_sets),
                sets_data=[
                    build_set_group_response(grouped_set_logs[set_number])
                    for set_number in sorted(grouped_set_logs.keys())
                ],
            )
        )
    return exercise_progress


def build_current_workout_state(workout_log: WorkoutLog) -> CurrentWorkoutState:
    training_day = workout_log.training_day
    if training_day is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The workout log is not linked to a training day",
        )

    exercise_progress = build_exercise_progress(training_day, workout_log)
    completed_exercises = sum(1 for item in exercise_progress if item.is_completed)
    return CurrentWorkoutState(
        workout_log=serialize_workout_log(workout_log),
        training_day=serialize_training_day(training_day),
        training_day_name=training_day.name,
        training_day_focus=training_day.focus,
        total_exercises=len(exercise_progress),
        completed_exercises=completed_exercises,
        exercises_progress=exercise_progress,
    )


def get_active_microcycle_for_dashboard(
    db: Session,
    macrocycle: Macrocycle,
    *,
    client_id: int,
) -> Microcycle | None:
    ordered_days = get_ordered_program_training_days(
        db,
        macrocycle_id=int(macrocycle.id),
        include_rest_days=False,
    )
    completed_ids = get_completed_training_day_ids(
        db,
        client_id=client_id,
        training_day_ids=[int(training_day.id) for training_day in ordered_days],
    )

    target_microcycle_id: int | None = None
    for training_day in ordered_days:
        if int(training_day.id) not in completed_ids:
            target_microcycle_id = int(training_day.microcycle_id)
            break

    if target_microcycle_id is None and ordered_days:
        target_microcycle_id = int(ordered_days[-1].microcycle_id)

    if target_microcycle_id is None:
        ordered_microcycles = get_ordered_macrocycle_microcycles(db, int(macrocycle.id))
        if not ordered_microcycles:
            return None
        target_microcycle_id = int(ordered_microcycles[-1].id)

    return (
        db.query(Microcycle)
        .options(
            joinedload(Microcycle.training_days)
            .joinedload(TrainingDay.exercises)
            .joinedload(DayExercise.exercise)
        )
        .filter(Microcycle.id == target_microcycle_id)
        .first()
    )


def build_microcycle_progress(
    db: Session,
    *,
    microcycle: Microcycle,
    client_id: int,
) -> MicrocycleProgressResponse:
    ordered_days = sorted(
        list(microcycle.training_days or []),
        key=lambda training_day: (
            training_day.day_number,
            training_day.session_index,
            training_day.id,
        ),
    )
    planned_training_days = [training_day for training_day in ordered_days if not training_day.rest_day]
    training_day_ids = [int(training_day.id) for training_day in planned_training_days]
    logs_by_training_day = get_authoritative_logs_for_training_days(
        db,
        client_id=client_id,
        training_day_ids=training_day_ids,
    )
    completed_set_counts = get_completed_set_counts(
        db,
        workout_log_ids=[int(workout_log.id) for workout_log in logs_by_training_day.values()],
    )

    total_planned_sessions = len(planned_training_days)
    completed_planned_sessions = 0
    next_session_position: Optional[int] = None

    all_dates = set(date_range(microcycle.start_date, microcycle.end_date))
    for workout_log in logs_by_training_day.values():
        normalize_workout_log_defaults(workout_log)
        if workout_log.performed_on_date:
            all_dates.add(workout_log.performed_on_date)

    day_entries: dict[date, dict[str, object]] = {}
    for current_date in sorted(all_dates):
        is_planned_date = microcycle.start_date <= current_date <= microcycle.end_date
        day_entries[current_date] = {
            "date": current_date,
            "day_number": ((current_date - microcycle.start_date).days + 1) if is_planned_date else None,
            "planned_sessions": 0,
            "completed_planned_sessions": 0,
            "actual_logs_count": 0,
            "has_partial_session": False,
            "is_rest_day": False,
            "has_non_rest_planned_session": False,
            "is_planned_date": is_planned_date,
            "sessions": [],
        }

    actual_day_counts = Counter(
        workout_log.performed_on_date
        for workout_log in logs_by_training_day.values()
        if workout_log.performed_on_date is not None
    )
    for performed_on_date, count in actual_day_counts.items():
        day_entries[performed_on_date]["actual_logs_count"] = count

    for position, training_day in enumerate(planned_training_days, start=1):
        workout_log = logs_by_training_day.get(int(training_day.id))
        completed_sets = completed_set_counts.get(int(workout_log.id), 0) if workout_log else 0
        total_sets = calculate_training_day_total_sets(training_day)
        completion_percentage = calculate_completion_percentage(total_sets, completed_sets)
        actual_status = enum_value(getattr(workout_log, "status", None)) or "not_started"

        if workout_log and actual_status == WorkoutStatus.COMPLETED.value:
            planned_status = "completed"
            completed_planned_sessions += 1
        elif workout_log and (actual_status == WorkoutStatus.IN_PROGRESS.value or completion_percentage > 0):
            planned_status = "partial"
        elif workout_log and actual_status == WorkoutStatus.ABANDONED.value:
            planned_status = "partial"
        else:
            planned_status = "pending"

        if next_session_position is None and planned_status != "completed":
            next_session_position = position

        planned_day_entry = day_entries[training_day.date]
        planned_day_entry["planned_sessions"] = int(planned_day_entry["planned_sessions"]) + 1
        planned_day_entry["has_non_rest_planned_session"] = True
        if planned_status == "completed":
            planned_day_entry["completed_planned_sessions"] = int(planned_day_entry["completed_planned_sessions"]) + 1
        if planned_status == "partial":
            planned_day_entry["has_partial_session"] = True

        session_payload = MicrocycleSessionProgress(
            training_day_id=str(training_day.id),
            workout_log_id=str(workout_log.id) if workout_log else None,
            session_index=int(training_day.session_index),
            session_label=training_day.session_label,
            name=training_day.name,
            focus=training_day.focus,
            planned_status=planned_status,
            actual_status=actual_status,
            completion_percentage=completion_percentage,
            performed_on_date=workout_log.performed_on_date if workout_log else None,
        )
        day_entries[training_day.date]["sessions"].append(session_payload)

        if workout_log and workout_log.performed_on_date and workout_log.performed_on_date != training_day.date:
            actual_day_entry = day_entries[workout_log.performed_on_date]
            actual_day_entry["has_partial_session"] = bool(actual_day_entry["has_partial_session"]) or planned_status == "partial"
            actual_day_entry["sessions"].append(session_payload)

    for training_day in ordered_days:
        if not training_day.rest_day:
            continue
        rest_day_entry = day_entries.setdefault(
            training_day.date,
            {
                "date": training_day.date,
                "day_number": training_day.day_number,
                "planned_sessions": 0,
                "completed_planned_sessions": 0,
                "actual_logs_count": 0,
                "has_partial_session": False,
                "is_rest_day": True,
                "has_non_rest_planned_session": False,
                "is_planned_date": True,
                "sessions": [],
            },
        )
        if not rest_day_entry["has_non_rest_planned_session"]:
            rest_day_entry["is_rest_day"] = True

    if next_session_position is None and total_planned_sessions > 0:
        next_session_position = total_planned_sessions

    days = [
        MicrocycleDayProgress(
            date=entry["date"],
            day_number=entry["day_number"],
            planned_sessions=int(entry["planned_sessions"]),
            completed_planned_sessions=int(entry["completed_planned_sessions"]),
            actual_logs_count=int(entry["actual_logs_count"]),
            has_partial_session=bool(entry["has_partial_session"]),
            is_rest_day=bool(entry["is_rest_day"]) and not bool(entry["has_non_rest_planned_session"]),
            is_planned_date=bool(entry["is_planned_date"]),
            sessions=sorted(
                list(entry["sessions"]),
                key=lambda session: (
                    session.session_index,
                    session.workout_log_id or "",
                    session.training_day_id,
                ),
            ),
        )
        for entry in sorted(day_entries.values(), key=lambda item: item["date"])
    ]

    actual_logs = list(logs_by_training_day.values())
    return MicrocycleProgressResponse(
        microcycle_id=str(microcycle.id),
        microcycle_name=microcycle.name,
        start_date=microcycle.start_date,
        end_date=microcycle.end_date,
        planned_metrics=PlannedMicrocycleMetrics(
            total_planned_sessions=total_planned_sessions,
            completed_planned_sessions=completed_planned_sessions,
            next_session_position=next_session_position,
            completion_percentage=calculate_completion_percentage(
                total_planned_sessions,
                completed_planned_sessions,
            ),
        ),
        actual_metrics=ActualMicrocycleMetrics(
            executed_sessions=len(actual_logs),
            active_days=len({workout_log.performed_on_date for workout_log in actual_logs}),
            double_session_days=sum(1 for count in actual_day_counts.values() if count > 1),
        ),
        days=days,
    )


@router.get("/next", response_model=NextWorkoutResponse)
def get_next_workout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if get_effective_user_role(current_user) != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only clients can query the next workout",
        )

    macrocycle = get_active_macrocycle(db, current_user.id)
    if not macrocycle:
        return NextWorkoutResponse(all_completed=False)

    training_days = get_ordered_program_training_days(
        db,
        macrocycle_id=int(macrocycle.id),
        include_rest_days=False,
    )
    if not training_days:
        return NextWorkoutResponse(all_completed=False)

    completed_ids = get_completed_training_day_ids(
        db,
        client_id=current_user.id,
        training_day_ids=[int(training_day.id) for training_day in training_days],
    )

    for index, training_day in enumerate(training_days, start=1):
        if int(training_day.id) in completed_ids:
            continue
        return NextWorkoutResponse(
            training_day=NextWorkoutTrainingDay(
                id=str(training_day.id),
                microcycle_id=str(getattr(training_day, "microcycle_id", "")),
                date=getattr(training_day, "date", date.today()),
                session_index=int(getattr(training_day, "session_index", 1) or 1),
                session_label=getattr(training_day, "session_label", None),
                name=training_day.name,
                focus=training_day.focus,
                day_number=training_day.day_number,
                rest_day=bool(training_day.rest_day),
            ),
            position=index,
            total=len(training_days),
            all_completed=False,
        )

    return NextWorkoutResponse(
        training_day=None,
        position=len(training_days),
        total=len(training_days),
        all_completed=True,
    )


@router.get("/progress/microcycle/current", response_model=MicrocycleProgressResponse)
def get_current_microcycle_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if get_effective_user_role(current_user) != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only clients can query microcycle progress",
        )

    macrocycle = get_active_macrocycle(db, current_user.id)
    if not macrocycle:
        return MicrocycleProgressResponse(
            planned_metrics=PlannedMicrocycleMetrics(),
            actual_metrics=ActualMicrocycleMetrics(),
            days=[],
        )

    microcycle = get_active_microcycle_for_dashboard(
        db,
        macrocycle=macrocycle,
        client_id=current_user.id,
    )
    if not microcycle:
        return MicrocycleProgressResponse(
            planned_metrics=PlannedMicrocycleMetrics(),
            actual_metrics=ActualMicrocycleMetrics(),
            days=[],
        )

    return build_microcycle_progress(db, microcycle=microcycle, client_id=current_user.id)


@router.post("", response_model=WorkoutLogResponse, status_code=status.HTTP_201_CREATED)
def start_workout(
    workout_data: WorkoutLogCreate,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if get_effective_user_role(current_user) != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only clients can start workouts",
        )

    training_day_id = parse_int_id(workout_data.training_day_id, "training_day_id")
    verify_training_day_access(db, training_day_id, current_user)
    existing_log = get_authoritative_workout_log(
        db,
        client_id=current_user.id,
        training_day_id=training_day_id,
    )

    if existing_log:
        response.status_code = status.HTTP_200_OK
        normalize_workout_log_defaults(existing_log)

        if enum_value(existing_log.status) == WorkoutStatus.ABANDONED.value:
            existing_log.status = WorkoutStatus.IN_PROGRESS
            existing_log.abandon_reason = None
            existing_log.abandon_notes = None
            existing_log.rescheduled_to_date = None
            existing_log.completed_at = None
            existing_log.performed_on_date = date.today()
            if existing_log.started_at is None:
                existing_log.started_at = utc_now()
            db.commit()
            db.refresh(existing_log)

        return serialize_workout_log(existing_log)

    workout_log = WorkoutLog(
        client_id=current_user.id,
        training_day_id=training_day_id,
        started_at=utc_now(),
        performed_on_date=date.today(),
        is_authoritative=True,
        status=WorkoutStatus.IN_PROGRESS,
        notes=workout_data.notes,
    )
    db.add(workout_log)
    db.commit()
    db.refresh(workout_log)
    return serialize_workout_log(workout_log)


@router.get("/client/{client_id}", response_model=WorkoutLogListResponse)
def list_client_workout_logs(
    client_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_client_log_access(db, client_id, current_user)

    query = (
        db.query(WorkoutLog)
        .filter(
            WorkoutLog.client_id == client_id,
            WorkoutLog.is_authoritative.is_(True),
        )
        .order_by(WorkoutLog.started_at.desc(), WorkoutLog.id.desc())
    )
    total = query.count()
    workout_logs = query.offset(skip).limit(limit).all()
    return WorkoutLogListResponse(
        total=total,
        workout_logs=[serialize_workout_log(workout_log) for workout_log in workout_logs],
    )


@router.get("/progress/weekly", response_model=WeeklyProgressResponse)
def get_weekly_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if get_effective_user_role(current_user) != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only clients can query weekly progress",
        )

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    macrocycle = get_active_macrocycle(db, current_user.id)
    days: list[DayProgress] = []
    total_workouts_planned = 0
    total_workouts_completed = 0

    training_days_by_date: dict[date, list[TrainingDay]] = defaultdict(list)
    logs_by_training_day: dict[int, WorkoutLog] = {}
    completed_set_counts: dict[int, int] = {}

    if macrocycle:
        weekly_training_days = (
            db.query(TrainingDay)
            .options(joinedload(TrainingDay.exercises))
            .join(Microcycle, TrainingDay.microcycle_id == Microcycle.id)
            .join(Mesocycle, Microcycle.mesocycle_id == Mesocycle.id)
            .filter(
                Mesocycle.macrocycle_id == macrocycle.id,
                TrainingDay.date >= week_start,
                TrainingDay.date <= week_end,
            )
            .order_by(TrainingDay.date, TrainingDay.session_index, TrainingDay.id)
            .all()
        )
        for training_day in weekly_training_days:
            training_days_by_date[training_day.date].append(training_day)

        planned_training_day_ids = [
            int(training_day.id)
            for training_day in weekly_training_days
            if not training_day.rest_day
        ]
        logs_by_training_day = get_authoritative_logs_for_training_days(
            db,
            client_id=current_user.id,
            training_day_ids=planned_training_day_ids,
        )
        completed_set_counts = get_completed_set_counts(
            db,
            workout_log_ids=[int(workout_log.id) for workout_log in logs_by_training_day.values()],
        )
        total_workouts_planned = len(planned_training_day_ids)
        total_workouts_completed = sum(
            1
            for workout_log in logs_by_training_day.values()
            if enum_value(workout_log.status) == WorkoutStatus.COMPLETED.value
        )

    for offset in range(7):
        current_date = week_start + timedelta(days=offset)
        date_training_days = training_days_by_date.get(current_date, [])
        non_rest_days = [training_day for training_day in date_training_days if not training_day.rest_day]
        rest_only = bool(date_training_days) and not non_rest_days

        total_sets = sum(calculate_training_day_total_sets(training_day) for training_day in non_rest_days)
        completed_sets = 0
        representative_training_day = non_rest_days[0] if non_rest_days else None
        for training_day in non_rest_days:
            workout_log = logs_by_training_day.get(int(training_day.id))
            if workout_log:
                completed_sets += completed_set_counts.get(int(workout_log.id), 0)

        training_day_name: Optional[str] = None
        if len(non_rest_days) == 1:
            training_day_name = non_rest_days[0].name
        elif len(non_rest_days) > 1:
            training_day_name = f"{len(non_rest_days)} sesiones"

        days.append(
            DayProgress(
                date=current_date,
                day_number=offset + 1,
                day_name=get_day_name_es(offset + 1),
                training_day_id=str(representative_training_day.id) if representative_training_day else None,
                training_day_name=training_day_name,
                total_sets=total_sets,
                completed_sets=completed_sets,
                completion_percentage=calculate_completion_percentage(total_sets, completed_sets),
                has_workout=bool(non_rest_days),
                is_rest_day=rest_only,
            )
        )

    return WeeklyProgressResponse(
        week_start=week_start,
        week_end=week_end,
        days=days,
        total_workouts_planned=total_workouts_planned,
        total_workouts_completed=total_workouts_completed,
        overall_completion_percentage=calculate_completion_percentage(
            total_workouts_planned,
            total_workouts_completed,
        ),
    )


@router.get("/today", response_model=Optional[WorkoutLogResponse])
def get_today_workout_log(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if get_effective_user_role(current_user) != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only clients can query today's workout",
        )

    macrocycle = get_active_macrocycle(db, current_user.id)
    if not macrocycle:
        return None

    today_training_day = (
        db.query(TrainingDay)
        .join(Microcycle, TrainingDay.microcycle_id == Microcycle.id)
        .join(Mesocycle, Microcycle.mesocycle_id == Mesocycle.id)
        .filter(
            Mesocycle.macrocycle_id == macrocycle.id,
            TrainingDay.date == date.today(),
            TrainingDay.rest_day.is_(False),
        )
        .order_by(TrainingDay.session_index, TrainingDay.id)
        .first()
    )
    if not today_training_day:
        return None

    workout_log = get_authoritative_workout_log(
        db,
        client_id=current_user.id,
        training_day_id=int(today_training_day.id),
    )
    return serialize_workout_log(workout_log) if workout_log else None


@router.get("/missed", response_model=MissedWorkoutsListResponse)
def get_missed_workouts(
    days_back: int = Query(14, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if get_effective_user_role(current_user) != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only clients can query missed workouts",
        )

    macrocycle = get_active_macrocycle(db, current_user.id)
    if not macrocycle:
        return MissedWorkoutsListResponse(total=0, missed_workouts=[])

    today = date.today()
    start_date = today - timedelta(days=days_back)
    training_days = (
        db.query(TrainingDay)
        .join(Microcycle, TrainingDay.microcycle_id == Microcycle.id)
        .join(Mesocycle, Microcycle.mesocycle_id == Mesocycle.id)
        .filter(
            Mesocycle.macrocycle_id == macrocycle.id,
            TrainingDay.rest_day.is_(False),
            TrainingDay.date < today,
            TrainingDay.date >= start_date,
        )
        .order_by(TrainingDay.date.desc(), TrainingDay.session_index.desc(), TrainingDay.id.desc())
        .all()
    )
    logs_by_training_day = get_authoritative_logs_for_training_days(
        db,
        client_id=current_user.id,
        training_day_ids=[int(training_day.id) for training_day in training_days],
    )

    missed_workouts: list[MissedWorkoutResponse] = []
    for training_day in training_days:
        workout_log = logs_by_training_day.get(int(training_day.id))
        workout_status = enum_value(getattr(workout_log, "status", None))
        if workout_status == WorkoutStatus.COMPLETED.value:
            continue

        missed_workouts.append(
            MissedWorkoutResponse(
                training_day_id=str(training_day.id),
                training_day_name=training_day.name,
                scheduled_date=training_day.date,
                days_overdue=(today - training_day.date).days,
                status="abandoned" if workout_status == WorkoutStatus.ABANDONED.value else "never_started",
                abandon_reason=getattr(workout_log, "abandon_reason", None),
                can_reschedule=True,
            )
        )

    return MissedWorkoutsListResponse(
        total=len(missed_workouts),
        missed_workouts=missed_workouts,
    )


@router.get("/{workout_log_id}", response_model=WorkoutLogResponse)
def get_workout_log(
    workout_log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workout_log = verify_workout_log_access(db, workout_log_id, current_user)
    return serialize_workout_log(workout_log)


@router.get("/{workout_log_id}/state", response_model=CurrentWorkoutState)
def get_workout_state(
    workout_log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workout_log = verify_workout_log_access(db, workout_log_id, current_user)
    return build_current_workout_state(workout_log)


@router.patch("/{workout_log_id}", response_model=WorkoutLogResponse)
def update_workout_log(
    workout_log_id: int,
    workout_data: WorkoutLogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workout_log = verify_workout_log_access(db, workout_log_id, current_user)
    if get_effective_user_role(current_user) == "client":
        verify_workout_log_ownership(workout_log, current_user)

    update_data = workout_data.model_dump(exclude_unset=True)
    new_status = update_data.get("status")

    for field, value in update_data.items():
        setattr(workout_log, field, value)

    if new_status == WorkoutStatus.COMPLETED:
        workout_log.completed_at = workout_log.completed_at or utc_now()
    elif new_status == WorkoutStatus.IN_PROGRESS:
        workout_log.completed_at = None
        workout_log.performed_on_date = date.today()
    elif new_status == WorkoutStatus.ABANDONED:
        workout_log.completed_at = None

    db.commit()
    db.refresh(workout_log)
    return serialize_workout_log(workout_log)


@router.post("/{workout_log_id}/reopen", response_model=WorkoutLogResponse)
def reopen_workout_log(
    workout_log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workout_log = verify_workout_log_access(db, workout_log_id, current_user)
    if get_effective_user_role(current_user) == "client":
        verify_workout_log_ownership(workout_log, current_user)

    workout_log.status = WorkoutStatus.IN_PROGRESS
    workout_log.completed_at = None
    workout_log.abandon_reason = None
    workout_log.abandon_notes = None
    workout_log.rescheduled_to_date = None
    workout_log.performed_on_date = date.today()
    if workout_log.started_at is None:
        workout_log.started_at = utc_now()

    db.commit()
    db.refresh(workout_log)
    return serialize_workout_log(workout_log)


@router.post("/{workout_log_id}/sets", response_model=ExerciseSetGroupResponse, status_code=status.HTTP_201_CREATED)
def log_exercise_set(
    workout_log_id: int,
    set_data: ExerciseSetLogCreate,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workout_log = verify_workout_log_access(db, workout_log_id, current_user)
    if get_effective_user_role(current_user) == "client":
        verify_workout_log_ownership(workout_log, current_user)

    if enum_value(workout_log.status) != WorkoutStatus.IN_PROGRESS.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Workout must be reopened before editing sets",
        )

    day_exercise_id = parse_int_id(set_data.day_exercise_id, "day_exercise_id")
    day_exercise = db.query(DayExercise).filter(DayExercise.id == day_exercise_id).first()
    if not day_exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Day exercise with id {day_exercise_id} not found",
        )
    if int(day_exercise.training_day_id) != int(workout_log.training_day_id or 0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The exercise does not belong to the workout training day",
        )

    try:
        existing_sets = (
            db.query(ExerciseSetLog)
            .filter(
                ExerciseSetLog.workout_log_id == workout_log.id,
                ExerciseSetLog.day_exercise_id == day_exercise_id,
                ExerciseSetLog.set_number == set_data.set_number,
            )
            .all()
        )
    except Exception:
        existing_sets = []

    if existing_sets:
        response.status_code = status.HTTP_200_OK
        for existing_set in existing_sets:
            db.delete(existing_set)
        db.flush()

    timestamp = utc_now()
    created_segments: list[ExerciseSetLog] = []
    for segment in resolve_set_segments_payload(set_data):
        set_log = ExerciseSetLog(
            workout_log_id=workout_log.id,
            exercise_id=day_exercise.exercise_id,
            day_exercise_id=day_exercise_id,
            set_number=set_data.set_number,
            segment_index=segment.segment_index,
            reps_completed=segment.reps_completed,
            weight_kg=segment.weight_kg,
            effort_value=segment.effort_value,
            completed_at=timestamp,
        )
        db.add(set_log)
        created_segments.append(set_log)

    db.commit()
    for created_segment in created_segments:
        db.refresh(created_segment)

    return build_set_group_response(created_segments)


@router.patch("/{workout_log_id}/sets/{set_log_id}", response_model=ExerciseSetLogResponse)
def update_exercise_set(
    workout_log_id: int,
    set_log_id: int,
    set_data: WorkoutSetLogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workout_log = verify_workout_log_access(db, workout_log_id, current_user)
    if get_effective_user_role(current_user) == "client":
        verify_workout_log_ownership(workout_log, current_user)

    if enum_value(workout_log.status) != WorkoutStatus.IN_PROGRESS.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Workout must be reopened before editing sets",
        )

    set_log = (
        db.query(ExerciseSetLog)
        .filter(
            ExerciseSetLog.id == set_log_id,
            ExerciseSetLog.workout_log_id == workout_log.id,
        )
        .first()
    )
    if not set_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exercise set log with id {set_log_id} not found",
        )

    for field, value in set_data.model_dump(exclude_unset=True).items():
        setattr(set_log, field, value)
    set_log.completed_at = utc_now()

    db.commit()
    db.refresh(set_log)
    return serialize_set_log(set_log)


@router.delete("/{workout_log_id}/sets/{set_log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exercise_set(
    workout_log_id: int,
    set_log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workout_log = verify_workout_log_access(db, workout_log_id, current_user)
    if get_effective_user_role(current_user) == "client":
        verify_workout_log_ownership(workout_log, current_user)

    if enum_value(workout_log.status) != WorkoutStatus.IN_PROGRESS.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Workout must be reopened before editing sets",
        )

    set_log = (
        db.query(ExerciseSetLog)
        .filter(
            ExerciseSetLog.id == set_log_id,
            ExerciseSetLog.workout_log_id == workout_log.id,
        )
        .first()
    )
    if not set_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exercise set log with id {set_log_id} not found",
        )

    db.delete(set_log)
    db.commit()
    return None


@router.delete(
    "/{workout_log_id}/day-exercises/{day_exercise_id}/sets/{set_number}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_exercise_set_group(
    workout_log_id: int,
    day_exercise_id: int,
    set_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workout_log = verify_workout_log_access(db, workout_log_id, current_user)
    if get_effective_user_role(current_user) == "client":
        verify_workout_log_ownership(workout_log, current_user)

    if enum_value(workout_log.status) != WorkoutStatus.IN_PROGRESS.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Workout must be reopened before editing sets",
        )

    set_logs = (
        db.query(ExerciseSetLog)
        .filter(
            ExerciseSetLog.workout_log_id == workout_log.id,
            ExerciseSetLog.day_exercise_id == day_exercise_id,
            ExerciseSetLog.set_number == set_number,
        )
        .all()
    )
    if not set_logs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exercise set group with day_exercise_id={day_exercise_id} and set_number={set_number} not found",
        )

    for set_log in set_logs:
        db.delete(set_log)

    db.commit()
    return None
