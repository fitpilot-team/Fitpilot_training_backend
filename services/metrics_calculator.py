"""
Metrics calculator service for training volume calculations.
Centralizes the logic for calculating muscle volume, effective sets, etc.
"""
from typing import Any, Dict, List

from pydantic import BaseModel, ConfigDict


MUSCLE_GROUP_LABELS: Dict[str, str] = {
    "chest": "Pecho",
    "upper_back": "Trapecio",
    "lats": "Dorsales",
    "lower_back": "Espalda Baja",
    "anterior_deltoid": "Deltoides Anterior",
    "posterior_deltoid": "Deltoides Posterior",
    "biceps": "Bíceps",
    "triceps": "Tríceps",
    "forearms": "Antebrazos",
    "quadriceps": "Cuádriceps",
    "hamstrings": "Isquiotibiales",
    "glutes": "Glúteos",
    "calves": "Pantorrillas",
    "adductors": "Aductores",
    "tibialis": "Tibial Anterior",
    "abs": "Abdominales",
    "obliques": "Oblicuos",
}


class MuscleVolumeItem(BaseModel):
    """Schema for individual muscle volume data."""

    muscle_name: str
    display_name: str
    effective_sets: float
    total_sets: float


class MuscleVolumeResponse(BaseModel):
    """Schema for muscle volume endpoint response."""

    model_config = ConfigDict(coerce_numbers_to_str=True)

    training_day_id: str
    training_day_name: str
    total_effective_sets: float
    muscles: List[MuscleVolumeItem]


def _stringify_identifier(value: Any) -> str:
    return "" if value is None else str(value)


def _enum_value(value: Any, default: str | None = None) -> str | None:
    if value is None:
        return default

    normalized = getattr(value, "value", value)
    if normalized is None:
        return default

    return str(normalized)


def _coerce_number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _coerce_sets(value: Any) -> float | None:
    sets = _coerce_number(value)
    if sets is None or sets <= 0:
        return None

    return sets


def _resolve_training_day_name(training_day: Any) -> str:
    name = getattr(training_day, "name", None)
    if name:
        return str(name)

    day_number = getattr(training_day, "day_number", None)
    if day_number is not None:
        return f"Día {day_number}"

    return "Día de entrenamiento"


def _add_volume(
    volume_map: Dict[str, Dict[str, float]],
    muscle_name: str,
    effective_sets: float,
    total_sets: float,
) -> None:
    if muscle_name not in volume_map:
        volume_map[muscle_name] = {"effective": 0.0, "total": 0.0}

    volume_map[muscle_name]["effective"] += effective_sets
    volume_map[muscle_name]["total"] += total_sets


def is_effective_intensity(effort_type: str | None, effort_value: float | None) -> bool:
    """
    Determine if an exercise intensity should count as effective.

    Effective sets are those with RIR <= 3, RPE >= 7, or percentage >= 65.
    Missing legacy effort values default to effective to avoid undercounting.
    """
    normalized_effort_type = (effort_type or "RIR").strip()
    if effort_value is None:
        return True

    if normalized_effort_type == "RIR":
        return effort_value <= 3
    if normalized_effort_type == "RPE":
        return effort_value >= 7
    if normalized_effort_type == "percentage":
        return effort_value >= 65
    return True


def calculate_muscle_volume(training_day, count_secondary: bool = True) -> MuscleVolumeResponse:
    """
    Calculate the muscle volume breakdown for a training day.

    Invalid legacy rows are skipped instead of raising server errors.
    """
    volume_map: Dict[str, Dict[str, float]] = {}
    secondary_multiplier = 0.5 if count_secondary else 0.0
    training_day_id = _stringify_identifier(getattr(training_day, "id", None))
    training_day_name = _resolve_training_day_name(training_day)

    if getattr(training_day, "rest_day", False):
        return MuscleVolumeResponse(
            training_day_id=training_day_id,
            training_day_name=training_day_name,
            total_effective_sets=0,
            muscles=[],
        )

    for day_ex in getattr(training_day, "exercises", None) or []:
        phase = (_enum_value(getattr(day_ex, "phase", None), default="main") or "main").lower()
        if phase == "warmup":
            continue

        sets = _coerce_sets(getattr(day_ex, "sets", None))
        if sets is None:
            continue

        exercise = getattr(day_ex, "exercise", None)
        if exercise is None:
            continue

        effort_type = _enum_value(getattr(day_ex, "effort_type", None), default="RIR") or "RIR"
        effort_value = _coerce_number(getattr(day_ex, "effort_value", None))
        effective_sets = sets if is_effective_intensity(effort_type, effort_value) else 0.0

        for em in getattr(exercise, "exercise_muscles", None) or []:
            muscle = getattr(em, "muscle", None)
            muscle_name = getattr(muscle, "name", None)
            if not muscle_name:
                continue

            muscle_role = (_enum_value(getattr(em, "muscle_role", None)) or "").lower()
            if muscle_role == "primary":
                _add_volume(volume_map, muscle_name, effective_sets, sets)
                continue

            if muscle_role == "secondary" and secondary_multiplier > 0:
                _add_volume(
                    volume_map,
                    muscle_name,
                    effective_sets * secondary_multiplier,
                    sets * secondary_multiplier,
                )

    muscles = [
        MuscleVolumeItem(
            muscle_name=name,
            display_name=MUSCLE_GROUP_LABELS.get(name, name.replace("_", " ").title()),
            effective_sets=round(data["effective"], 1),
            total_sets=round(data["total"], 1),
        )
        for name, data in volume_map.items()
    ]

    muscles.sort(key=lambda item: item.effective_sets, reverse=True)

    return MuscleVolumeResponse(
        training_day_id=training_day_id,
        training_day_name=training_day_name,
        total_effective_sets=round(sum(item.effective_sets for item in muscles), 1),
        muscles=muscles,
    )
