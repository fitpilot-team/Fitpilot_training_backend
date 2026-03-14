from dataclasses import dataclass
import logging
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.config import settings
from core.security import introspect_nutrition_token_cached, normalize_auth_role
from models.base import get_db
from models.mesocycle import Macrocycle, Mesocycle, Microcycle, TrainingDay
from models.user import ProfessionalRole, User

security = HTTPBearer()
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TrainingAccessContext:
    effective_role: str
    is_admin: bool
    has_subscription_access: bool
    has_training_plan_access: bool
    has_trainer_professional_role: bool
    current_plan_id: int | None
    current_plan_name: str | None


def _extract_identity(payload: dict | None) -> tuple[str | None, str | None, str | None]:
    """Extract (user_id, email, role) from either local JWT or Nutrition /auth/me payloads."""
    if not payload:
        return None, None, None

    user_id = (
        payload.get("sub")
        or payload.get("id")
        or payload.get("user_id")
        or payload.get("uuid")
    )
    email = payload.get("email") or payload.get("user_email")
    role = payload.get("role") or payload.get("user_role")

    return user_id, email, normalize_auth_role(role)


def _resolve_user(db: Session, user_id: str | None, email: str | None) -> tuple[User | None, str | None]:
    user = None
    resolution_source = None

    if user_id:
        try:
            parsed_id = int(str(user_id))
        except (TypeError, ValueError):
            parsed_id = None
        if parsed_id is not None:
            user = db.query(User).filter(User.id == parsed_id).first()
            if user is not None:
                resolution_source = "id"

    if user is None and email:
        user = db.query(User).filter(User.email.ilike(str(email))).first()
        if user is not None:
            resolution_source = "email"

    return user, resolution_source


def _extract_auth_payload(user: User) -> dict[str, Any]:
    payload = getattr(user, "_auth_payload", None)
    return payload if isinstance(payload, dict) else {}


def _normalize_plan_name(value: str) -> str:
    return value.lower().replace(" ", "").replace("_", "").replace("-", "").strip()


def _parse_plan_id(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None

    return parsed if parsed > 0 else None


def parse_numeric_identifier(raw_value: Any, field_name: str) -> int:
    """Normalize API string identifiers to positive database integers."""
    try:
        parsed = int(str(raw_value).strip())
    except (AttributeError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} must be a numeric identifier",
        ) from exc

    if parsed <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} must be greater than zero",
        )

    return parsed


def _extract_professional_roles(user: User) -> set[str]:
    payload = _extract_auth_payload(user)
    roles: set[str] = set()

    for key in ("professional_role", "professional_roles", "professionalRole", "professionalRoles"):
        raw_roles = payload.get(key)
        if isinstance(raw_roles, str):
            for item in raw_roles.split(","):
                cleaned = item.strip()
                if cleaned:
                    roles.add(cleaned.upper())
        elif isinstance(raw_roles, dict):
            nested = raw_roles.get("role") or raw_roles.get("name") or raw_roles.get("value")
            if isinstance(nested, str):
                cleaned = nested.strip()
                if cleaned:
                    roles.add(cleaned.upper())
            elif isinstance(nested, (list, tuple, set)):
                for item in nested:
                    cleaned = str(item).strip()
                    if cleaned:
                        roles.add(cleaned.upper())
        elif isinstance(raw_roles, (list, tuple, set)):
            for item in raw_roles:
                if isinstance(item, dict):
                    item = item.get("role") or item.get("name") or ""
                cleaned = str(item).strip()
                if cleaned:
                    roles.add(cleaned.upper())

    if not roles:
        for role_item in user.professional_roles or []:
            role_value = getattr(role_item.role, "value", role_item.role)
            cleaned = str(role_value).strip()
            if cleaned:
                roles.add(cleaned.upper())

    return roles


def _extract_current_subscription(user: User) -> dict[str, Any]:
    payload = _extract_auth_payload(user)
    current = payload.get("current_subscription")
    return current if isinstance(current, dict) else {}


def _get_current_plan_id(user: User) -> int | None:
    subscription = _extract_current_subscription(user)
    if not subscription:
        return None

    direct = _parse_plan_id(subscription.get("plan_id"))
    if direct:
        return direct

    plan = subscription.get("plan")
    if isinstance(plan, dict):
        nested = _parse_plan_id(plan.get("id"))
        if nested:
            return nested

    plan_details = subscription.get("plan_details")
    if isinstance(plan_details, dict):
        nested = _parse_plan_id(plan_details.get("id"))
        if nested:
            return nested

    return None


def _get_current_plan_name(user: User) -> str | None:
    subscription = _extract_current_subscription(user)
    if not subscription:
        return None

    plan = subscription.get("plan")
    if isinstance(plan, str) and plan.strip():
        return plan.strip()
    if isinstance(plan, dict):
        value = plan.get("name")
        if isinstance(value, str) and value.strip():
            return value.strip()

    value = subscription.get("name")
    if isinstance(value, str) and value.strip():
        return value.strip()

    plan_details = subscription.get("plan_details")
    if isinstance(plan_details, dict):
        nested = plan_details.get("name")
        if isinstance(nested, str) and nested.strip():
            return nested.strip()

    return None


def _has_active_subscription(user: User) -> bool:
    payload = _extract_auth_payload(user)
    if payload.get("has_active_subscription") is True:
        return True

    vigency = payload.get("subscription_vigency")
    if isinstance(vigency, dict) and vigency.get("is_vigent") is True:
        return True

    current = payload.get("current_subscription")
    if isinstance(current, dict):
        status = str(current.get("status") or "").strip().lower()
        if status in {"active", "trialing"}:
            return True

    return False


def _plan_allows_training(plan_id: int | None, plan_name: str | None) -> bool:
    normalized_name = _normalize_plan_name(plan_name) if plan_name else ""
    return (
        plan_id in {1, 3, 4}
        or normalized_name in {"starter", "trainingpro", "fitpilotultimate"}
    )


def _has_trainer_professional_role(user: User) -> bool:
    roles = _extract_professional_roles(user)
    return ProfessionalRole.TRAINER.value in roles


def get_effective_user_role(user: User) -> str:
    """
    Resolve role for authorization checks.
    Prefers role coming from auth token introspection when present.
    """
    external_role = normalize_auth_role(getattr(user, "_effective_auth_role", None))
    if external_role:
        return external_role

    db_role = getattr(user.role, "value", user.role)
    normalized = normalize_auth_role(str(db_role))
    return normalized or str(db_role).lower()


def get_training_access_context(current_user: User) -> TrainingAccessContext:
    effective_role = get_effective_user_role(current_user)
    is_admin = effective_role == "admin"
    current_plan_id = _get_current_plan_id(current_user)
    current_plan_name = _get_current_plan_name(current_user)
    has_subscription_access = _has_active_subscription(current_user)
    has_training_role = _has_trainer_professional_role(current_user) or effective_role == "trainer"
    has_training_access = (
        is_admin
        or (has_subscription_access and _plan_allows_training(current_plan_id, current_plan_name))
    )

    return TrainingAccessContext(
        effective_role=effective_role,
        is_admin=is_admin,
        has_subscription_access=has_subscription_access,
        has_training_plan_access=has_training_access,
        has_trainer_professional_role=(is_admin or has_training_role),
        current_plan_id=current_plan_id,
        current_plan_name=current_plan_name,
    )


def has_training_plan_access(context: TrainingAccessContext) -> bool:
    return context.has_training_plan_access


def has_trainer_professional_role(context: TrainingAccessContext) -> bool:
    return context.has_trainer_professional_role


def assert_training_module_access(current_user: User) -> TrainingAccessContext:
    context = get_training_access_context(current_user)
    if context.is_admin:
        return context

    if not context.has_training_plan_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere un plan con acceso a entrenamiento para esta accion",
        )

    return context


def assert_training_professional_access(current_user: User) -> TrainingAccessContext:
    context = assert_training_module_access(current_user)
    if context.is_admin:
        return context

    if not context.has_trainer_professional_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol profesional TRAINER para esta accion",
        )

    return context


def get_macrocycle_or_404(db: Session, macrocycle_id: int) -> Macrocycle:
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()
    if not macrocycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Macrocycle with id {macrocycle_id} not found",
        )
    return macrocycle


def get_microcycle_or_404(db: Session, microcycle_id: int) -> Microcycle:
    microcycle = db.query(Microcycle).filter(Microcycle.id == microcycle_id).first()
    if not microcycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Microcycle with id {microcycle_id} not found",
        )
    return microcycle


def get_training_day_or_404(db: Session, training_day_id: int | str) -> TrainingDay:
    normalized_training_day_id = parse_numeric_identifier(training_day_id, "training_day_id")
    training_day = db.query(TrainingDay).filter(TrainingDay.id == normalized_training_day_id).first()
    if not training_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training day with id {normalized_training_day_id} not found",
        )
    return training_day


def get_macrocycle_for_microcycle(db: Session, microcycle: Microcycle) -> Macrocycle:
    mesocycle = db.query(Mesocycle).filter(Mesocycle.id == microcycle.mesocycle_id).first()
    if not mesocycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mesocycle with id {microcycle.mesocycle_id} not found",
        )

    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == mesocycle.macrocycle_id).first()
    if not macrocycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Macrocycle with id {mesocycle.macrocycle_id} not found",
        )

    return macrocycle


def assert_macrocycle_access(
    macrocycle: Macrocycle,
    current_user: User,
    forbidden_detail: str,
) -> None:
    role = get_effective_user_role(current_user)

    if role == "client":
        if macrocycle.client_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=forbidden_detail)
        return

    if role in {"trainer", "admin"}:
        context = assert_training_professional_access(current_user)
        if context.effective_role == "trainer" and macrocycle.trainer_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=forbidden_detail)
        return

    if macrocycle.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=forbidden_detail)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get the current authenticated user (Nutrition token introspection only)."""

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not settings.NUTRITION_API_URL:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="NUTRITION_API_URL is required for training auth",
        )

    token = credentials.credentials
    nutrition_payload = introspect_nutrition_token_cached(token)
    if nutrition_payload is None:
        raise credentials_exception

    user_id, email, token_role = _extract_identity(nutrition_payload)
    user, resolution_source = _resolve_user(db, user_id, email)

    if user is None:
        logger.info(
            "training_auth_resolution_failed token_user_id=%s email=%s token_role=%s",
            user_id,
            email,
            token_role,
        )
        raise credentials_exception

    if resolution_source == "email":
        logger.warning(
            "training_auth_resolved_via_email token_user_id=%s resolved_user_id=%s email=%s token_role=%s",
            user_id,
            user.id,
            email,
            token_role,
        )
    else:
        logger.debug(
            "training_auth_resolved token_user_id=%s resolved_user_id=%s email=%s token_role=%s",
            user_id,
            user.id,
            email,
            token_role,
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )

    setattr(user, "_auth_payload", nutrition_payload)

    if token_role:
        setattr(user, "_effective_auth_role", token_role)

    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get the current active user."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def require_training_module_access(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require active subscription plan access to the training module."""
    assert_training_module_access(current_user)
    return current_user


def require_training_professional_access(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require plan access + TRAINER professional role (or ADMIN bypass)."""
    assert_training_professional_access(current_user)
    return current_user


def require_trainer(current_user: User = Depends(get_current_user)) -> User:
    """Backwards-compatible alias for professional training access checks."""
    assert_training_professional_access(current_user)
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require the current user to be an admin."""
    effective_role = get_effective_user_role(current_user)
    if effective_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires admin privileges"
        )
    return current_user
