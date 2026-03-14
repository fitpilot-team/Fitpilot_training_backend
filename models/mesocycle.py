import enum

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from models.base import Base


def _enum_values(enum_type: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_type]


def _string_enum(enum_type: type[enum.Enum], *, name: str | None = None) -> Enum:
    return Enum(
        enum_type,
        name=name,
        values_callable=_enum_values,
        native_enum=False,
    )


def _training_native_enum(enum_type: type[enum.Enum], *, name: str) -> Enum:
    return Enum(
        enum_type,
        name=name,
        schema="training",
        values_callable=_enum_values,
    )


class MesocycleStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class IntensityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    DELOAD = "deload"


class EffortType(str, enum.Enum):
    RIR = "RIR"  # Reps in Reserve
    RPE = "RPE"  # Rate of Perceived Exertion
    PERCENTAGE = "percentage"  # Percentage of 1RM


class TempoType(str, enum.Enum):
    CONTROLLED = "controlled"
    EXPLOSIVE = "explosive"
    TUT = "tut"
    STANDARD = "standard"
    PAUSE_REP = "pause_rep"


class SetType(str, enum.Enum):
    STRAIGHT = "straight"
    REST_PAUSE = "rest_pause"
    DROP_SET = "drop_set"
    TOP_SET = "top_set"
    BACKOFF = "backoff"
    MYO_REPS = "myo_reps"
    CLUSTER = "cluster"


class ExercisePhase(str, enum.Enum):
    WARMUP = "warmup"
    MAIN = "main"
    COOLDOWN = "cooldown"


class Macrocycle(Base):
    __tablename__ = "macrocycles"
    __table_args__ = {"schema": "training"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    objective = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(
        _string_enum(MesocycleStatus),
        default=MesocycleStatus.DRAFT,
        nullable=False,
    )
    trainer_id = Column(Integer, ForeignKey("public.users.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("public.users.id"), nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

    trainer = relationship("User", foreign_keys=[trainer_id], back_populates="created_macrocycles")
    client = relationship("User", foreign_keys=[client_id], back_populates="assigned_macrocycles")
    mesocycles = relationship("Mesocycle", back_populates="macrocycle", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Macrocycle {self.name} ({self.status})>"


class Mesocycle(Base):
    __tablename__ = "mesocycles"
    __table_args__ = {"schema": "training"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    macrocycle_id = Column(Integer, ForeignKey("training.macrocycles.id"), nullable=False)
    block_number = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    focus = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

    macrocycle = relationship("Macrocycle", back_populates="mesocycles")
    microcycles = relationship("Microcycle", back_populates="mesocycle", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Mesocycle Block {self.block_number}: {self.name}>"


class Microcycle(Base):
    __tablename__ = "microcycles"
    __table_args__ = {"schema": "training"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    mesocycle_id = Column(Integer, ForeignKey("training.mesocycles.id"), nullable=False)
    week_number = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    intensity_level = Column(
        _training_native_enum(IntensityLevel, name="intensity_level"),
        default=IntensityLevel.MEDIUM,
        nullable=False,
    )
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

    mesocycle = relationship("Mesocycle", back_populates="microcycles")
    training_days = relationship("TrainingDay", back_populates="microcycle", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Microcycle Week {self.week_number}: {self.name}>"


class TrainingDay(Base):
    __tablename__ = "training_days"
    __table_args__ = {"schema": "training"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    microcycle_id = Column(Integer, ForeignKey("training.microcycles.id"), nullable=False)
    day_number = Column(Integer, nullable=False)
    date = Column(Date, nullable=False)
    name = Column(String, nullable=False)
    focus = Column(String, nullable=True)
    rest_day = Column("is_rest_day", Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

    microcycle = relationship("Microcycle", back_populates="training_days")
    exercises = relationship("DayExercise", back_populates="training_day", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<TrainingDay {self.name} on {self.date}>"


class DayExercise(Base):
    __tablename__ = "day_exercises"
    __table_args__ = {"schema": "training"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    training_day_id = Column(Integer, ForeignKey("training.training_days.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("training.exercises.id"), nullable=False)
    order_index = Column(Integer, nullable=False)
    phase = Column(
        _training_native_enum(ExercisePhase, name="exercise_phase"),
        default=ExercisePhase.MAIN,
        nullable=False,
    )

    sets = Column(Integer, nullable=False)
    reps_min = Column(Integer, nullable=True)
    reps_max = Column(Integer, nullable=True)
    rest_seconds = Column(Integer, nullable=False)
    effort_type = Column(
        _string_enum(EffortType),
        nullable=False,
    )
    effort_value = Column(Float, nullable=False)
    tempo = Column(String, nullable=True)
    set_type = Column(String, nullable=True)

    duration_seconds = Column(Integer, nullable=True)
    intensity_zone = Column(Integer, nullable=True)
    distance_meters = Column(Integer, nullable=True)
    target_calories = Column(Integer, nullable=True)
    intervals = Column(Integer, nullable=True)
    work_seconds = Column(Integer, nullable=True)
    interval_rest_seconds = Column(Integer, nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    rpe_target = Column(Float, nullable=True)  # legacy compatibility

    training_day = relationship("TrainingDay", back_populates="exercises")
    exercise = relationship("Exercise", back_populates="day_exercises")

    def __repr__(self):
        exercise_name = self.exercise.name_en if self.exercise else "Unknown"
        if self.duration_seconds:
            return f"<DayExercise {exercise_name}: {self.sets}x{self.duration_seconds}s>"
        return f"<DayExercise {exercise_name}: {self.sets}x{self.reps_min}-{self.reps_max}>"
