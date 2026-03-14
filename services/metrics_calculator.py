"""
Metrics calculator service for training volume calculations.
Centralizes the logic for calculating muscle volume, effective sets, etc.
"""
from typing import List, Dict, Any
from pydantic import BaseModel, ConfigDict


# Labels en español para los grupos musculares
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


def is_effective_intensity(effort_type: str, effort_value: float) -> bool:
    """
    Determina si un ejercicio tiene la intensidad suficiente para ser "efectivo".
    Series efectivas: aquellas con RIR ≤ 3 o RPE ≥ 7 o %1RM ≥ 65%
    Estas son las series que generan estímulo suficiente para hipertrofia.

    Args:
        effort_type: Tipo de esfuerzo ('RIR', 'RPE', 'percentage')
        effort_value: Valor del esfuerzo

    Returns:
        True si la intensidad es efectiva para hipertrofia
    """
    if effort_type == "RIR":
        return effort_value <= 3
    elif effort_type == "RPE":
        return effort_value >= 7
    elif effort_type == "percentage":
        return effort_value >= 65
    return True  # Por defecto asumimos que es efectivo


def calculate_muscle_volume(training_day, count_secondary: bool = True) -> MuscleVolumeResponse:
    """
    Calcula el volumen por grupo muscular para un día de entrenamiento.

    Args:
        training_day: SQLAlchemy TrainingDay object with exercises relationship loaded
        count_secondary: If True, secondary muscles contribute 0.5x. If False, 0x.

    Returns:
        MuscleVolumeResponse with muscle volume breakdown
    """
    volume_map: Dict[str, Dict[str, float]] = {}
    secondary_multiplier = 0.5 if count_secondary else 0

    for day_ex in training_day.exercises:
        # Skip warmup exercises for volume calculation
        if day_ex.phase and day_ex.phase.value == "warmup":
            continue

        exercise = day_ex.exercise
        if not exercise:
            continue

        # Calculate effective sets based on intensity
        effort_type = day_ex.effort_type.value if day_ex.effort_type else "RIR"
        effective_sets = day_ex.sets if is_effective_intensity(
            effort_type, day_ex.effort_value
        ) else 0

        # Process primary muscles (1x contribution)
        for em in exercise.exercise_muscles:
            if em.muscle_role == "primary":
                muscle_name = em.muscle.name
                if muscle_name not in volume_map:
                    volume_map[muscle_name] = {"effective": 0, "total": 0}
                volume_map[muscle_name]["effective"] += effective_sets
                volume_map[muscle_name]["total"] += day_ex.sets

        # Process secondary muscles (configurable contribution)
        if secondary_multiplier > 0:
            for em in exercise.exercise_muscles:
                if em.muscle_role == "secondary":
                    muscle_name = em.muscle.name
                    if muscle_name not in volume_map:
                        volume_map[muscle_name] = {"effective": 0, "total": 0}
                    volume_map[muscle_name]["effective"] += effective_sets * secondary_multiplier
                    volume_map[muscle_name]["total"] += day_ex.sets * secondary_multiplier

    # Convert to list of MuscleVolumeItem
    muscles = [
        MuscleVolumeItem(
            muscle_name=name,
            display_name=MUSCLE_GROUP_LABELS.get(name, name.replace("_", " ").title()),
            effective_sets=round(data["effective"], 1),
            total_sets=round(data["total"], 1)
        )
        for name, data in volume_map.items()
    ]

    # Sort by effective sets descending
    muscles.sort(key=lambda x: x.effective_sets, reverse=True)

    return MuscleVolumeResponse(
        training_day_id=str(training_day.id),
        training_day_name=training_day.name or f"Día {training_day.day_number}",
        total_effective_sets=round(sum(m.effective_sets for m in muscles), 1),
        muscles=muscles
    )
