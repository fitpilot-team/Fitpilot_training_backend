"""
ExerciseMuscle model for FitPilot.
Junction table linking exercises to muscles with role specification.
"""
import enum

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from models.base import Base


class MuscleRole(str, enum.Enum):
    """Role of a muscle in an exercise."""
    PRIMARY = "primary"
    SECONDARY = "secondary"


class ExerciseMuscle(Base):
    """
    Junction table linking exercises to muscles.

    Specifies whether a muscle is:
    - PRIMARY: The main target muscle (counts as 1 full set)
    - SECONDARY: A supporting/synergist muscle (counts as 0.5 sets)

    Each exercise must have at least one primary muscle.
    """
    __tablename__ = "exercise_muscles"
    __table_args__ = (
        CheckConstraint("role IN ('primary', 'secondary')", name="exercise_muscles_role_check"),
        {"schema": "training"},
    )

    exercise_id = Column(
        Integer,
        ForeignKey("training.exercises.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
        index=True,
    )
    muscle_id = Column(
        Integer,
        ForeignKey("training.muscles.id", ondelete="RESTRICT"),
        primary_key=True,
        nullable=False,
        index=True,
    )
    muscle_role = Column("role", String(20), nullable=False)  # 'primary' or 'secondary'

    # Relationships
    exercise = relationship("Exercise", back_populates="exercise_muscles")
    muscle = relationship("Muscle", back_populates="exercise_muscles")

    def __repr__(self):
        return f"<ExerciseMuscle exercise={self.exercise_id} muscle={self.muscle_id} role={self.muscle_role}>"
