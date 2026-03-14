import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, date
from typing import Optional, Sequence
from models.base import get_db
from models.user import User
from models.mesocycle import Macrocycle, Mesocycle, Microcycle, TrainingDay, DayExercise
from models.workout_log import WorkoutLog, ExerciseSetLog, WorkoutStatus
from models.mesocycle import MesocycleStatus
from schemas.workout_log import (
    WorkoutLogCreate,
    WorkoutLogUpdate,
    WorkoutLogResponse,
    WorkoutLogListResponse,
    ExerciseSetLogCreate,
    ExerciseSetLogResponse,
    WeeklyProgressResponse,
    DayProgress,
    CurrentWorkoutState,
    ExerciseProgress,
    NextWorkoutResponse,
    NextWorkoutTrainingDay,
    MissedWorkoutResponse,
    MissedWorkoutsListResponse
)
from core.dependencies import (
    get_current_user,
    get_effective_user_role,
    get_training_day_or_404,
    parse_numeric_identifier,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def get_day_name_es(day_number: int) -> str:
    """Get Spanish day name from day number (1=Monday)"""
    days = ["Lun", "Mar", "Mier", "Jue", "Vie", "Sab", "Dom"]
    return days[(day_number - 1) % 7]


def build_next_workout_response(
    training_days: Sequence[TrainingDay],
    completed_ids: set[str],
) -> NextWorkoutResponse:
    if not training_days:
        return NextWorkoutResponse(
            training_day=None,
            position=None,
            total=None,
            all_completed=False,
            reason="no_training_days",
        )

    total_training_days = len(training_days)

    for index, training_day in enumerate(training_days):
        if str(training_day.id) in completed_ids:
            continue

        return NextWorkoutResponse(
            training_day=NextWorkoutTrainingDay(
                id=str(training_day.id),
                name=training_day.name,
                focus=training_day.focus,
                day_number=training_day.day_number,
                rest_day=training_day.rest_day,
            ),
            position=index + 1,
            total=total_training_days,
            all_completed=False,
            reason=None,
        )

    return NextWorkoutResponse(
        training_day=None,
        position=total_training_days,
        total=total_training_days,
        all_completed=True,
        reason="all_completed",
    )


def verify_training_day_access(db: Session, training_day_id: int | str, current_user: User) -> TrainingDay:
    """Verify user has access to the training day"""
    training_day = get_training_day_or_404(db, training_day_id)

    # Navigate up the hierarchy to get macrocycle
    microcycle = db.query(Microcycle).filter(Microcycle.id == training_day.microcycle_id).first()
    mesocycle = db.query(Mesocycle).filter(Mesocycle.id == microcycle.mesocycle_id).first()
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == mesocycle.macrocycle_id).first()

    # Check permissions
    effective_role = get_effective_user_role(current_user)

    if effective_role == "client" and macrocycle.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this training day"
        )
    elif effective_role == "trainer" and macrocycle.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this training day"
        )

    return training_day


def get_workout_log_or_404(db: Session, workout_log_id: int) -> WorkoutLog:
    workout_log = db.query(WorkoutLog).filter(WorkoutLog.id == workout_log_id).first()
    if not workout_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workout log with id {workout_log_id} not found",
        )
    return workout_log


@router.get("/next", response_model=NextWorkoutResponse)
def get_next_workout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene el próximo entrenamiento pendiente para el cliente.
    Usa sistema secuencial: devuelve el primer TrainingDay sin WorkoutLog completado.
    El orden es: mesocycle.block_number → microcycle.week_number → training_day.day_number
    """
    effective_role = get_effective_user_role(current_user)

    if effective_role != "client":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only for clients"
        )

    # 1. Obtener macrociclo activo del cliente
    macrocycle = db.query(Macrocycle).filter(
        Macrocycle.client_id == current_user.id,
        Macrocycle.status == MesocycleStatus.ACTIVE
    ).first()

    if not macrocycle:
        logger.info(
            "next_workout_unavailable reason=no_active_macrocycle user_id=%s email=%s",
            current_user.id,
            current_user.email,
        )
        return NextWorkoutResponse(
            training_day=None,
            position=None,
            total=None,
            all_completed=False,
            reason="no_active_macrocycle",
        )

    # 2. Obtener todos los training_days ordenados (excluyendo días de descanso)
    training_days = db.query(TrainingDay).join(
        Microcycle, TrainingDay.microcycle_id == Microcycle.id
    ).join(
        Mesocycle, Microcycle.mesocycle_id == Mesocycle.id
    ).filter(
        Mesocycle.macrocycle_id == macrocycle.id,
        TrainingDay.rest_day == False
    ).order_by(
        Mesocycle.block_number,
        Microcycle.week_number,
        TrainingDay.day_number,
        TrainingDay.id,
    ).all()

    # 3. Obtener IDs de training_days que tienen WorkoutLog completado
    # Usamos .value porque el enum de PostgreSQL usa valores en minúsculas
    completed_ids = set(
        str(row[0]) for row in db.query(WorkoutLog.training_day_id).filter(
            WorkoutLog.client_id == current_user.id,
            WorkoutLog.status == WorkoutStatus.COMPLETED.value
        ).all()
    )

    response = build_next_workout_response(training_days, completed_ids)

    if response.training_day is None:
        logger.info(
            "next_workout_unavailable reason=%s user_id=%s email=%s macrocycle_id=%s total_training_days=%s completed_training_days=%s",
            response.reason,
            current_user.id,
            current_user.email,
            macrocycle.id,
            len(training_days),
            len(completed_ids),
        )
    else:
        logger.debug(
            "next_workout_resolved user_id=%s email=%s macrocycle_id=%s training_day_id=%s position=%s total=%s",
            current_user.id,
            current_user.email,
            macrocycle.id,
            response.training_day.id,
            response.position,
            response.total,
        )

    return response



@router.post("", response_model=WorkoutLogResponse, status_code=status.HTTP_201_CREATED)
def start_workout(
    workout_data: WorkoutLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Start a new workout session.
    Creates a WorkoutLog with status 'in_progress'.
    """
    # Verify access to training day
    training_day = verify_training_day_access(db, workout_data.training_day_id, current_user)
    training_day_id = training_day.id

    # Check if there's already an in_progress workout for this training day
    existing = db.query(WorkoutLog).filter(
        WorkoutLog.client_id == current_user.id,
        WorkoutLog.training_day_id == training_day_id,
        WorkoutLog.status == WorkoutStatus.IN_PROGRESS.value
    ).first()

    if existing:
        # Return existing in-progress workout instead of creating new one
        return existing

    # Create new workout log
    workout_log = WorkoutLog(
        client_id=current_user.id,
        training_day_id=training_day_id,
        started_at=datetime.utcnow(),
        notes=workout_data.notes,
        status=WorkoutStatus.IN_PROGRESS
    )
    db.add(workout_log)
    db.commit()
    db.refresh(workout_log)

    return workout_log


@router.get("/{workout_log_id}", response_model=WorkoutLogResponse)
def get_workout_log(
    workout_log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific workout log by ID"""
    workout_log = get_workout_log_or_404(db, workout_log_id)

    # Verify access
    if get_effective_user_role(current_user) == "client" and workout_log.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this workout log"
        )

    return workout_log


@router.get("/{workout_log_id}/state", response_model=CurrentWorkoutState)
def get_workout_state(
    workout_log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the current state of a workout in progress.
    Returns exercise progress with completed sets.
    """
    workout_log = get_workout_log_or_404(db, workout_log_id)

    # Verify access
    if get_effective_user_role(current_user) == "client" and workout_log.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this workout log"
        )

    # Get training day with exercises
    training_day = db.query(TrainingDay).filter(
        TrainingDay.id == workout_log.training_day_id
    ).first()

    # Build exercise progress
    exercises_progress = []
    completed_exercises = 0

    # Ordenar por fase (warmup -> main -> cooldown) y luego por order_index
    phase_order = {'warmup': 0, 'main': 1, 'cooldown': 2}
    sorted_exercises = sorted(
        training_day.exercises,
        key=lambda x: (phase_order.get(x.phase, 1), x.order_index)
    )

    for day_exercise in sorted_exercises:
        # Get completed sets for this exercise
        completed_sets = db.query(ExerciseSetLog).filter(
            ExerciseSetLog.workout_log_id == workout_log_id,
            ExerciseSetLog.day_exercise_id == day_exercise.id
        ).order_by(ExerciseSetLog.set_number).all()

        is_completed = len(completed_sets) >= day_exercise.sets
        if is_completed:
            completed_exercises += 1

        exercise_name = day_exercise.exercise.name_es or day_exercise.exercise.name_en if day_exercise.exercise else "Unknown"

        exercises_progress.append(ExerciseProgress(
            day_exercise_id=day_exercise.id,
            exercise_name=exercise_name,
            total_sets=day_exercise.sets,
            completed_sets=len(completed_sets),
            is_completed=is_completed,
            sets_data=[ExerciseSetLogResponse.model_validate(s) for s in completed_sets]
        ))

    return CurrentWorkoutState(
        workout_log=WorkoutLogResponse.model_validate(workout_log),
        training_day_name=training_day.name,
        training_day_focus=training_day.focus,
        total_exercises=len(training_day.exercises),
        completed_exercises=completed_exercises,
        exercises_progress=exercises_progress
    )


@router.patch("/{workout_log_id}", response_model=WorkoutLogResponse)
def update_workout_log(
    workout_log_id: int,
    workout_data: WorkoutLogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a workout log (e.g., mark as completed or abandoned).
    """
    workout_log = get_workout_log_or_404(db, workout_log_id)

    # Verify ownership
    if workout_log.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this workout log"
        )

    # Update fields
    update_data = workout_data.model_dump(exclude_unset=True)

    # If completing the workout, set completed_at
    if update_data.get("status") == WorkoutStatus.COMPLETED.value and not workout_log.completed_at:
        update_data["completed_at"] = datetime.utcnow()

    for field, value in update_data.items():
        setattr(workout_log, field, value)

    db.commit()
    db.refresh(workout_log)

    return workout_log


@router.post("/{workout_log_id}/sets", response_model=ExerciseSetLogResponse, status_code=status.HTTP_201_CREATED)
def log_exercise_set(
    workout_log_id: int,
    set_data: ExerciseSetLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Log a completed set for an exercise.
    """
    workout_log = get_workout_log_or_404(db, workout_log_id)

    day_exercise_id = parse_numeric_identifier(set_data.day_exercise_id, "day_exercise_id")

    # Verify ownership
    if workout_log.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this workout log"
        )

    # Verify workout is still in progress
    if workout_log.status != WorkoutStatus.IN_PROGRESS.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot log sets for a completed or abandoned workout"
        )

    # Verify day_exercise belongs to this training day
    day_exercise = db.query(DayExercise).filter(
        DayExercise.id == day_exercise_id,
        DayExercise.training_day_id == workout_log.training_day_id
    ).first()

    if not day_exercise:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exercise does not belong to this training day"
        )

    # Create set log
    set_log = ExerciseSetLog(
        workout_log_id=workout_log_id,
        day_exercise_id=day_exercise_id,
        exercise_id=day_exercise.exercise_id,
        set_number=set_data.set_number,
        reps_completed=set_data.reps_completed,
        weight_kg=set_data.weight_kg,
        effort_value=set_data.effort_value,
        completed_at=datetime.utcnow(),
    )
    db.add(set_log)
    db.commit()
    db.refresh(set_log)

    return set_log


@router.get("/client/{client_id}", response_model=WorkoutLogListResponse)
def get_client_workout_history(
    client_id: int,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get workout history for a client.
    Clients can only see their own history.
    Trainers can see history of their clients.
    """
    # Verify access
    if get_effective_user_role(current_user) == "client" and client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this client's history"
        )

    # Get total count
    total = db.query(func.count(WorkoutLog.id)).filter(
        WorkoutLog.client_id == client_id
    ).scalar()

    # Get workout logs
    workout_logs = db.query(WorkoutLog).filter(
        WorkoutLog.client_id == client_id
    ).order_by(WorkoutLog.started_at.desc()).offset(skip).limit(limit).all()

    return WorkoutLogListResponse(total=total, workout_logs=workout_logs)


@router.get("/progress/weekly", response_model=WeeklyProgressResponse)
def get_weekly_progress(
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get weekly progress for the current user (client).
    Returns completion percentage for each day of the week.
    """
    if get_effective_user_role(current_user) != "client":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only for clients"
        )

    # Use target_date or today
    if target_date is None:
        target_date = date.today()

    # Get week start (Monday) and end (Sunday)
    week_start = target_date - timedelta(days=target_date.weekday())
    week_end = week_start + timedelta(days=6)

    # Get active macrocycle for this client
    macrocycle = db.query(Macrocycle).filter(
        Macrocycle.client_id == current_user.id,
        Macrocycle.status == MesocycleStatus.ACTIVE
    ).first()

    days_progress = []
    total_workouts_planned = 0
    total_workouts_completed = 0

    for i in range(7):
        current_date = week_start + timedelta(days=i)
        day_number = i + 1  # 1=Monday
        day_name = get_day_name_es(day_number)

        day_progress = DayProgress(
            date=current_date,
            day_number=day_number,
            day_name=day_name,
            total_sets=0,
            completed_sets=0,
            completion_percentage=0.0,
            has_workout=False,
            is_rest_day=False
        )

        if macrocycle:
            # Find training day for this date
            training_day = db.query(TrainingDay).join(
                Microcycle, TrainingDay.microcycle_id == Microcycle.id
            ).join(
                Mesocycle, Microcycle.mesocycle_id == Mesocycle.id
            ).filter(
                Mesocycle.macrocycle_id == macrocycle.id,
                TrainingDay.date == current_date
            ).first()

            if training_day:
                day_progress.training_day_id = str(training_day.id)
                day_progress.training_day_name = training_day.name
                day_progress.is_rest_day = training_day.rest_day

                if not training_day.rest_day:
                    day_progress.has_workout = True
                    total_workouts_planned += 1

                    # Calculate total sets for this day
                    total_sets = sum(ex.sets for ex in training_day.exercises)
                    day_progress.total_sets = total_sets

                    # Get completed sets from workout logs
                    workout_log = db.query(WorkoutLog).filter(
                        WorkoutLog.client_id == current_user.id,
                        WorkoutLog.training_day_id == training_day.id,
                        WorkoutLog.status.in_([WorkoutStatus.IN_PROGRESS.value, WorkoutStatus.COMPLETED.value])
                    ).order_by(WorkoutLog.started_at.desc()).first()

                    if workout_log:
                        completed_sets = db.query(func.count(ExerciseSetLog.id)).filter(
                            ExerciseSetLog.workout_log_id == workout_log.id
                        ).scalar()

                        day_progress.completed_sets = completed_sets

                        if total_sets > 0:
                            day_progress.completion_percentage = round(
                                (completed_sets / total_sets) * 100, 1
                            )

                        if workout_log.status == WorkoutStatus.COMPLETED.value:
                            total_workouts_completed += 1

        days_progress.append(day_progress)

    overall_percentage = 0.0
    if total_workouts_planned > 0:
        overall_percentage = round((total_workouts_completed / total_workouts_planned) * 100, 1)

    return WeeklyProgressResponse(
        week_start=week_start,
        week_end=week_end,
        days=days_progress,
        total_workouts_planned=total_workouts_planned,
        total_workouts_completed=total_workouts_completed,
        overall_completion_percentage=overall_percentage
    )


@router.get("/today", response_model=Optional[WorkoutLogResponse])
def get_todays_workout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get in-progress workout for today if exists.
    """
    if get_effective_user_role(current_user) != "client":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only for clients"
        )

    today = date.today()

    # Find today's training day
    macrocycle = db.query(Macrocycle).filter(
        Macrocycle.client_id == current_user.id,
        Macrocycle.status == MesocycleStatus.ACTIVE
    ).first()

    if not macrocycle:
        return None

    training_day = db.query(TrainingDay).join(
        Microcycle, TrainingDay.microcycle_id == Microcycle.id
    ).join(
        Mesocycle, Microcycle.mesocycle_id == Mesocycle.id
    ).filter(
        Mesocycle.macrocycle_id == macrocycle.id,
        TrainingDay.date == today
    ).first()

    if not training_day:
        return None

    # Get workout log for today
    workout_log = db.query(WorkoutLog).filter(
        WorkoutLog.client_id == current_user.id,
        WorkoutLog.training_day_id == training_day.id
    ).order_by(WorkoutLog.started_at.desc()).first()

    return workout_log


@router.get("/missed", response_model=MissedWorkoutsListResponse)
def get_missed_workouts(
    days_back: int = 14,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene los entrenamientos perdidos del cliente.
    Un entrenamiento se considera perdido si:
    - La fecha del TrainingDay ya pasó
    - No es día de descanso
    - No existe WorkoutLog completado para ese día
    - O existe pero fue abandonado

    Args:
        days_back: Número de días hacia atrás para buscar (default: 14)
    """
    if get_effective_user_role(current_user) != "client":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only for clients"
        )

    today = date.today()
    cutoff_date = today - timedelta(days=days_back)

    # Obtener macrociclo activo
    macrocycle = db.query(Macrocycle).filter(
        Macrocycle.client_id == current_user.id,
        Macrocycle.status == MesocycleStatus.ACTIVE
    ).first()

    if not macrocycle:
        return MissedWorkoutsListResponse(total=0, missed_workouts=[])

    # Obtener todos los training_days pasados (no días de descanso)
    past_training_days = db.query(TrainingDay).join(
        Microcycle, TrainingDay.microcycle_id == Microcycle.id
    ).join(
        Mesocycle, Microcycle.mesocycle_id == Mesocycle.id
    ).filter(
        Mesocycle.macrocycle_id == macrocycle.id,
        TrainingDay.rest_day == False,
        TrainingDay.date < today,
        TrainingDay.date >= cutoff_date
    ).all()

    missed_workouts = []

    for td in past_training_days:
        # Buscar workout log para este día
        workout_log = db.query(WorkoutLog).filter(
            WorkoutLog.client_id == current_user.id,
            WorkoutLog.training_day_id == td.id
        ).order_by(WorkoutLog.started_at.desc()).first()

        # Determinar si es un entrenamiento perdido
        is_missed = False
        status_str = "never_started"
        abandon_reason = None

        if not workout_log:
            # Nunca se inició
            is_missed = True
            status_str = "never_started"
        elif workout_log.status == WorkoutStatus.ABANDONED.value:
            # Fue abandonado
            is_missed = True
            status_str = "abandoned"
            abandon_reason = workout_log.abandon_reason
        elif workout_log.status == WorkoutStatus.IN_PROGRESS.value:
            # En progreso pero ya pasó el día - también se considera perdido
            is_missed = True
            status_str = "abandoned"
        # Si está COMPLETED, no es perdido

        if is_missed:
            days_overdue = (today - td.date).days

            missed_workouts.append(MissedWorkoutResponse(
                training_day_id=td.id,
                training_day_name=td.name,
                scheduled_date=td.date,
                days_overdue=days_overdue,
                status=status_str,
                abandon_reason=abandon_reason,
                can_reschedule=macrocycle.status == MesocycleStatus.ACTIVE
            ))

    # Ordenar por fecha más reciente primero
    missed_workouts.sort(key=lambda x: x.scheduled_date, reverse=True)

    return MissedWorkoutsListResponse(
        total=len(missed_workouts),
        missed_workouts=missed_workouts
    )
