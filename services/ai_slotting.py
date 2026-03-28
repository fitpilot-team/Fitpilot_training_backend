"""
Helpers internos para transicionar de catalogo plano a generacion por slot candidates.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Optional

from schemas.ai_generator import AIWorkoutRequest, FitnessLevel, PrimaryGoal

TEMPLATE_VERSION = "slot_v1"
MAX_CANDIDATES_PER_SLOT = 6


@dataclass(slots=True)
class ExerciseSlotDefinition:
    role: str
    label: str
    description: str
    min_candidates: int = 2
    compound_bias: bool = False
    stability_bias: bool = False


@dataclass(slots=True)
class SlotCandidate:
    exercise_id: int
    name: str
    score: float
    primary_muscles: list[str] = field(default_factory=list)
    secondary_muscles: list[str] = field(default_factory=list)
    equipment_needed: Optional[str] = None
    exercise_type: Optional[str] = None
    exercise_class: Optional[str] = None
    cardio_subclass: Optional[str] = None
    difficulty_level: Optional[str] = None
    resistance_profile: Optional[str] = None
    category: Optional[str] = None

    @property
    def summary_tags(self) -> list[str]:
        tags = []
        if self.primary_muscles:
            tags.extend(self.primary_muscles[:2])
        if self.equipment_needed:
            tags.append(self.equipment_needed)
        if self.cardio_subclass:
            tags.append(self.cardio_subclass)
        elif self.exercise_type:
            tags.append(self.exercise_type)
        return tags[:4]


@dataclass(slots=True)
class SlotCandidateGroup:
    definition: ExerciseSlotDefinition
    candidates: list[SlotCandidate] = field(default_factory=list)

    @property
    def role(self) -> str:
        return self.definition.role

    @property
    def candidate_ids(self) -> list[int]:
        return [candidate.exercise_id for candidate in self.candidates]


@dataclass(slots=True)
class SlotSwapRule:
    slot_role: str
    trigger: str
    candidate_ids: list[int] = field(default_factory=list)


@dataclass(slots=True)
class TemplateExerciseSlot:
    slot_role: str
    selected_candidate_id: Optional[int]
    slot_candidate_ids: list[int] = field(default_factory=list)
    phase: str = "main"
    order_index: int = 0
    exercise_name: str = ""
    exercise_payload: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class TemplateDay:
    day_number: int
    name: str
    focus: str
    rest_day: bool
    exercise_slots: list[TemplateExerciseSlot] = field(default_factory=list)


@dataclass(slots=True)
class SlotProgramTemplate:
    template_days: list[TemplateDay] = field(default_factory=list)
    progression_rules: list[dict[str, Any]] = field(default_factory=list)
    swap_rules: list[SlotSwapRule] = field(default_factory=list)
    template_version: str = TEMPLATE_VERSION


@dataclass(slots=True)
class SlotCatalogBuildResult:
    groups: list[SlotCandidateGroup] = field(default_factory=list)
    flat_catalog_exercises: list[dict[str, Any]] = field(default_factory=list)
    eligible: bool = False
    total_candidates: int = 0
    primary_compound_groups: int = 0

    @property
    def candidate_group_count(self) -> int:
        return len(self.groups)

    @property
    def group_map(self) -> dict[str, SlotCandidateGroup]:
        return {group.role: group for group in self.groups}


SLOT_DEFINITIONS: tuple[ExerciseSlotDefinition, ...] = (
    ExerciseSlotDefinition(
        role="primary_horizontal_press",
        label="Primary Horizontal Press",
        description="Press horizontal principal de pecho",
        compound_bias=True,
    ),
    ExerciseSlotDefinition(
        role="secondary_horizontal_press",
        label="Secondary Horizontal Press",
        description="Press horizontal secundario o mas estable",
        compound_bias=True,
        stability_bias=True,
    ),
    ExerciseSlotDefinition(
        role="vertical_pull_primary",
        label="Primary Vertical Pull",
        description="Traccion vertical principal",
        compound_bias=True,
    ),
    ExerciseSlotDefinition(
        role="horizontal_pull_primary",
        label="Primary Horizontal Pull",
        description="Remo principal horizontal",
        compound_bias=True,
    ),
    ExerciseSlotDefinition(
        role="knee_dominant_primary",
        label="Primary Knee Dominant",
        description="Patron dominante de rodilla",
        compound_bias=True,
    ),
    ExerciseSlotDefinition(
        role="hip_hinge_primary",
        label="Primary Hip Hinge",
        description="Patron dominante de cadera",
        compound_bias=True,
    ),
    ExerciseSlotDefinition(
        role="chest_isolation",
        label="Chest Isolation",
        description="Aislamiento de pecho",
        stability_bias=True,
    ),
    ExerciseSlotDefinition(
        role="lateral_delts",
        label="Lateral Delts",
        description="Deltoides lateral",
        stability_bias=True,
    ),
    ExerciseSlotDefinition(
        role="triceps_extension",
        label="Triceps Extension",
        description="Extension de triceps",
        stability_bias=True,
    ),
    ExerciseSlotDefinition(
        role="biceps_flexion",
        label="Biceps Flexion",
        description="Flexion de biceps",
        stability_bias=True,
    ),
    ExerciseSlotDefinition(
        role="calves",
        label="Calves",
        description="Trabajo de pantorrilla",
        stability_bias=True,
    ),
    ExerciseSlotDefinition(
        role="core_stability",
        label="Core Stability",
        description="Estabilidad de core",
        min_candidates=1,
        stability_bias=True,
    ),
    ExerciseSlotDefinition(
        role="cardio_liss",
        label="Cardio LISS",
        description="Cardio de baja intensidad",
        min_candidates=1,
        stability_bias=True,
    ),
    ExerciseSlotDefinition(
        role="cardio_interval",
        label="Cardio Interval",
        description="Cardio por intervalos",
        min_candidates=1,
        stability_bias=True,
    ),
)

SLOT_DEFINITION_BY_ROLE = {definition.role: definition for definition in SLOT_DEFINITIONS}
PRIMARY_COMPOUND_ROLES = {
    "primary_horizontal_press",
    "vertical_pull_primary",
    "horizontal_pull_primary",
    "knee_dominant_primary",
    "hip_hinge_primary",
}


def normalize_exercise_id(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    raw = str(value).strip()
    if not raw:
        return None
    if raw.isdigit():
        return int(raw)
    return None


def build_slot_candidate_groups(
    exercises: list[dict[str, Any]],
    request: AIWorkoutRequest,
) -> SlotCatalogBuildResult:
    grouped: dict[str, list[SlotCandidate]] = {}

    for exercise in exercises:
        role = infer_slot_role(exercise)
        if not role:
            continue

        definition = SLOT_DEFINITION_BY_ROLE.get(role)
        if definition is None:
            continue

        candidate = SlotCandidate(
            exercise_id=int(exercise["id"]),
            name=str(exercise.get("name") or f"Exercise {exercise['id']}"),
            score=score_candidate(exercise, definition, request),
            primary_muscles=_normalize_sequence(exercise.get("primary_muscles")),
            secondary_muscles=_normalize_sequence(exercise.get("secondary_muscles")),
            equipment_needed=_normalize_scalar(exercise.get("equipment_needed")),
            exercise_type=_normalize_scalar(exercise.get("type")),
            exercise_class=_normalize_scalar(exercise.get("exercise_class")),
            cardio_subclass=_normalize_scalar(exercise.get("cardio_subclass")),
            difficulty_level=_normalize_scalar(exercise.get("difficulty_level")),
            resistance_profile=_normalize_scalar(exercise.get("resistance_profile")),
            category=_normalize_scalar(exercise.get("category")),
        )
        grouped.setdefault(role, []).append(candidate)

    groups: list[SlotCandidateGroup] = []
    total_candidates = 0
    primary_compound_groups = 0

    for definition in SLOT_DEFINITIONS:
        candidates = grouped.get(definition.role, [])
        if not candidates:
            continue

        deduped: list[SlotCandidate] = []
        seen_ids: set[int] = set()
        for candidate in sorted(candidates, key=lambda item: item.score, reverse=True):
            if candidate.exercise_id in seen_ids:
                continue
            deduped.append(candidate)
            seen_ids.add(candidate.exercise_id)
            if len(deduped) >= MAX_CANDIDATES_PER_SLOT:
                break

        if len(deduped) < definition.min_candidates:
            continue

        groups.append(SlotCandidateGroup(definition=definition, candidates=deduped))
        total_candidates += len(deduped)
        if definition.role in PRIMARY_COMPOUND_ROLES:
            primary_compound_groups += 1

    eligible = len(groups) >= 4 and primary_compound_groups >= 2
    return SlotCatalogBuildResult(
        groups=groups,
        flat_catalog_exercises=list(exercises),
        eligible=eligible,
        total_candidates=total_candidates,
        primary_compound_groups=primary_compound_groups,
    )


def render_slot_candidate_groups(groups: Iterable[SlotCandidateGroup]) -> str:
    rendered = ["## SLOT CANDIDATE GROUPS"]
    rendered.append("Elige 1 opcion por slot y usa el ID exacto del candidato seleccionado.")
    rendered.append("Mantén estabilidad de ejercicios entre semanas salvo que haya razon clara para cambiar.")

    for group in groups:
        rendered.append(f"\n### SLOT: {group.role}")
        for candidate in group.candidates:
            tags = ", ".join(candidate.summary_tags)
            rendered.append(f"- {candidate.exercise_id} | {candidate.name} | {tags}")

    return "\n".join(rendered)


def build_slot_program_template(
    base_week_data: dict[str, Any],
    slot_catalog: Optional[SlotCatalogBuildResult] = None,
) -> SlotProgramTemplate:
    macrocycle = base_week_data.get("macrocycle", {})
    mesocycles = macrocycle.get("mesocycles", [])
    if not mesocycles:
        return SlotProgramTemplate()

    first_microcycle = (mesocycles[0].get("microcycles") or [{}])[0]
    days = first_microcycle.get("training_days", [])
    group_map = slot_catalog.group_map if slot_catalog else {}

    template_days: list[TemplateDay] = []
    swap_rules: list[SlotSwapRule] = []

    for day in days:
        exercise_slots: list[TemplateExerciseSlot] = []
        for exercise in day.get("exercises", []):
            slot_role = exercise.get("slot_role") or infer_slot_role(exercise)
            selected_candidate_id = normalize_exercise_id(exercise.get("exercise_id"))
            slot_candidate_ids = [
                normalize_exercise_id(candidate_id)
                for candidate_id in (exercise.get("slot_candidate_ids") or [])
            ]
            slot_candidate_ids = [candidate_id for candidate_id in slot_candidate_ids if candidate_id is not None]

            if slot_role and not slot_candidate_ids and slot_role in group_map:
                slot_candidate_ids = group_map[slot_role].candidate_ids

            exercise_slots.append(
                TemplateExerciseSlot(
                    slot_role=slot_role or "unassigned",
                    selected_candidate_id=selected_candidate_id,
                    slot_candidate_ids=slot_candidate_ids,
                    phase=str(exercise.get("phase") or "main"),
                    order_index=int(exercise.get("order_index") or 0),
                    exercise_name=str(exercise.get("exercise_name") or ""),
                    exercise_payload=dict(exercise),
                )
            )

            if slot_role and slot_candidate_ids:
                alternates = [candidate_id for candidate_id in slot_candidate_ids if candidate_id != selected_candidate_id]
                if alternates:
                    swap_rules.append(
                        SlotSwapRule(
                            slot_role=slot_role,
                            trigger="pain_or_intolerance",
                            candidate_ids=alternates[:3],
                        )
                    )

        template_days.append(
            TemplateDay(
                day_number=int(day.get("day_number") or 1),
                name=str(day.get("name") or ""),
                focus=str(day.get("focus") or ""),
                rest_day=bool(day.get("rest_day")),
                exercise_slots=exercise_slots,
            )
        )

    deduped_swap_rules: dict[tuple[str, str], SlotSwapRule] = {}
    for rule in swap_rules:
        deduped_swap_rules[(rule.slot_role, rule.trigger)] = rule

    return SlotProgramTemplate(
        template_days=template_days,
        swap_rules=list(deduped_swap_rules.values()),
    )


def infer_slot_role(exercise: dict[str, Any]) -> Optional[str]:
    exercise_class = _normalize_scalar(exercise.get("exercise_class")) or "strength"
    cardio_subclass = _normalize_scalar(exercise.get("cardio_subclass"))
    exercise_type = _normalize_scalar(exercise.get("type"))
    category = _normalize_scalar(exercise.get("category"))
    equipment = _normalize_scalar(exercise.get("equipment_needed"))
    text = " ".join(
        filter(
            None,
            [
                _normalize_scalar(exercise.get("name")),
                category,
                equipment,
            ],
        )
    )
    primary = set(_normalize_sequence(exercise.get("primary_muscles")))
    secondary = set(_normalize_sequence(exercise.get("secondary_muscles")))
    muscles = primary | secondary

    if exercise_class == "cardio":
        if cardio_subclass == "hiit" or _contains_any(text, {"interval", "sprint", "bike sprint"}):
            return "cardio_interval"
        return "cardio_liss"

    if primary & {"calves", "soleus", "gastrocnemius"} or _contains_any(text, {"calf", "pantorrilla"}):
        return "calves"

    if primary & {"abdominals", "obliques", "abs", "core", "transverse_abdominis"} or _contains_any(text, {"plank", "core", "ab wheel", "carry"}):
        return "core_stability"

    if primary & {"triceps", "triceps_brachii"} or _contains_any(text, {"triceps", "pushdown", "extension"}):
        return "triceps_extension"

    if primary & {"biceps", "biceps_brachii", "brachialis"} or _contains_any(text, {"curl", "biceps"}):
        return "biceps_flexion"

    if primary & {"lateral_deltoid", "deltoids", "shoulders"} and _contains_any(text, {"lateral raise", "lateral", "raise"}):
        return "lateral_delts"

    if primary & {"chest", "pectorals", "pectoralis_major"}:
        if exercise_type == "monoarticular" or _contains_any(text, {"fly", "pec deck", "crossover"}):
            return "chest_isolation"
        if _contains_any(text, {"press", "bench", "push-up", "push up", "chest press"}):
            if equipment in {"machines", "machine", "cables", "dumbbells"} or _contains_any(text, {"incline", "machine", "smith"}):
                return "secondary_horizontal_press"
            return "primary_horizontal_press"

    if muscles & {"lats", "latissimus_dorsi", "back", "rhomboids", "trapezius"}:
        if _contains_any(text, {"pull-up", "pull up", "pulldown", "chin-up", "chin up"}):
            return "vertical_pull_primary"
        if _contains_any(text, {"row", "seal row", "cable row", "chest supported row"}):
            return "horizontal_pull_primary"

    if muscles & {"quadriceps", "quads", "glutes", "gluteus_maximus"}:
        if _contains_any(text, {"squat", "leg press", "split squat", "lunge", "step-up", "step up", "hack squat"}):
            return "knee_dominant_primary"

    if muscles & {"hamstrings", "glutes", "gluteus_maximus", "erectors", "spinal_erectors"}:
        if _contains_any(text, {"deadlift", "rdl", "romanian", "hip thrust", "good morning", "hinge"}):
            return "hip_hinge_primary"

    if exercise_class in {"mobility", "warmup"}:
        return "core_stability"

    return None


def score_candidate(
    exercise: dict[str, Any],
    definition: ExerciseSlotDefinition,
    request: AIWorkoutRequest,
) -> float:
    score = 1.0
    exercise_type = _normalize_scalar(exercise.get("type"))
    equipment = _normalize_scalar(exercise.get("equipment_needed"))
    difficulty = _normalize_scalar(exercise.get("difficulty_level"))
    resistance_profile = _normalize_scalar(exercise.get("resistance_profile"))
    primary = set(_normalize_sequence(exercise.get("primary_muscles")))

    if definition.compound_bias and exercise_type == "multiarticular":
        score += 3.0
    if definition.stability_bias and equipment in {"machine", "machines", "cables", "dumbbells"}:
        score += 1.5
    if request.user_profile.fitness_level == FitnessLevel.BEGINNER:
        if difficulty == "advanced":
            score -= 3.0
        elif difficulty in {"beginner", "intermediate"}:
            score += 1.0
    elif request.user_profile.fitness_level == FitnessLevel.ADVANCED and difficulty == "advanced":
        score += 1.0

    if request.goals.primary_goal == PrimaryGoal.HYPERTROPHY and resistance_profile in {"flat", "bell_shaped"}:
        score += 0.75
    if request.goals.primary_goal == PrimaryGoal.STRENGTH and exercise_type == "multiarticular":
        score += 0.75

    target_muscles = {muscle.value for muscle in request.goals.target_muscle_groups or []}
    if target_muscles and primary & target_muscles:
        score += 2.0

    if request.preferences and request.preferences.exercise_variety.value == "low":
        if equipment in {"machine", "machines", "dumbbells", "barbell"}:
            score += 0.5

    return score


def estimate_prompt_tokens(*chunks: str) -> int:
    chars = sum(len(chunk or "") for chunk in chunks)
    return max(1, chars // 4)


def _normalize_scalar(value: Any) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value).strip().lower()
    return normalized or None


def _normalize_sequence(values: Any) -> list[str]:
    if not values:
        return []
    if isinstance(values, str):
        values = [values]
    normalized: list[str] = []
    for item in values:
        scalar = _normalize_scalar(item)
        if scalar:
            normalized.append(scalar)
    return normalized


def _contains_any(haystack: str, needles: Iterable[str]) -> bool:
    if not haystack:
        return False
    for needle in needles:
        if needle in haystack:
            return True
    return False
