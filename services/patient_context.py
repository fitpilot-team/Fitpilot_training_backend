"""
Builds a compact PatientContext from interview + metrics data.
"""

from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from models.client_interview import ClientInterview
from models.client_metric import ClientMetric, MetricType
from models.patient_context import PatientContextSnapshot
from schemas.ai_generator import (
    AllergyItem,
    Anthropometrics,
    PatientConstraints,
    PatientContact,
    PatientContext,
    PatientIdentity,
    PatientInjury,
    PatientLifestyle,
    PatientMedicalHistory,
    PatientPreferences,
)

MAX_TREND_POINTS = 3

METRIC_KEY_MAP: Dict[MetricType, str] = {
    MetricType.WEIGHT: "weight_kg",
    MetricType.BODY_FAT: "body_fat_pct",
    MetricType.CHEST: "chest_cm",
    MetricType.WAIST: "waist_cm",
    MetricType.HIPS: "hips_cm",
    MetricType.ARMS: "arms_cm",
    MetricType.THIGHS: "thighs_cm",
}


def _clean_text(value: object | None, lowercase: bool = False) -> str | None:
    if value is None:
        return None
    if hasattr(value, "value"):
        value = getattr(value, "value")
    cleaned = str(value).strip()
    if not cleaned:
        return None
    return cleaned.lower() if lowercase else cleaned


def _clean_list(values: object | None) -> list[str]:
    if values is None:
        return []

    if isinstance(values, str):
        raw_values = [part.strip() for part in values.replace(";", ",").split(",")]
    elif isinstance(values, (list, tuple, set)):
        raw_values = [str(item).strip() for item in values]
    else:
        return []

    normalized: list[str] = []
    seen: set[str] = set()
    for raw in raw_values:
        if not raw:
            continue
        lowered = raw.lower()
        if lowered in seen:
            continue
        normalized.append(lowered)
        seen.add(lowered)

    return normalized


def _build_anthropometrics(metrics: List[ClientMetric]) -> Optional[Anthropometrics]:
    if not metrics:
        return None

    latest_values: Dict[str, Dict[str, object]] = {}
    trend: Dict[str, List[Dict[str, object]]] = {}

    for metric_type in MetricType:
        typed = [m for m in metrics if m.metric_type == metric_type]
        if not typed:
            continue

        typed.sort(key=lambda m: m.date, reverse=True)
        key = METRIC_KEY_MAP.get(metric_type, metric_type.value)

        latest = typed[0]
        latest_values[key] = {
            "value": latest.value,
            "unit": latest.unit,
            "date": latest.date.isoformat() if latest.date else None,
        }

        trend[key] = [
            {"date": m.date.isoformat() if m.date else None, "value": m.value}
            for m in typed[:MAX_TREND_POINTS]
        ]

    return Anthropometrics(latest=latest_values or None, trend=trend or None)


def _get_injury_areas(interview: ClientInterview) -> list[str]:
    if hasattr(interview, "get_injury_areas"):
        return interview.get_injury_areas() or []
    return _clean_list(interview.injury_areas)


def _get_injury_details(interview: ClientInterview) -> str | None:
    if hasattr(interview, "get_injury_details"):
        return interview.get_injury_details()
    return _clean_text(interview.injury_details or interview.injuries)


def _get_available_equipment(interview: ClientInterview) -> list[str]:
    if hasattr(interview, "get_available_equipment"):
        return interview.get_available_equipment() or []
    return _clean_list(interview.available_equipment or interview.equipment_available)


def _build_injuries(interview: ClientInterview) -> List[PatientInjury]:
    injuries: List[PatientInjury] = []

    for area in _get_injury_areas(interview):
        injuries.append(PatientInjury(area=area, status="reported"))

    details = _get_injury_details(interview)
    if details:
        injuries.append(PatientInjury(area="details", notes=details, status="reported"))

    return injuries


def _build_goals(interview: ClientInterview) -> list[str]:
    goals: list[str] = []

    primary_goal = _clean_text(interview.primary_goal)
    if primary_goal:
        goals.append(primary_goal)

    if interview.specific_goals_text:
        goals.append(interview.specific_goals_text)

    goals.extend(_clean_list(interview.target_muscle_groups))

    # De-duplicate preserving order
    unique_goals: list[str] = []
    seen: set[str] = set()
    for goal in goals:
        normalized_key = goal.lower()
        if normalized_key in seen:
            continue
        unique_goals.append(goal)
        seen.add(normalized_key)

    return unique_goals


def _build_medical_history(interview: ClientInterview) -> PatientMedicalHistory:
    condition_items = [{"name": cond} for cond in _clean_list(interview.medical_conditions)]

    contraindications: list[str] = []
    contraindications.extend(_clean_list(interview.excluded_exercises))

    if _get_injury_details(interview):
        contraindications.append(_get_injury_details(interview))

    return PatientMedicalHistory(
        conditions=condition_items,
        medications=[],
        allergies=[AllergyItem(substance=item) for item in _get_injury_areas(interview)],
        contraindications=contraindications,
    )


def _build_preferences(interview: ClientInterview) -> PatientPreferences:
    preference_notes: list[str] = []

    if interview.exercise_variety:
        preference_notes.append(f"exercise_variety:{interview.exercise_variety}")
    if interview.include_cardio is not None:
        preference_notes.append(f"include_cardio:{str(interview.include_cardio).lower()}")
    if interview.include_warmup is not None:
        preference_notes.append(f"include_warmup:{str(interview.include_warmup).lower()}")
    if interview.include_cooldown is not None:
        preference_notes.append(f"include_cooldown:{str(interview.include_cooldown).lower()}")

    environment = "; ".join(preference_notes) if preference_notes else None

    return PatientPreferences(
        training_style=_clean_text(interview.preferred_training_style),
        avoid_exercises=_clean_list(interview.excluded_exercises),
        environment=environment,
    )


def _build_constraints(interview: ClientInterview) -> PatientConstraints:
    days_per_week = interview.days_per_week or interview.days_available

    return PatientConstraints(
        session_time_min=interview.session_duration_minutes,
        days_per_week=days_per_week,
        equipment=_get_available_equipment(interview),
        mobility_limitations=_clean_text(interview.mobility_limitations),
        notes=_clean_text(interview.equipment_notes),
    )


def _parse_client_id(client_id: str | int) -> int | None:
    try:
        return int(client_id)
    except (TypeError, ValueError):
        return None


def build_patient_context(db: Session, client_id: str) -> Optional[PatientContext]:
    """
    Builds PatientContext prioritizing latest persisted snapshot.
    Falls back to interview + metrics when no snapshot exists.
    """
    parsed_client_id = _parse_client_id(client_id)
    if parsed_client_id is None:
        return None

    snapshot = (
        db.query(PatientContextSnapshot)
        .filter(PatientContextSnapshot.client_id == parsed_client_id)
        .order_by(PatientContextSnapshot.effective_at.desc())
        .first()
    )

    if snapshot and snapshot.data:
        try:
            ctx = PatientContext(**snapshot.data)
            ctx.context_version = snapshot.version
            return ctx
        except Exception:
            pass

    interview = db.query(ClientInterview).filter(ClientInterview.client_id == parsed_client_id).first()
    metrics = db.query(ClientMetric).filter(ClientMetric.client_id == parsed_client_id).all()

    if not interview and not metrics:
        return None

    context: Dict[str, object] = {
        "context_version": datetime.utcnow().isoformat(),
    }

    if interview:
        gender = _clean_text(interview.gender, lowercase=True)

        context["identity"] = PatientIdentity(
            full_name=None,
            document_id=_clean_text(interview.document_id),
            sex=gender,
            gender=gender,
        )

        context["contact"] = PatientContact(
            phone=_clean_text(interview.phone),
            email=None,
            emergency_contact_name=_clean_text(interview.emergency_contact_name),
            emergency_contact_phone=_clean_text(interview.emergency_contact_phone),
            address=_clean_text(interview.address),
        )

        context["injuries"] = _build_injuries(interview)
        context["lifestyle"] = PatientLifestyle(occupation=_clean_text(interview.occupation))
        context["preferences"] = _build_preferences(interview)
        context["constraints"] = _build_constraints(interview)
        context["medical_history"] = _build_medical_history(interview)

        goals = _build_goals(interview)
        if goals:
            context["goals"] = goals

    if metrics:
        context["anthropometrics"] = _build_anthropometrics(metrics)

    return PatientContext(**{key: value for key, value in context.items() if value})


def save_patient_context_snapshot(
    db: Session,
    client_id: str,
    data: PatientContext,
    created_by: Optional[str] = None,
    source: str = "api",
    effective_at: Optional[datetime] = None,
) -> PatientContextSnapshot:
    """Persist a versioned PatientContext snapshot for traceability."""

    version = str(uuid4())
    effective = effective_at or datetime.utcnow()
    created_by_int: int | None = None
    if created_by is not None:
        try:
            created_by_int = int(created_by)
        except (TypeError, ValueError):
            created_by_int = None

    snapshot = PatientContextSnapshot(
        client_id=int(client_id),
        version=version,
        effective_at=effective,
        source=source,
        data=data.model_dump(),
        created_by=created_by_int,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot
