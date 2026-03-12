from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.date_utils import calculate_age_from_date_of_birth
from core.dependencies import assert_training_professional_access, get_current_user
from models.base import get_db
from models.client_interview import ClientInterview
from models.user import User, UserRole
from schemas.client_interview import (
    ClientInterviewCreate,
    ClientInterviewResponse,
    ClientInterviewUpdate,
)

router = APIRouter()

LOWERCASE_SCALAR_FIELDS = {
    "experience_level",
    "gender",
    "primary_goal",
    "exercise_variety",
}

LOWERCASE_LIST_FIELDS = {
    "target_muscle_groups",
    "available_equipment",
    "injury_areas",
    "excluded_exercises",
    "medical_conditions",
    "equipment_available",
}

TEXT_FIELDS = {
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
}

INT_FIELDS = {
    "age",
    "training_experience_months",
    "days_per_week",
    "session_duration_minutes",
    "days_available",
}

FLOAT_FIELDS = {"weight_kg", "height_cm"}

BOOL_FIELDS = {
    "has_gym_access",
    "include_cardio",
    "include_warmup",
    "include_cooldown",
}


def _parse_client_id(client_id: str) -> int:
    try:
        return int(str(client_id).strip())
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_id must be an integer",
        ) from exc


def _ensure_role(current_user: User) -> None:
    assert_training_professional_access(current_user)


def _ensure_client_exists(db: Session, client_id: int) -> User:
    client = db.query(User).filter(User.id == client_id, User.role == UserRole.CLIENT).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    return client


def _clean_optional_text(value: Any, lowercase: bool = False) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    return cleaned.lower() if lowercase else cleaned


def _clean_string_list(value: Any) -> list[str] | None:
    if value is None:
        return None

    if isinstance(value, str):
        raw_items = [part.strip() for part in value.replace(";", ",").split(",")]
    elif isinstance(value, (list, tuple, set)):
        raw_items = [str(item).strip() for item in value]
    else:
        return None

    items: list[str] = []
    seen: set[str] = set()
    for raw in raw_items:
        if not raw:
            continue
        lowered = raw.lower()
        if lowered in seen:
            continue
        items.append(lowered)
        seen.add(lowered)

    return items or None


def _clean_preferred_days(value: Any) -> list[int] | None:
    if value is None:
        return None

    if isinstance(value, str):
        raw_items = [part.strip() for part in value.replace(";", ",").split(",")]
    elif isinstance(value, (list, tuple, set)):
        raw_items = list(value)
    else:
        return None

    days: list[int] = []
    seen: set[int] = set()
    for raw in raw_items:
        try:
            day = int(raw)
        except (TypeError, ValueError):
            continue
        if day < 1 or day > 7 or day in seen:
            continue
        days.append(day)
        seen.add(day)

    return days or None


def _clean_bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y", "si", "on"}:
            return True
        if normalized in {"false", "0", "no", "n", "off"}:
            return False
    return None


def _normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}

    for field, value in payload.items():
        if field in LOWERCASE_SCALAR_FIELDS:
            normalized[field] = _clean_optional_text(value, lowercase=True)
            continue

        if field in TEXT_FIELDS:
            normalized[field] = _clean_optional_text(value)
            continue

        if field in LOWERCASE_LIST_FIELDS:
            normalized[field] = _clean_string_list(value)
            continue

        if field == "preferred_days":
            normalized[field] = _clean_preferred_days(value)
            continue

        if field in INT_FIELDS:
            if value is None or value == "":
                normalized[field] = None
            else:
                try:
                    normalized[field] = int(value)
                except (TypeError, ValueError):
                    normalized[field] = None
            continue

        if field in FLOAT_FIELDS:
            if value is None or value == "":
                normalized[field] = None
            else:
                try:
                    normalized[field] = float(value)
                except (TypeError, ValueError):
                    normalized[field] = None
            continue

        if field in BOOL_FIELDS:
            normalized[field] = _clean_bool(value)
            continue

        normalized[field] = value

    return normalized


@router.get("/{client_id}", response_model=ClientInterviewResponse)
def get_client_interview(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get interview data for a specific client."""

    _ensure_role(current_user)
    parsed_client_id = _parse_client_id(client_id)
    _ensure_client_exists(db, parsed_client_id)

    interview = db.query(ClientInterview).filter(ClientInterview.client_id == parsed_client_id).first()

    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found for this client",
        )

    return interview


@router.post("/{client_id}", response_model=ClientInterviewResponse, status_code=status.HTTP_201_CREATED)
def create_client_interview(
    client_id: str,
    interview_data: ClientInterviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create interview data for a client."""

    _ensure_role(current_user)
    parsed_client_id = _parse_client_id(client_id)
    client = _ensure_client_exists(db, parsed_client_id)

    existing = db.query(ClientInterview).filter(ClientInterview.client_id == parsed_client_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview already exists for this client. Use PUT to update.",
        )

    payload = _normalize_payload(interview_data.model_dump(exclude_unset=True, mode="json"))
    payload["age"] = calculate_age_from_date_of_birth(
        client.date_of_birth,
        min_age=14,
        max_age=100,
    )

    now = datetime.utcnow()
    interview = ClientInterview(
        client_id=parsed_client_id,
        **payload,
    )
    interview.created_at = interview.created_at or now
    interview.updated_at = now

    db.add(interview)
    db.commit()
    db.refresh(interview)

    return interview


@router.put("/{client_id}", response_model=ClientInterviewResponse)
def update_client_interview(
    client_id: str,
    interview_data: ClientInterviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upsert interview data for a client."""

    _ensure_role(current_user)
    parsed_client_id = _parse_client_id(client_id)
    client = _ensure_client_exists(db, parsed_client_id)

    payload = _normalize_payload(interview_data.model_dump(exclude_unset=True, mode="json"))
    payload["age"] = calculate_age_from_date_of_birth(
        client.date_of_birth,
        min_age=14,
        max_age=100,
    )
    now = datetime.utcnow()

    interview = db.query(ClientInterview).filter(ClientInterview.client_id == parsed_client_id).first()
    if not interview:
        interview = ClientInterview(client_id=parsed_client_id, **payload)
        interview.created_at = now
        interview.updated_at = now
        db.add(interview)
    else:
        for field, value in payload.items():
            setattr(interview, field, value)
        interview.updated_at = now

    db.commit()
    db.refresh(interview)

    return interview


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_interview(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete interview data for a client."""

    _ensure_role(current_user)
    parsed_client_id = _parse_client_id(client_id)

    interview = db.query(ClientInterview).filter(ClientInterview.client_id == parsed_client_id).first()
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    db.delete(interview)
    db.commit()

    return None
