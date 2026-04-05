from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator
from datetime import date, datetime, timezone
from typing import Literal, Optional, List
from models.mesocycle import MesocycleStatus, IntensityLevel, EffortType, TempoType, SetType, ExercisePhase
from schemas.exercise import ExerciseResponse


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_created_at(value: Optional[datetime]) -> datetime:
    return value or _now_utc()


def _normalize_updated_at(value: Optional[datetime], info: ValidationInfo) -> datetime:
    if value is not None:
        return value
    created_at = info.data.get("created_at") if info.data else None
    return created_at or _now_utc()


# =============== DayExercise Schemas ===============

class DayExerciseBase(BaseModel):
    exercise_id: int
    order_index: int = Field(ge=0, description="Order of exercise in the training day")
    phase: ExercisePhase = ExercisePhase.MAIN
    sets: int = Field(ge=1, le=20, description="Number of sets")

    # Campos para ejercicios de FUERZA
    reps_min: Optional[int] = Field(None, ge=1, le=100, description="Minimum reps (null for time-based exercises)")
    reps_max: Optional[int] = Field(None, ge=1, le=100, description="Maximum reps (null for time-based exercises)")
    rest_seconds: int = Field(ge=0, le=600, description="Rest time between sets in seconds")
    effort_type: EffortType
    effort_value: float = Field(ge=0, description="Effort value (RIR, RPE, or percentage)")
    tempo: Optional[str] = Field(None, max_length=20, description="Tempo type or notation (e.g., 'controlled', 'standard')")
    set_type: Optional[str] = Field(None, max_length=20, description="Set type (e.g., 'straight', 'drop_set', 'rest_pause')")

    # Campos para ejercicios de CARDIO (LISS/MISS/HIIT)
    duration_seconds: Optional[int] = Field(None, ge=10, le=7200, description="Duration in seconds for cardio exercises (10s to 2h)")
    intensity_zone: Optional[int] = Field(None, ge=1, le=5, description="Heart rate zone (1-5)")
    distance_meters: Optional[int] = Field(None, ge=0, le=50000, description="Target distance in meters")
    target_calories: Optional[int] = Field(None, ge=0, le=2000, description="Target calories to burn")

    # Campos específicos para HIIT
    intervals: Optional[int] = Field(None, ge=1, le=50, description="Number of intervals for HIIT")
    work_seconds: Optional[int] = Field(None, ge=5, le=300, description="Work interval duration in seconds")
    interval_rest_seconds: Optional[int] = Field(None, ge=5, le=300, description="Rest interval duration in seconds")

    notes: Optional[str] = None


class DayExerciseCreate(DayExerciseBase):
    pass


class DayExerciseUpdate(BaseModel):
    exercise_id: Optional[int] = None
    order_index: Optional[int] = Field(None, ge=0)
    phase: Optional[ExercisePhase] = None
    sets: Optional[int] = Field(None, ge=1, le=20)

    # Campos para ejercicios de FUERZA
    reps_min: Optional[int] = Field(None, ge=1, le=100)
    reps_max: Optional[int] = Field(None, ge=1, le=100)
    rest_seconds: Optional[int] = Field(None, ge=0, le=600)
    effort_type: Optional[EffortType] = None
    effort_value: Optional[float] = Field(None, ge=0)
    tempo: Optional[str] = Field(None, max_length=20)
    set_type: Optional[str] = Field(None, max_length=20)

    # Campos para ejercicios de CARDIO
    duration_seconds: Optional[int] = Field(None, ge=10, le=7200)
    intensity_zone: Optional[int] = Field(None, ge=1, le=5)
    distance_meters: Optional[int] = Field(None, ge=0, le=50000)
    target_calories: Optional[int] = Field(None, ge=0, le=2000)

    # Campos específicos para HIIT
    intervals: Optional[int] = Field(None, ge=1, le=50)
    work_seconds: Optional[int] = Field(None, ge=5, le=300)
    interval_rest_seconds: Optional[int] = Field(None, ge=5, le=300)

    notes: Optional[str] = None


class DayExerciseResponse(DayExerciseBase):
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str
    training_day_id: str
    exercise: Optional[ExerciseResponse] = None
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", mode="before")
    @classmethod
    def validate_created_at(cls, value: Optional[datetime]) -> datetime:
        return _normalize_created_at(value)

    @field_validator("updated_at", mode="before")
    @classmethod
    def validate_updated_at(cls, value: Optional[datetime], info: ValidationInfo) -> datetime:
        return _normalize_updated_at(value, info)


TransferExerciseMode = Literal["move", "clone"]


class DayExerciseTransferRequest(BaseModel):
    mode: TransferExerciseMode
    from_day_id: int
    to_day_id: int
    new_index: int = Field(ge=0)
    phase: ExercisePhase = ExercisePhase.MAIN


class DayExerciseTransferResponse(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    mode: TransferExerciseMode
    source_day_id: str
    target_day_id: str
    transferred_exercise: DayExerciseResponse
    source_day_exercises: List[DayExerciseResponse]
    target_day_exercises: List[DayExerciseResponse]


# =============== TrainingDay Schemas ===============

class TrainingDayBase(BaseModel):
    day_number: int = Field(ge=1, description="Ordinal day number within the microcycle")
    date: date
    session_index: int = Field(ge=1, description="Session ordinal within the same date/day")
    session_label: Optional[str] = Field(None, max_length=80, description="Optional session label such as AM/PM")
    name: str = Field(min_length=1, max_length=200)
    focus: Optional[str] = Field(None, max_length=200, description="Training focus (e.g., 'Chest & Triceps')")
    rest_day: bool = False
    notes: Optional[str] = None


class TrainingDayCreate(TrainingDayBase):
    exercises: Optional[List[DayExerciseCreate]] = []


class TrainingDayUpdate(BaseModel):
    day_number: Optional[int] = Field(None, ge=1)
    date: Optional[date] = None
    session_index: Optional[int] = Field(None, ge=1)
    session_label: Optional[str] = Field(None, max_length=80)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    focus: Optional[str] = Field(None, max_length=200)
    rest_day: Optional[bool] = None
    notes: Optional[str] = None


class TrainingDayResponse(TrainingDayBase):
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str
    microcycle_id: str
    exercises: List[DayExerciseResponse] = []
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", mode="before")
    @classmethod
    def validate_created_at(cls, value: Optional[datetime]) -> datetime:
        return _normalize_created_at(value)

    @field_validator("updated_at", mode="before")
    @classmethod
    def validate_updated_at(cls, value: Optional[datetime], info: ValidationInfo) -> datetime:
        return _normalize_updated_at(value, info)


# =============== Microcycle Schemas ===============

class MicrocycleBase(BaseModel):
    week_number: int = Field(ge=1, description="Week number in the mesocycle")
    name: str = Field(min_length=1, max_length=200)
    start_date: date
    end_date: date
    intensity_level: IntensityLevel = IntensityLevel.MEDIUM
    notes: Optional[str] = None


class MicrocycleCreate(MicrocycleBase):
    training_days: Optional[List[TrainingDayCreate]] = []


class MicrocycleUpdate(BaseModel):
    week_number: Optional[int] = Field(None, ge=1)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    intensity_level: Optional[IntensityLevel] = None
    notes: Optional[str] = None


class MicrocycleResponse(MicrocycleBase):
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str
    mesocycle_id: str
    training_days: List[TrainingDayResponse] = []
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", mode="before")
    @classmethod
    def validate_created_at(cls, value: Optional[datetime]) -> datetime:
        return _normalize_created_at(value)

    @field_validator("updated_at", mode="before")
    @classmethod
    def validate_updated_at(cls, value: Optional[datetime], info: ValidationInfo) -> datetime:
        return _normalize_updated_at(value, info)


# =============== Mesocycle Schemas ===============

class MesocycleBase(BaseModel):
    block_number: int = Field(ge=1, description="Block number within the macrocycle")
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    start_date: date
    end_date: date
    focus: Optional[str] = Field(None, max_length=100, description="Training focus (e.g., 'Hypertrophy', 'Strength')")
    notes: Optional[str] = None


class MesocycleCreate(MesocycleBase):
    microcycles: Optional[List[MicrocycleCreate]] = []


class MesocycleUpdate(BaseModel):
    block_number: Optional[int] = Field(None, ge=1)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    focus: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class MesocycleResponse(MesocycleBase):
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str
    macrocycle_id: str
    microcycles: List[MicrocycleResponse] = []
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", mode="before")
    @classmethod
    def validate_created_at(cls, value: Optional[datetime]) -> datetime:
        return _normalize_created_at(value)

    @field_validator("updated_at", mode="before")
    @classmethod
    def validate_updated_at(cls, value: Optional[datetime], info: ValidationInfo) -> datetime:
        return _normalize_updated_at(value, info)


class MesocycleListResponse(BaseModel):
    total: int
    mesocycles: List[MesocycleResponse]


# =============== Macrocycle Schemas ===============

class MacrocycleBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    objective: str = Field(min_length=1, max_length=200, description="Training objective (e.g., 'hypertrophy', 'strength')")
    start_date: date
    end_date: date
    client_id: Optional[int] = None  # NULL = template, not assigned to client


class MacrocycleCreate(MacrocycleBase):
    notify_client: bool = False
    assignment_kind: Literal["template_assign", "manual_create"] = "manual_create"
    mesocycles: Optional[List[MesocycleCreate]] = []


class MacrocycleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    objective: Optional[str] = Field(None, min_length=1, max_length=200)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[MesocycleStatus] = None


class MacrocycleResponse(MacrocycleBase):
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str
    status: MesocycleStatus
    trainer_id: str
    mesocycles: List[MesocycleResponse] = []
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", mode="before")
    @classmethod
    def validate_created_at(cls, value: Optional[datetime]) -> datetime:
        return _normalize_created_at(value)

    @field_validator("updated_at", mode="before")
    @classmethod
    def validate_updated_at(cls, value: Optional[datetime], info: ValidationInfo) -> datetime:
        return _normalize_updated_at(value, info)


class MacrocycleActivationResponse(BaseModel):
    macrocycle: MacrocycleResponse
    effective_start_date: date
    shifted_training_day_count: int
    archived_macrocycle_ids: List[str]
    completed_macrocycle_ids: List[str]


class MacrocycleListItemResponse(MacrocycleBase):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str
    status: MesocycleStatus
    trainer_id: str
    mesocycles_count: int = 0
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", mode="before")
    @classmethod
    def validate_created_at(cls, value: Optional[datetime]) -> datetime:
        return _normalize_created_at(value)

    @field_validator("updated_at", mode="before")
    @classmethod
    def validate_updated_at(cls, value: Optional[datetime], info: ValidationInfo) -> datetime:
        return _normalize_updated_at(value, info)


class MacrocycleListResponse(BaseModel):
    total: int
    macrocycles: List[MacrocycleListItemResponse]


class MacrocyclePaletteResult(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str
    title: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
