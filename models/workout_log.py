import enum

from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import relationship

from models.base import Base


class WorkoutStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class AbandonReason(str, enum.Enum):
    TIME = "time"
    INJURY = "injury"
    FATIGUE = "fatigue"
    MOTIVATION = "motivation"
    SCHEDULE = "schedule"
    OTHER = "other"


class WorkoutLog(Base):
    __tablename__ = "workout_logs"
    __table_args__ = (
        Index(
            "uq_workout_logs_authoritative_client_training_day",
            "client_id",
            "training_day_id",
            unique=True,
            postgresql_where=text("is_authoritative = TRUE"),
        ),
        {"schema": "training"},
    )

    id = Column(BigInteger, primary_key=True)
    client_id = Column(Integer, ForeignKey("public.users.id"), nullable=False, index=True)
    training_day_id = Column(Integer, ForeignKey("training.training_days.id"), nullable=True, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    performed_on_date = Column(Date, nullable=False, index=True)
    is_authoritative = Column(Boolean, nullable=False, default=True)
    status = Column(
        Enum(
            WorkoutStatus,
            name="workout_status",
            schema="training",
            values_callable=lambda enum_type: [member.value for member in enum_type],
        ),
        nullable=True,
    )
    notes = Column(Text, nullable=True)

    client = relationship("User", foreign_keys=[client_id])
    training_day = relationship("TrainingDay", foreign_keys=[training_day_id], back_populates="workout_logs")
    exercise_sets = relationship("ExerciseSetLog", back_populates="workout_log", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<WorkoutLog {self.id} - {self.status}>"


class ExerciseSetLog(Base):
    __tablename__ = "exercise_set_logs"
    __table_args__ = {"schema": "training"}

    id = Column(BigInteger, primary_key=True)
    workout_log_id = Column(BigInteger, ForeignKey("training.workout_logs.id"), nullable=False, index=True)
    exercise_id = Column(Integer, ForeignKey("training.exercises.id"), nullable=False)
    day_exercise_id = Column(Integer, ForeignKey("training.day_exercises.id"), nullable=True, index=True)
    set_number = Column(Integer, nullable=True)
    reps_completed = Column("reps", Integer, nullable=True)
    weight_kg = Column(Float, nullable=True)
    effort_value = Column("rpe", Float, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    workout_log = relationship("WorkoutLog", back_populates="exercise_sets")
    day_exercise = relationship("DayExercise", foreign_keys=[day_exercise_id])

    def __repr__(self):
        return f"<ExerciseSetLog set={self.set_number} reps={self.reps_completed}>"
