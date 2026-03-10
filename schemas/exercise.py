"""
Pydantic schemas for Exercise.
"""
from pydantic import BaseModel, ConfigDict, Field, model_validator
from datetime import datetime
from typing import Optional, List
from models.exercise import (
    ExerciseType,
    ResistanceProfile,
    ExerciseClass,
    CardioSubclass,
    CLASSES_REQUIRING_MUSCLES
)
from schemas.muscle import ExerciseMuscleResponse


class ExerciseBase(BaseModel):
    """Base schema for Exercise (without muscles)."""
    name_en: str = Field(..., min_length=1, max_length=200, description="Nombre en inglés (requerido)")
    name_es: Optional[str] = Field(None, max_length=200, description="Nombre en español")
    type: ExerciseType
    resistance_profile: ResistanceProfile
    category: str = Field(..., min_length=1, max_length=100)
    description_en: Optional[str] = Field(None, description="Descripción en inglés")
    description_es: Optional[str] = Field(None, description="Descripción en español")
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None  # Movement pattern image
    image_url: Optional[str] = None  # Custom uploaded image
    anatomy_image_url: Optional[str] = None  # Anatomical image with muscles
    equipment_needed: Optional[str] = None
    difficulty_level: Optional[str] = Field(None, pattern="^(beginner|intermediate|advanced)$")

    # Clasificación de ejercicio
    exercise_class: ExerciseClass = Field(
        default=ExerciseClass.STRENGTH,
        description="Clasificación principal del ejercicio"
    )
    cardio_subclass: Optional[CardioSubclass] = Field(
        None,
        description="Sub-clasificación para cardio (LISS, HIIT, MISS)"
    )

    # Campos específicos para cardio
    intensity_zone: Optional[int] = Field(
        None,
        ge=1,
        le=5,
        description="Zona de frecuencia cardíaca (1-5)"
    )
    target_heart_rate_min: Optional[int] = Field(
        None,
        ge=40,
        le=220,
        description="BPM mínimo objetivo"
    )
    target_heart_rate_max: Optional[int] = Field(
        None,
        ge=40,
        le=220,
        description="BPM máximo objetivo"
    )
    calories_per_minute: Optional[float] = Field(
        None,
        ge=0,
        le=50,
        description="Calorías quemadas por minuto"
    )


class ExerciseCreate(ExerciseBase):
    """Schema for creating a new Exercise with muscle relationships."""
    primary_muscle_ids: List[str] = Field(
        default=[],
        description="List of muscle IDs that are primary targets (required for strength/plyometric)"
    )
    secondary_muscle_ids: List[str] = Field(
        default=[],
        description="List of muscle IDs that are secondary/synergist targets"
    )

    @model_validator(mode='after')
    def validate_muscles_for_class(self):
        """
        Valida que los ejercicios de fuerza y pliométricos tengan músculos primarios.
        Otros tipos de ejercicio (cardio, flexibility, etc.) no requieren músculos.
        """
        if self.exercise_class in CLASSES_REQUIRING_MUSCLES:
            if not self.primary_muscle_ids:
                raise ValueError(
                    f"Los ejercicios de tipo '{self.exercise_class.value}' requieren "
                    "al menos un músculo primario"
                )

        # Validar que cardio_subclass solo se use con exercise_class == CARDIO
        if self.cardio_subclass and self.exercise_class != ExerciseClass.CARDIO:
            raise ValueError(
                "cardio_subclass solo puede usarse cuando exercise_class es 'cardio'"
            )

        # Validar que campos de cardio solo se usen con ejercicios de cardio
        cardio_fields = [
            self.intensity_zone,
            self.target_heart_rate_min,
            self.target_heart_rate_max,
            self.calories_per_minute
        ]
        if any(f is not None for f in cardio_fields) and self.exercise_class != ExerciseClass.CARDIO:
            raise ValueError(
                "Los campos de frecuencia cardíaca y calorías solo aplican a ejercicios de cardio"
            )

        return self


class ExerciseUpdate(BaseModel):
    """Schema for updating an existing Exercise."""
    name_en: Optional[str] = Field(None, min_length=1, max_length=200, description="Nombre en inglés")
    name_es: Optional[str] = Field(None, max_length=200, description="Nombre en español")
    type: Optional[ExerciseType] = None
    resistance_profile: Optional[ResistanceProfile] = None
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    description_en: Optional[str] = Field(None, description="Descripción en inglés")
    description_es: Optional[str] = Field(None, description="Descripción en español")
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    image_url: Optional[str] = None
    anatomy_image_url: Optional[str] = None
    equipment_needed: Optional[str] = None
    difficulty_level: Optional[str] = Field(None, pattern="^(beginner|intermediate|advanced)$")

    # Clasificación de ejercicio
    exercise_class: Optional[ExerciseClass] = None
    cardio_subclass: Optional[CardioSubclass] = None

    # Campos específicos para cardio
    intensity_zone: Optional[int] = Field(None, ge=1, le=5)
    target_heart_rate_min: Optional[int] = Field(None, ge=40, le=220)
    target_heart_rate_max: Optional[int] = Field(None, ge=40, le=220)
    calories_per_minute: Optional[float] = Field(None, ge=0, le=50)

    # Músculos (ya no requiere min_length=1 pues depende de exercise_class)
    primary_muscle_ids: Optional[List[str]] = Field(
        None,
        description="List of muscle IDs that are primary targets"
    )
    secondary_muscle_ids: Optional[List[str]] = Field(
        None,
        description="List of muscle IDs that are secondary/synergist targets"
    )


class ExerciseResponse(ExerciseBase):
    """Response schema for Exercise with muscle relationships."""
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str
    primary_muscles: List[ExerciseMuscleResponse]
    secondary_muscles: List[ExerciseMuscleResponse]
    created_at: datetime
    updated_at: datetime


class ExerciseListResponse(BaseModel):
    """Schema for list of Exercises response."""
    total: int
    exercises: List[ExerciseResponse]
