from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


ENUM_LIKE_FIELDS = {
    "experience_level",
    "gender",
    "primary_goal",
    "exercise_variety",
    "preferred_training_style",
}

LIST_STRING_FIELDS = {
    "target_muscle_groups",
    "available_equipment",
    "injury_areas",
    "excluded_exercises",
    "medical_conditions",
}


def _to_clean_string(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _to_clean_list(value: Any) -> list[str] | None:
    if value is None:
        return None

    if isinstance(value, str):
        items = [part.strip() for part in value.replace(";", ",").split(",")]
    elif isinstance(value, (list, tuple, set)):
        items = [str(item).strip() for item in value]
    else:
        return None

    normalized: list[str] = []
    seen: set[str] = set()
    for item in items:
        if not item:
            continue
        lowered = item.lower()
        if lowered in seen:
            continue
        normalized.append(lowered)
        seen.add(lowered)
    return normalized or None


class ClientInterviewBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # Personal/contact
    document_id: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=50)
    address: str | None = Field(None, max_length=500)
    emergency_contact_name: str | None = Field(None, max_length=200)
    emergency_contact_phone: str | None = Field(None, max_length=50)
    insurance_provider: str | None = Field(None, max_length=200)
    policy_number: str | None = Field(None, max_length=100)

    # Profile
    experience_level: str | None = Field(None, max_length=50)
    age: int | None = Field(None, ge=14, le=100)
    gender: str | None = Field(None, max_length=50)
    occupation: str | None = Field(None, max_length=200)
    weight_kg: float | None = Field(None, ge=30, le=300)
    height_cm: float | None = Field(None, ge=100, le=250)
    training_experience_months: int | None = Field(None, ge=0, le=600)

    # Goals
    primary_goal: str | None = Field(None, max_length=100)
    specific_goals_text: str | None = Field(None, max_length=500)
    target_muscle_groups: list[str] | None = Field(None, max_length=20)

    # Availability
    days_per_week: int | None = Field(None, ge=1, le=7)
    session_duration_minutes: int | None = Field(None, ge=20, le=180)
    preferred_days: list[int] | None = None

    # Equipment
    has_gym_access: bool | None = None
    available_equipment: list[str] | None = Field(None, max_length=20)
    equipment_notes: str | None = Field(None, max_length=500)

    # Restrictions
    injury_areas: list[str] | None = Field(None, max_length=20)
    injury_details: str | None = Field(None, max_length=1000)
    excluded_exercises: list[str] | None = Field(None, max_length=20)
    medical_conditions: list[str] | None = Field(None, max_length=20)
    mobility_limitations: str | None = Field(None, max_length=500)

    # Preferences
    exercise_variety: str | None = Field(None, max_length=20)
    include_cardio: bool | None = None
    include_warmup: bool | None = None
    include_cooldown: bool | None = None
    preferred_training_style: str | None = Field(None, max_length=200)

    # Legacy-compatible fields
    days_available: int | None = Field(None, ge=1, le=7)
    injuries: str | None = Field(None, max_length=1000)
    equipment_available: list[str] | None = Field(None, max_length=20)

    notes: str | None = Field(None, max_length=2000)

    @field_validator(
        "document_id",
        "phone",
        "address",
        "emergency_contact_name",
        "emergency_contact_phone",
        "insurance_provider",
        "policy_number",
        "occupation",
        "specific_goals_text",
        "equipment_notes",
        "injury_details",
        "mobility_limitations",
        "preferred_training_style",
        "injuries",
        "notes",
        mode="before",
    )
    @classmethod
    def _clean_optional_text(cls, value: Any) -> str | None:
        return _to_clean_string(value)

    @field_validator(*ENUM_LIKE_FIELDS, mode="before")
    @classmethod
    def _clean_enum_like_text(cls, value: Any) -> str | None:
        cleaned = _to_clean_string(value)
        return cleaned.lower() if cleaned else None

    @field_validator(*LIST_STRING_FIELDS, "equipment_available", mode="before")
    @classmethod
    def _clean_string_lists(cls, value: Any) -> list[str] | None:
        return _to_clean_list(value)

    @field_validator("preferred_days", mode="before")
    @classmethod
    def _clean_preferred_days(cls, value: Any) -> list[int] | None:
        if value is None:
            return None

        items: list[Any]
        if isinstance(value, str):
            items = [part.strip() for part in value.replace(";", ",").split(",")]
        elif isinstance(value, (list, tuple, set)):
            items = list(value)
        else:
            return None

        normalized: list[int] = []
        seen: set[int] = set()
        for item in items:
            try:
                day = int(item)
            except (TypeError, ValueError):
                continue
            if day < 1 or day > 7 or day in seen:
                continue
            normalized.append(day)
            seen.add(day)

        return normalized or None


class ClientInterviewCreate(ClientInterviewBase):
    pass


class ClientInterviewUpdate(ClientInterviewBase):
    pass


class ClientInterviewResponse(ClientInterviewBase):
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str
    client_id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class InterviewValidationResponse(BaseModel):
    """Response for interview validation endpoint."""

    is_complete: bool
    missing_fields: list[str]
    client_name: str | None = None
    has_interview: bool
