"""
Muscle model for FitPilot.
Represents individual muscle groups that can be targeted by exercises.
"""
import enum

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship

from models.base import Base


class BodyRegion(str, enum.Enum):
    """Body regions for muscle categorization."""
    UPPER_BODY = "upper_body"
    LOWER_BODY = "lower_body"
    CORE = "core"


class MuscleCategory(str, enum.Enum):
    """Simplified muscle categories for grouping."""
    CHEST = "chest"
    BACK = "back"
    SHOULDERS = "shoulders"
    ARMS = "arms"
    LEGS = "legs"
    CORE = "core"


class Muscle(Base):
    """
    Represents a muscle group that exercises can target.

    Each muscle has:
    - A unique name (e.g., 'chest', 'biceps', 'quadriceps')
    - Display names in Spanish and English
    - Body region classification
    - Category for simplified grouping
    - SVG element IDs for BodyMap visualization
    """
    __tablename__ = "muscles"
    __table_args__ = {"schema": "training"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True, index=True)
    display_name_es = Column(String(100), nullable=True)
    display_name_en = Column(String(100), nullable=True)
    body_region = Column(String(50), nullable=True)
    muscle_category = Column(String(50), nullable=True)
    svg_ids = Column(ARRAY(String), nullable=True)  # Array of SVG element IDs for BodyMap
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

    # Relationships
    exercise_muscles = relationship("ExerciseMuscle", back_populates="muscle")

    def __repr__(self):
        return f"<Muscle {self.name} ({self.muscle_category})>"
