"""
Exercise model for FitPilot.
Represents exercises in the exercise library.
"""
from sqlalchemy import Column, DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.orm import relationship
import enum

from models.base import Base


class ExerciseType(str, enum.Enum):
    """Tipo biomecánico del ejercicio."""
    MULTIARTICULAR = "multiarticular"
    MONOARTICULAR = "monoarticular"


class ResistanceProfile(str, enum.Enum):
    """Perfil de resistencia durante el movimiento."""
    ASCENDING = "ascending"
    DESCENDING = "descending"
    FLAT = "flat"
    BELL_SHAPED = "bell_shaped"


class ExerciseClass(str, enum.Enum):
    """
    Clasificación principal del ejercicio.
    Determina qué campos son requeridos y cómo se parametriza.
    """
    STRENGTH = "strength"          # Ejercicios de fuerza (requieren músculos primarios)
    CARDIO = "cardio"              # Ejercicios cardiovasculares
    PLYOMETRIC = "plyometric"      # Ejercicios pliométricos/explosivos (requieren músculos)
    FLEXIBILITY = "flexibility"    # Estiramientos
    MOBILITY = "mobility"          # Movilidad articular
    WARMUP = "warmup"              # Calentamiento
    CONDITIONING = "conditioning"  # Acondicionamiento metabólico
    BALANCE = "balance"            # Equilibrio y estabilidad


class CardioSubclass(str, enum.Enum):
    """
    Sub-clasificación para ejercicios de cardio.
    Define el protocolo de intensidad.
    """
    LISS = "liss"  # Low Intensity Steady State (20-60min, zona HR 1-2)
    HIIT = "hiit"  # High Intensity Interval Training (10-30min, zona HR 4-5)
    MISS = "miss"  # Moderate Intensity Steady State (20-30min, zona HR 2-3)


# Clases que requieren músculos primarios obligatorios
CLASSES_REQUIRING_MUSCLES = {ExerciseClass.STRENGTH, ExerciseClass.PLYOMETRIC}


class Exercise(Base):
    """
    Represents an exercise in the library.

    Exercises are linked to muscles through the ExerciseMuscle junction table,
    which specifies whether each muscle is primary or secondary.

    Supports bilingual content (Spanish/English) for name and description.
    """
    __tablename__ = "exercises"
    __table_args__ = {"schema": "training"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(
        Enum(
            ExerciseType,
            name="exercise_type",
            schema="training",
            values_callable=lambda enum_type: [e.value for e in enum_type],
        ),
        nullable=False,
    )
    resistance_profile = Column(String, nullable=False)
    category = Column(String, nullable=False)
    video_url = Column(String)  # Video URL from ExerciseDB or custom
    thumbnail_url = Column(String)  # Movement pattern image (GIF/PNG showing exercise execution)
    image_url = Column(String)  # Custom image uploaded by trainer
    anatomy_image_url = Column(String)  # Anatomical image with highlighted muscles
    equipment_needed = Column(String)
    difficulty_level = Column(String)  # beginner, intermediate, advanced

    # Clasificación de ejercicio (nuevo sistema)
    exercise_class = Column(
        Enum(ExerciseClass, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ExerciseClass.STRENGTH,
        index=True
    )
    cardio_subclass = Column(
        String,
        nullable=True  # Solo aplica cuando exercise_class == CARDIO
    )

    # Campos específicos para cardio
    intensity_zone = Column(Integer, nullable=True)  # Zona de frecuencia cardíaca (1-5)
    target_heart_rate_min = Column(Integer, nullable=True)  # BPM mínimo objetivo
    target_heart_rate_max = Column(Integer, nullable=True)  # BPM máximo objetivo
    calories_per_minute = Column(Float, nullable=True)  # Calorías quemadas por minuto

    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

    # Campos bilingües para nombre
    name_en = Column(String, nullable=False, index=True)  # Nombre en inglés (principal)
    name_es = Column(String, nullable=True, index=True)   # Nombre en español

    # Campos bilingües para descripción
    description_en = Column(Text, nullable=True)  # Descripción en inglés
    description_es = Column(Text, nullable=True)  # Descripción en español

    # Relationships
    day_exercises = relationship("DayExercise", back_populates="exercise", cascade="all, delete-orphan")
    exercise_muscles = relationship(
        "ExerciseMuscle",
        back_populates="exercise",
        cascade="all, delete-orphan"
    )

    @property
    def primary_muscles(self):
        """Get all primary muscles for this exercise as schema-compatible dicts."""
        return [
            {
                "muscle_id": em.muscle.id,
                "muscle_name": em.muscle.name,
                "muscle_display_name": em.muscle.display_name_es or em.muscle.display_name_en,
                "muscle_category": em.muscle.muscle_category,
                "role": em.muscle_role
            }
            for em in self.exercise_muscles if em.muscle_role == "primary"
        ]

    @property
    def secondary_muscles(self):
        """Get all secondary muscles for this exercise as schema-compatible dicts."""
        return [
            {
                "muscle_id": em.muscle.id,
                "muscle_name": em.muscle.name,
                "muscle_display_name": em.muscle.display_name_es or em.muscle.display_name_en,
                "muscle_category": em.muscle.muscle_category,
                "role": em.muscle_role
            }
            for em in self.exercise_muscles if em.muscle_role == "secondary"
        ]

    @property
    def primary_muscle_names(self):
        """Get names of all primary muscles."""
        return [em.muscle.name for em in self.exercise_muscles if em.muscle_role == "primary"]

    @property
    def secondary_muscle_names(self):
        """Get names of all secondary muscles."""
        return [em.muscle.name for em in self.exercise_muscles if em.muscle_role == "secondary"]

    def get_name(self, language: str = "es") -> str:
        """
        Obtiene el nombre del ejercicio en el idioma especificado.
        Fallback a name_en (inglés) si no existe traducción al español.
        """
        if language == "es" and self.name_es:
            return self.name_es
        return self.name_en

    def get_description(self, language: str = "es") -> str:
        """
        Obtiene la descripción del ejercicio en el idioma especificado.
        Fallback a description_en si no existe traducción al español.
        """
        if language == "es" and self.description_es:
            return self.description_es
        return self.description_en or ""

    def __repr__(self):
        primary = ", ".join(self.primary_muscle_names) if self.exercise_muscles else "no muscles"
        return f"<Exercise {self.name_en} (primary: {primary})>"
