from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from models.workout_log import AbandonReason, WorkoutStatus


# ExerciseSetLog schemas

class ExerciseSetLogBase(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    day_exercise_id: str
    set_number: int = Field(ge=1, le=20, description="Set number (1, 2, 3...)")
    reps_completed: int = Field(ge=0, le=100, description="Reps completed in this set")
    weight_kg: Optional[float] = Field(None, ge=0, le=1000, description="Weight used in kg")
    effort_value: Optional[float] = Field(None, ge=0, le=10, description="RIR/RPE value recorded")
    notes: Optional[str] = None


class ExerciseSetLogCreate(ExerciseSetLogBase):
    pass


class ExerciseSetLogResponse(ExerciseSetLogBase):
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str
    workout_log_id: str
    completed_at: Optional[datetime] = None


# WorkoutLog schemas

class WorkoutLogBase(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    training_day_id: str
    notes: Optional[str] = None


class WorkoutLogCreate(WorkoutLogBase):
    pass


class WorkoutLogUpdate(BaseModel):
    status: Optional[WorkoutStatus] = None
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    abandon_reason: Optional[AbandonReason] = None
    abandon_notes: Optional[str] = None
    rescheduled_to_date: Optional[date] = None


class WorkoutAbandonData(BaseModel):
    """Datos especificos para abandonar un entrenamiento."""

    reason: AbandonReason
    notes: Optional[str] = None
    reschedule_to: Optional[date] = None


class WorkoutLogResponse(WorkoutLogBase):
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str
    client_id: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime]
    status: WorkoutStatus
    abandon_reason: Optional[AbandonReason] = None
    abandon_notes: Optional[str] = None
    rescheduled_to_date: Optional[date] = None
    exercise_sets: List[ExerciseSetLogResponse] = []


class WorkoutLogListResponse(BaseModel):
    total: int
    workout_logs: List[WorkoutLogResponse]


# Progress schemas

class DayProgress(BaseModel):
    """Progreso de un dia especifico."""

    model_config = ConfigDict(coerce_numbers_to_str=True)

    date: date
    day_number: int
    day_name: str
    training_day_id: Optional[str] = None
    training_day_name: Optional[str] = None
    total_sets: int = 0
    completed_sets: int = 0
    completion_percentage: float = 0.0
    has_workout: bool = False
    is_rest_day: bool = False


class WeeklyProgressResponse(BaseModel):
    """Progreso semanal para el dashboard."""

    week_start: date
    week_end: date
    days: List[DayProgress]
    total_workouts_planned: int
    total_workouts_completed: int
    overall_completion_percentage: float


# Current workout state

class ExerciseProgress(BaseModel):
    """Estado de progreso de un ejercicio durante el workout."""

    model_config = ConfigDict(coerce_numbers_to_str=True)

    day_exercise_id: str
    exercise_name: str
    total_sets: int
    completed_sets: int
    is_completed: bool
    sets_data: List[ExerciseSetLogResponse] = []


class CurrentWorkoutState(BaseModel):
    """Estado actual de un workout en progreso."""

    model_config = ConfigDict(coerce_numbers_to_str=True)

    workout_log: WorkoutLogResponse
    training_day_name: str
    training_day_focus: Optional[str]
    total_exercises: int
    completed_exercises: int
    exercises_progress: List[ExerciseProgress]


# Next workout

class NextWorkoutTrainingDay(BaseModel):
    """Training day simplificado para NextWorkoutResponse."""

    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str
    name: str
    focus: Optional[str] = None
    day_number: int
    rest_day: bool = False


class NextWorkoutResponse(BaseModel):
    """
    Respuesta para obtener el proximo entrenamiento pendiente.
    Usa sistema secuencial: devuelve el primer TrainingDay sin WorkoutLog completado.
    """

    training_day: Optional[NextWorkoutTrainingDay] = None
    position: Optional[int] = None
    total: Optional[int] = None
    all_completed: bool = False
    reason: Optional[Literal["no_active_macrocycle", "no_training_days", "all_completed"]] = None


# Missed workouts

class MissedWorkoutResponse(BaseModel):
    """Representa un entrenamiento que no se completo."""

    model_config = ConfigDict(coerce_numbers_to_str=True)

    training_day_id: str
    training_day_name: str
    scheduled_date: date
    days_overdue: int
    status: Literal["never_started", "abandoned"]
    abandon_reason: Optional[AbandonReason] = None
    can_reschedule: bool = True


class MissedWorkoutsListResponse(BaseModel):
    """Lista de entrenamientos perdidos."""

    total: int
    missed_workouts: List[MissedWorkoutResponse]
