from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime, date
from typing import Optional, List, Literal
from models.workout_log import WorkoutStatus, AbandonReason
from schemas.mesocycle import TrainingDayResponse


def _stringify_id(value: object) -> str | None:
    if value is None:
        return None
    return str(value)


# =============== ExerciseSetLog Schemas ===============

class ExerciseSetLogBase(BaseModel):
    day_exercise_id: str
    set_number: int = Field(ge=1, le=20, description="Set number (1, 2, 3...)")
    reps_completed: int = Field(ge=0, le=100, description="Reps completed in this set")
    weight_kg: Optional[float] = Field(None, ge=0, le=1000, description="Weight used in kg")
    effort_value: Optional[float] = Field(None, ge=0, le=10, description="RIR/RPE value recorded")


class ExerciseSetLogCreate(ExerciseSetLogBase):
    model_config = ConfigDict(extra="forbid")


class ExerciseSetLogResponse(ExerciseSetLogBase):
    id: str
    workout_log_id: str
    completed_at: datetime

    @field_validator("id", "workout_log_id", "day_exercise_id", mode="before")
    @classmethod
    def serialize_ids(cls, value: object) -> str | None:
        return _stringify_id(value)

    class Config:
        from_attributes = True


# =============== WorkoutLog Schemas ===============

class WorkoutLogBase(BaseModel):
    training_day_id: str
    notes: Optional[str] = None


class WorkoutLogCreate(WorkoutLogBase):
    pass


class WorkoutLogUpdate(BaseModel):
    status: Optional[WorkoutStatus] = None
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    # Campos para abandono
    abandon_reason: Optional[AbandonReason] = None
    abandon_notes: Optional[str] = None
    rescheduled_to_date: Optional[date] = None


class WorkoutAbandonData(BaseModel):
    """Datos específicos para abandonar un entrenamiento"""
    reason: AbandonReason
    notes: Optional[str] = None
    reschedule_to: Optional[date] = None


class WorkoutLogResponse(WorkoutLogBase):
    id: str
    client_id: str
    started_at: datetime
    completed_at: Optional[datetime]
    performed_on_date: date
    is_authoritative: bool
    status: WorkoutStatus
    # Campos de abandono
    abandon_reason: Optional[AbandonReason] = None
    abandon_notes: Optional[str] = None
    rescheduled_to_date: Optional[date] = None
    exercise_sets: List[ExerciseSetLogResponse] = []

    @field_validator("id", "client_id", "training_day_id", mode="before")
    @classmethod
    def serialize_ids(cls, value: object) -> str | None:
        return _stringify_id(value)

    class Config:
        from_attributes = True


class WorkoutLogListResponse(BaseModel):
    total: int
    workout_logs: List[WorkoutLogResponse]


# =============== Progress Schemas (para Dashboard) ===============

class DayProgress(BaseModel):
    """Progreso de un día específico"""
    date: date
    day_number: int  # 1-7 (Lun-Dom)
    day_name: str  # "Lun", "Mar", etc.
    training_day_id: Optional[str] = None
    training_day_name: Optional[str] = None
    total_sets: int = 0
    completed_sets: int = 0
    completion_percentage: float = 0.0  # 0-100
    has_workout: bool = False  # Si tiene entrenamiento programado
    is_rest_day: bool = False


class WeeklyProgressResponse(BaseModel):
    """Progreso semanal para el dashboard"""
    week_start: date
    week_end: date
    days: List[DayProgress]
    total_workouts_planned: int
    total_workouts_completed: int
    overall_completion_percentage: float


# =============== Current Workout State ===============

class ExerciseProgress(BaseModel):
    """Estado de progreso de un ejercicio durante el workout"""
    day_exercise_id: str
    exercise_name: str
    total_sets: int
    completed_sets: int
    is_completed: bool
    sets_data: List[ExerciseSetLogResponse] = []


class CurrentWorkoutState(BaseModel):
    """Estado actual de un workout en progreso"""
    workout_log: WorkoutLogResponse
    training_day: TrainingDayResponse
    training_day_name: str
    training_day_focus: Optional[str]
    total_exercises: int
    completed_exercises: int
    exercises_progress: List[ExerciseProgress]


# =============== Next Workout (Sistema Secuencial) ===============

class NextWorkoutTrainingDay(BaseModel):
    """Training day simplificado para NextWorkoutResponse"""
    id: str
    microcycle_id: str
    date: date
    session_index: int
    session_label: Optional[str] = None
    name: str
    focus: Optional[str] = None
    day_number: int
    rest_day: bool = False

    @field_validator("id", "microcycle_id", mode="before")
    @classmethod
    def serialize_id(cls, value: object) -> str | None:
        return _stringify_id(value)

    class Config:
        from_attributes = True


class NextWorkoutResponse(BaseModel):
    """
    Respuesta para obtener el próximo entrenamiento pendiente.
    Usa sistema secuencial: devuelve el primer TrainingDay sin WorkoutLog completado.
    """
    training_day: Optional[NextWorkoutTrainingDay] = None
    position: Optional[int] = None  # Posición actual (ej: 5 de 24)
    total: Optional[int] = None  # Total de entrenamientos en el programa
    all_completed: bool = False  # True si el cliente completó todo el programa


class WorkoutSetLogUpdate(BaseModel):
    reps_completed: Optional[int] = Field(None, ge=0, le=100)
    weight_kg: Optional[float] = Field(None, ge=0, le=1000)
    effort_value: Optional[float] = Field(None, ge=0, le=10)

    model_config = ConfigDict(extra="forbid")


PlannedSessionStatus = Literal["pending", "partial", "completed", "rest"]
ActualSessionStatus = Literal["not_started", "in_progress", "completed", "abandoned"]


class MicrocycleSessionProgress(BaseModel):
    training_day_id: str
    workout_log_id: Optional[str] = None
    session_index: int
    session_label: Optional[str] = None
    name: str
    focus: Optional[str] = None
    planned_status: PlannedSessionStatus
    actual_status: ActualSessionStatus
    completion_percentage: float = 0.0
    performed_on_date: Optional[date] = None


class MicrocycleDayProgress(BaseModel):
    date: date
    day_number: Optional[int] = None
    planned_sessions: int = 0
    completed_planned_sessions: int = 0
    actual_logs_count: int = 0
    has_partial_session: bool = False
    is_rest_day: bool = False
    is_planned_date: bool = True
    sessions: List[MicrocycleSessionProgress] = []


class PlannedMicrocycleMetrics(BaseModel):
    total_planned_sessions: int = 0
    completed_planned_sessions: int = 0
    next_session_position: Optional[int] = None
    completion_percentage: float = 0.0


class ActualMicrocycleMetrics(BaseModel):
    executed_sessions: int = 0
    active_days: int = 0
    double_session_days: int = 0


class MicrocycleProgressResponse(BaseModel):
    microcycle_id: Optional[str] = None
    microcycle_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    planned_metrics: PlannedMicrocycleMetrics
    actual_metrics: ActualMicrocycleMetrics
    days: List[MicrocycleDayProgress]


# =============== Missed Workouts (Entrenamientos Perdidos) ===============

class MissedWorkoutResponse(BaseModel):
    """Representa un entrenamiento que no se completó"""
    training_day_id: str
    training_day_name: str
    scheduled_date: date
    days_overdue: int  # Días desde que debió completarse
    status: Literal["never_started", "abandoned"]
    abandon_reason: Optional[AbandonReason] = None
    can_reschedule: bool = True  # True si el programa sigue activo


class MissedWorkoutsListResponse(BaseModel):
    """Lista de entrenamientos perdidos"""
    total: int
    missed_workouts: List[MissedWorkoutResponse]
