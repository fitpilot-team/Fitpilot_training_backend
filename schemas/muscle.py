"""
Pydantic schemas for Muscle and ExerciseMuscle.
"""
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional, List, Literal
from enum import Enum


class BodyRegion(str, Enum):
    """Body regions for muscle categorization."""
    UPPER_BODY = "upper_body"
    LOWER_BODY = "lower_body"
    CORE = "core"


class MuscleCategory(str, Enum):
    """Simplified muscle categories for grouping."""
    CHEST = "chest"
    BACK = "back"
    SHOULDERS = "shoulders"
    ARMS = "arms"
    LEGS = "legs"
    CORE = "core"


class MuscleRole(str, Enum):
    """Role of a muscle in an exercise."""
    PRIMARY = "primary"
    SECONDARY = "secondary"


# ============================================================================
# Muscle Schemas
# ============================================================================

class MuscleBase(BaseModel):
    """Base schema for Muscle."""
    name: str = Field(..., min_length=1, max_length=50)
    display_name_es: str = Field(..., min_length=1, max_length=100)
    display_name_en: str = Field(..., min_length=1, max_length=100)
    body_region: str
    muscle_category: str
    svg_ids: Optional[List[str]] = None
    sort_order: int = 0


class MuscleCreate(MuscleBase):
    """Schema for creating a new Muscle."""
    pass


class MuscleResponse(MuscleBase):
    """Schema for Muscle response."""
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str
    created_at: datetime
    updated_at: datetime


class MuscleListResponse(BaseModel):
    """Schema for list of Muscles response."""
    total: int
    muscles: List[MuscleResponse]


class MuscleSimple(BaseModel):
    """Simplified Muscle schema for embedding in Exercise responses."""
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str
    name: str
    display_name_es: str
    display_name_en: str
    muscle_category: str


# ============================================================================
# ExerciseMuscle Schemas (Junction table)
# ============================================================================

class ExerciseMuscleInput(BaseModel):
    """Input schema for creating exercise-muscle relationships."""
    muscle_id: str
    role: Literal["primary", "secondary"]


class ExerciseMuscleResponse(BaseModel):
    """Response schema for exercise-muscle relationships."""
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    muscle_id: str
    muscle_name: str
    muscle_display_name: str
    muscle_category: str
    role: str


class ExerciseMuscleCreate(BaseModel):
    """Schema for creating multiple exercise-muscle relationships at once."""
    primary_muscles: List[str] = Field(
        ...,
        min_length=1,
        description="List of muscle IDs that are primary targets (at least one required)"
    )
    secondary_muscles: Optional[List[str]] = Field(
        default=[],
        description="List of muscle IDs that are secondary/synergist targets"
    )
