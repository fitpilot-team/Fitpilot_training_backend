from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, date, timezone
from typing import Optional
from models.base import get_db
from models.user import User, UserRole
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
from core.dependencies import get_current_user

router = APIRouter()


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_int_id(raw_id: str | int, field_name: str) -> int:
    try:
        return int(str(raw_id))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} must be a valid integer id",
        )


def get_day_name_es(day_number: int) -> str:
    """Get Spanish day name from day number (1=Monday)"""
    days = ["Lun", "Mar", "Mier", "Jue", "Vie", "Sab", "Dom"]
    return days[(day_number - 1) % 7]


def verify_training_day_access(db: Session, training_day_id: str | int, current_user: User) -> TrainingDay:
    """Verify user has access to the training day"""
    parsed_training_day_id = parse_int_id(training_day_id, "training_day_id")
    training_day = db.query(TrainingDay).filter(TrainingDay.id == parsed_training_day_id).first()

    if not training_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training day with id {training_day_id} not found"
        )

    # Navigate up the hierarchy to get macrocycle
    microcycle = db.query(Microcycle).filter(Microcycle.id == training_day.microcycle_id).first()
    mesocycle = db.query(Mesocycle).filter(Mesocycle.id == microcycle.mesocycle_id).first()
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == mesocycle.macrocycle_id).first()

    # Check permissions
    if current_user.role == UserRole.CLIENT and macrocycle.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this training day"
        )
    elif current_user.role == UserRole.TRAINER and macrocycle.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this training day"
        )

    return training_day


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
    if current_user.role != UserRole.CLIENT:
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
        return NextWorkoutResponse(training_day=None, position=None, total=None)

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
        TrainingDay.day_number
    ).all()

    if not training_days:
        return NextWorkoutResponse(training_day=None, position=None, total=None)

    # 3. Obtener IDs de training_days que tienen WorkoutLog completado
    # Usamos .value porque el enum de PostgreSQL usa valores en minúsculas
    completed_ids = set(
        row[0] for row in db.query(WorkoutLog.training_day_id).filter(
            WorkoutLog.client_id == current_user.id,
            WorkoutLog.status == WorkoutStatus.COMPLETED.value
        ).all()
    )

    # 4. Encontrar el primer training_day no completado
    for index, td in enumerate(training_days):
        if td.id not in completed_ids:
            return NextWorkoutResponse(
                training_day=NextWorkoutTrainingDay(
                    id=str(td.id),
                    name=td.name,
                    focus=td.focus,
                    day_number=td.day_number,
                    rest_day=td.rest_day
                ),
                position=index + 1,  # 1-based para mostrar "Día 5 de 24"
                total=len(training_days)
            )

    # 5. Todos los entrenamientos están completados
    return NextWorkoutResponse(
        training_day=None,
        position=len(training_days),
        total=len(training_days),
        all_completed=True
    )


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
        started_at=utc_now(),
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
    workout_log = db.query(WorkoutLog).filter(WorkoutLog.id == workout_log_id).first()

    if not workout_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workout log with id {workout_log_id} not found"
        )

    # Verify access
    if current_user.role == UserRole.CLIENT and workout_log.client_id != current_user.id:
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
    workout_log = db.query(WorkoutLog).filter(WorkoutLog.id == workout_log_id).first()

    if not workout_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workout log with id {workout_log_id} not found"
        )

    # Verify access
    if current_user.role == UserRole.CLIENT and workout_log.client_id != current_user.id:
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
            day_exercise_id=str(day_exercise.id),
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
    workout_log = db.query(WorkoutLog).filter(WorkoutLog.id == workout_log_id).first()

    if not workout_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workout log with id {workout_log_id} not found"
        )

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
        update_data["completed_at"] = utc_now()

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
    workout_log = db.query(WorkoutLog).filter(WorkoutLog.id == workout_log_id).first()

    if not workout_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workout log with id {workout_log_id} not found"
        )

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
    day_exercise_id = parse_int_id(set_data.day_exercise_id, "day_exercise_id")
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
        exercise_id=day_exercise.exercise_id,
        day_exercise_id=day_exercise_id,
        set_number=set_data.set_number,
        reps_completed=set_data.reps_completed,
        weight_kg=set_data.weight_kg,
        effort_value=set_data.effort_value,
        completed_at=utc_now(),
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
    if current_user.role == UserRole.CLIENT and client_id != current_user.id:
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
    if current_user.role != UserRole.CLIENT:
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
    if current_user.role != UserRole.CLIENT:
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
    if current_user.role != UserRole.CLIENT:
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
                training_day_id=str(td.id),
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
