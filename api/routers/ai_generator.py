"""
Router para la generaciÃ³n de entrenamientos con IA.
"""

import logging
from datetime import timedelta
from enum import Enum
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Any, Optional

from models.base import get_db
from models.user import User, UserRole
from models.exercise import Exercise
from models.mesocycle import Macrocycle, Mesocycle, Microcycle, TrainingDay, DayExercise, MesocycleStatus, ExercisePhase
from models.client_interview import ClientInterview
from schemas.ai_generator import (
    AIWorkoutRequest,
    AIWorkoutResponse,
    QuestionnaireConfig,
    QuestionnaireStep,
    GenerationStatus,
    InterviewDataResponse,
    ExerciseCatalogItem,
    GeneratedMacrocycle,
    SaveWorkoutRequest,
    CreationMode,
)
from schemas.client_interview import InterviewValidationResponse
from core.date_utils import calculate_age_from_date_of_birth
from core.dependencies import (
    assert_training_professional_access,
    get_current_user,
)
from services.ai_generator import AIWorkoutGenerator, ExerciseMapper
from services.interview_mapper import InterviewToAIRequestMapper
from services.patient_context import build_patient_context

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_EXERCISE_TYPES = {"multiarticular", "monoarticular"}
ALLOWED_RESISTANCE_PROFILES = {"ascending", "descending", "flat", "bell_shaped"}
ALLOWED_EXERCISE_CLASSES = {
    "strength",
    "cardio",
    "plyometric",
    "flexibility",
    "mobility",
    "warmup",
    "conditioning",
    "balance",
}
ALLOWED_CARDIO_SUBCLASSES = {"liss", "hiit", "miss"}


def _to_serializable_value(value: Any, *, field: str, exercise_id: Optional[int]) -> Optional[str]:
    """
    Convierte un valor enum/string/legacy a string serializable.
    Nunca lanza excepciÃ³n por tipo inesperado.
    """
    if value is None:
        return None

    if isinstance(value, Enum):
        return str(value.value)

    if isinstance(value, str):
        normalized = value.strip()
        return normalized or None

    logger.warning(
        "ai_generator.exercise.unexpected_type",
        extra={
            "field": field,
            "exercise_id": exercise_id,
            "value_type": type(value).__name__,
        },
    )
    return str(value)


def _normalize_catalog_value(
    value: Any,
    *,
    field: str,
    exercise_id: Optional[int],
    allowed_values: Optional[set[str]] = None,
    default: Optional[str] = None,
) -> Optional[str]:
    raw = _to_serializable_value(value, field=field, exercise_id=exercise_id)
    if raw is None:
        return default

    normalized = raw.strip().lower()
    if not normalized:
        return default

    if allowed_values is not None and normalized not in allowed_values:
        logger.warning(
            "ai_generator.exercise.invalid_value",
            extra={
                "field": field,
                "exercise_id": exercise_id,
                "value": normalized,
                "allowed_values": sorted(allowed_values),
            },
        )
        return default

    return normalized


def _serialize_exercise_for_ai(exercise: Exercise) -> ExerciseCatalogItem:
    exercise_id = getattr(exercise, "id", None)
    exercise_name = (
        exercise.get_name("es")
        if hasattr(exercise, "get_name")
        else getattr(exercise, "name_es", None) or getattr(exercise, "name_en", None)
    )

    return ExerciseCatalogItem(
        id=exercise_id,
        name=exercise_name or f"Exercise {exercise_id}",
        type=_normalize_catalog_value(
            getattr(exercise, "type", None),
            field="type",
            exercise_id=exercise_id,
            allowed_values=ALLOWED_EXERCISE_TYPES,
            default="multiarticular",
        ),
        category=getattr(exercise, "category", None),
        primary_muscles=list(getattr(exercise, "primary_muscle_names", None) or []),
        secondary_muscles=list(getattr(exercise, "secondary_muscle_names", None) or []),
        difficulty_level=getattr(exercise, "difficulty_level", None),
        equipment_needed=getattr(exercise, "equipment_needed", None),
        resistance_profile=_normalize_catalog_value(
            getattr(exercise, "resistance_profile", None),
            field="resistance_profile",
            exercise_id=exercise_id,
            allowed_values=ALLOWED_RESISTANCE_PROFILES,
            default=None,
        ),
        exercise_class=_normalize_catalog_value(
            getattr(exercise, "exercise_class", None),
            field="exercise_class",
            exercise_id=exercise_id,
            allowed_values=ALLOWED_EXERCISE_CLASSES,
            default="strength",
        ),
        cardio_subclass=_normalize_catalog_value(
            getattr(exercise, "cardio_subclass", None),
            field="cardio_subclass",
            exercise_id=exercise_id,
            allowed_values=ALLOWED_CARDIO_SUBCLASSES,
            default=None,
        ),
        intensity_zone=getattr(exercise, "intensity_zone", None),
        target_heart_rate_min=getattr(exercise, "target_heart_rate_min", None),
        target_heart_rate_max=getattr(exercise, "target_heart_rate_max", None),
        calories_per_minute=getattr(exercise, "calories_per_minute", None),
    )


def _build_exercise_catalog(exercises: list[Exercise]) -> list[dict]:
    catalog: list[dict] = []
    for exercise in exercises:
        try:
            catalog_item = _serialize_exercise_for_ai(exercise)
            catalog.append(catalog_item.model_dump(mode="json"))
        except Exception:
            logger.exception(
                "ai_generator.exercise.serialization_failed",
                extra={"exercise_id": getattr(exercise, "id", None)},
            )
    return catalog


def _enforce_single_microcycle(request: AIWorkoutRequest) -> Optional[str]:
    """
    Fuerza que la generaciÐ˜n se limite a un solo microciclo
    para reducir consumo de tokens. Devuelve warning si hubo ajuste.
    """
    warning = None

    if request.program_duration.total_weeks != 1:
        warning = (
            f"GeneraciÐ˜n limitada a 1 microciclo por intento "
            f"(valor solicitado: {request.program_duration.total_weeks} semanas)"
        )
        request.program_duration.total_weeks = 1

    if request.program_duration.mesocycle_weeks != 1:
        request.program_duration.mesocycle_weeks = 1

    # Las semanas de descarga no aplican cuando solo hay 1 microciclo
    request.program_duration.include_deload = False
    return warning


def _trim_to_single_microcycle(macrocycle_dict: dict) -> dict:
    """
    Asegura que solo se conserve 1 microciclo en la respuesta generada.
    """
    if not macrocycle_dict:
        return macrocycle_dict

    mesocycles = macrocycle_dict.get("mesocycles", [])
    if not mesocycles:
        return macrocycle_dict

    mesocycles = mesocycles[:1]
    macrocycle_dict["mesocycles"] = mesocycles

    first_meso = mesocycles[0]
    microcycles = first_meso.get("microcycles", [])
    first_meso["microcycles"] = microcycles[:1] if microcycles else []
    return macrocycle_dict


def _attach_patient_context(request: AIWorkoutRequest, db: Session) -> None:
    """
    AÃ±ade patient_context al request si el modo es CLIENT y no viene explÃ­cito.
    """
    if request.creation_mode != CreationMode.CLIENT:
        return
    if request.patient_context or not request.client_id:
        return

    context = build_patient_context(db, request.client_id)
    if context:
        request.patient_context = context
        request.context_version = context.context_version


def _enforce_client_age_from_db(request: AIWorkoutRequest, db: Session) -> None:
    if request.creation_mode != CreationMode.CLIENT:
        return

    if not request.client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere client_id para creation_mode=client",
        )

    try:
        parsed_client_id = int(request.client_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_id debe ser numerico",
        ) from exc

    client = db.query(User).filter(
        User.id == parsed_client_id,
        User.role == UserRole.CLIENT,
    ).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )

    request.user_profile.age = calculate_age_from_date_of_birth(
        client.date_of_birth,
        min_age=14,
        max_age=100,
    )


def _ensure_trainer_or_admin(current_user: User) -> None:
    assert_training_professional_access(current_user)


@router.get("/questionnaire-config", response_model=QuestionnaireConfig)
def get_questionnaire_config(
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene la configuraciÃ³n del cuestionario para el frontend.
    Define los pasos y campos del formulario.
    """
    _ensure_trainer_or_admin(current_user)

    steps = [
        QuestionnaireStep(
            step_id="personal",
            title="Datos personales y contacto",
            description="InformaciÃ³n general del cliente para contacto y emergencias",
            fields=[
                {"name": "document_id", "type": "text", "required": False, "label": "Documento de identidad"},
                {"name": "phone", "type": "text", "required": False, "label": "TelÃ©fono"},
                {"name": "address", "type": "textarea", "required": False, "label": "DirecciÃ³n"},
                {"name": "emergency_contact_name", "type": "text", "required": False, "label": "Contacto de emergencia"},
                {"name": "emergency_contact_phone", "type": "text", "required": False, "label": "TelÃ©fono de emergencia"},
                {"name": "insurance_provider", "type": "text", "required": False, "label": "Aseguradora"},
                {"name": "policy_number", "type": "text", "required": False, "label": "NÃºmero de pÃ³liza"},
            ]
        ),
        QuestionnaireStep(
            step_id="profile",
            title="Perfil de entrenamiento",
            description="CuÃ©ntanos sobre tu nivel y experiencia para personalizar tu programa",
            fields=[
                {"name": "fitness_level", "type": "select", "required": True,
                 "label": "Nivel de fitness",
                 "options": ["beginner", "intermediate", "advanced"]},
                {"name": "gender", "type": "select", "required": False,
                 "label": "GÃ©nero",
                 "options": ["male", "female", "other"]},
                {"name": "training_experience_months", "type": "number", "required": False,
                 "label": "Meses de experiencia", "min": 0, "max": 600},
            ]
        ),
        QuestionnaireStep(
            step_id="goals",
            title="Objetivos",
            description="Â¿QuÃ© quieres lograr con tu entrenamiento?",
            fields=[
                {"name": "primary_goal", "type": "select", "required": True,
                 "label": "Objetivo principal",
                 "options": [
                     {"value": "hypertrophy", "label": "Ganar masa muscular"},
                     {"value": "strength", "label": "Aumentar fuerza"},
                     {"value": "power", "label": "Mejorar potencia"},
                     {"value": "endurance", "label": "Resistencia muscular"},
                     {"value": "fat_loss", "label": "Perder grasa"},
                     {"value": "general_fitness", "label": "Fitness general"},
                 ]},
                {"name": "specific_goals", "type": "textarea", "required": False,
                 "label": "Objetivos especÃ­ficos",
                 "placeholder": "Ej: Aumentar press banca, mejorar postura..."},
                {"name": "target_muscle_groups", "type": "multiselect", "required": False,
                 "label": "Grupos musculares a enfatizar",
                 "options": ["chest", "back", "shoulders", "arms", "legs", "core"]},
            ]
        ),
        QuestionnaireStep(
            step_id="availability",
            title="Disponibilidad",
            description="Â¿CuÃ¡nto tiempo puedes dedicar al entrenamiento?",
            fields=[
                {"name": "days_per_week", "type": "slider", "required": True,
                 "label": "DÃ­as por semana", "min": 1, "max": 7, "default": 4},
                {"name": "session_duration_minutes", "type": "slider", "required": True,
                 "label": "DuraciÃ³n por sesiÃ³n (minutos)", "min": 20, "max": 120, "default": 60},
                {"name": "preferred_days", "type": "multiselect", "required": False,
                 "label": "DÃ­as preferidos",
                 "options": [
                     {"value": 1, "label": "Lunes"},
                     {"value": 2, "label": "Martes"},
                     {"value": 3, "label": "MiÃ©rcoles"},
                     {"value": 4, "label": "Jueves"},
                     {"value": 5, "label": "Viernes"},
                     {"value": 6, "label": "SÃ¡bado"},
                     {"value": 7, "label": "Domingo"},
                 ]},
            ]
        ),
        QuestionnaireStep(
            step_id="equipment",
            title="Equipamiento",
            description="Â¿QuÃ© equipamiento tienes disponible?",
            fields=[
                {"name": "has_gym_access", "type": "boolean", "required": True,
                 "label": "Â¿Tienes acceso a un gimnasio?"},
                {"name": "available_equipment", "type": "multiselect", "required": True,
                 "label": "Equipamiento disponible",
                 "options": [
                     {"value": "barbell", "label": "Barra olÃ­mpica"},
                     {"value": "dumbbells", "label": "Mancuernas"},
                     {"value": "cables", "label": "Poleas/Cables"},
                     {"value": "machines", "label": "MÃ¡quinas"},
                     {"value": "kettlebells", "label": "Kettlebells"},
                     {"value": "resistance_bands", "label": "Bandas elÃ¡sticas"},
                     {"value": "pull_up_bar", "label": "Barra de dominadas"},
                     {"value": "bench", "label": "Banco"},
                     {"value": "squat_rack", "label": "Rack de sentadillas"},
                     {"value": "bodyweight", "label": "Solo peso corporal"},
                 ]},
                {"name": "equipment_notes", "type": "textarea", "required": False,
                 "label": "Notas adicionales sobre equipamiento"},
            ]
        ),
        QuestionnaireStep(
            step_id="restrictions",
            title="Restricciones",
            description="Â¿Tienes alguna limitaciÃ³n fÃ­sica que debamos considerar?",
            fields=[
                {"name": "injuries", "type": "textarea", "required": False,
                 "label": "Lesiones actuales o pasadas",
                 "placeholder": "Ej: Dolor de rodilla izquierda, hernia discal L5..."},
                {"name": "excluded_exercises", "type": "textarea", "required": False,
                 "label": "Ejercicios que deseas evitar",
                 "placeholder": "Ej: Sentadilla trasera, peso muerto convencional..."},
                {"name": "medical_conditions", "type": "textarea", "required": False,
                 "label": "Condiciones mÃ©dicas relevantes"},
                {"name": "mobility_limitations", "type": "textarea", "required": False,
                 "label": "Limitaciones de movilidad"},
            ]
        ),
        QuestionnaireStep(
            step_id="preferences",
            title="Preferencias y DuraciÃ³n",
            description="Personaliza tu programa",
            fields=[
                {"name": "exercise_variety", "type": "select", "required": False,
                 "label": "Variedad de ejercicios",
                 "options": [
                     {"value": "low", "label": "Baja - Ejercicios bÃ¡sicos repetidos"},
                     {"value": "medium", "label": "Media - Balance entre variedad y consistencia"},
                     {"value": "high", "label": "Alta - MÃ¡xima variedad"},
                 ],
                 "default": "medium"},
                {"name": "include_cardio", "type": "boolean", "required": False,
                 "label": "Incluir cardio", "default": False},
                {"name": "include_warmup", "type": "boolean", "required": False,
                 "label": "Incluir calentamiento", "default": True},
                {"name": "preferred_training_style", "type": "select", "required": False,
                 "label": "Estilo de entrenamiento preferido",
                 "options": [
                     {"value": "", "label": "Dejar que la IA decida"},
                     {"value": "push_pull_legs", "label": "Push/Pull/Legs"},
                     {"value": "upper_lower", "label": "Upper/Lower"},
                     {"value": "full_body", "label": "Full Body"},
                     {"value": "bro_split", "label": "Bro Split (1 mÃºsculo/dÃ­a)"},
                 ]},
                {"name": "total_weeks", "type": "slider", "required": True,
                 "label": "DuraciÃ³n del programa (semanas)", "min": 1, "max": 16, "default": 8},
                {"name": "mesocycle_weeks", "type": "slider", "required": False,
                 "label": "DuraciÃ³n de cada bloque (semanas)", "min": 1, "max": 6, "default": 4},
                {"name": "include_deload", "type": "boolean", "required": False,
                 "label": "Incluir semanas de descarga", "default": True},
                {"name": "start_date", "type": "date", "required": True,
                 "label": "Fecha de inicio"},
            ]
        ),
    ]

    return QuestionnaireConfig(
        steps=steps,
        total_steps=len(steps)
    )


@router.get("/validate-interview/{client_id}", response_model=InterviewValidationResponse)
def validate_client_interview(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Valida si la entrevista de un cliente tiene todos los campos requeridos
    para generar un programa con IA.

    Retorna:
    - is_complete: True si la entrevista estÃ¡ completa
    - missing_fields: Lista de campos faltantes (traducidos a espaÃ±ol)
    - has_interview: True si el cliente tiene entrevista
    - client_name: Nombre del cliente
    """
    _ensure_trainer_or_admin(current_user)

    try:
        parsed_client_id = int(client_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_id debe ser numerico",
        ) from exc

    # Verificar que el cliente existe
    client = db.query(User).filter(
        User.id == parsed_client_id,
        User.role == UserRole.CLIENT
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    # Obtener entrevista
    interview = db.query(ClientInterview).filter(
        ClientInterview.client_id == parsed_client_id
    ).first()

    # Validar
    validation = InterviewToAIRequestMapper.validate_interview_for_ai(interview)

    return InterviewValidationResponse(
        is_complete=validation["is_complete"],
        missing_fields=validation["missing_fields"],
        has_interview=validation["has_interview"],
        client_name=client.full_name
    )


@router.get("/interview-data/{client_id}", response_model=InterviewDataResponse)
def get_interview_as_ai_request(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene los datos de la entrevista de un cliente en el formato
    requerido por AIWorkoutRequest (sin program_duration).

    Ãštil para pre-cargar datos cuando se genera un programa para un cliente.
    """
    _ensure_trainer_or_admin(current_user)

    try:
        parsed_client_id = int(client_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_id debe ser numerico",
        ) from exc

    # Verificar cliente
    client = db.query(User).filter(
        User.id == parsed_client_id,
        User.role == UserRole.CLIENT,
    ).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    # Obtener entrevista
    interview = db.query(ClientInterview).filter(
        ClientInterview.client_id == parsed_client_id
    ).first()

    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El cliente no tiene entrevista. Por favor complete la entrevista primero."
        )

    # Validar que estÃ¡ completa
    is_complete, missing_fields = interview.is_complete_for_ai()
    if not is_complete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La entrevista estÃ¡ incompleta. Campos faltantes: {', '.join(missing_fields)}"
        )

    # Mapear a secciones de AI request
    sections = InterviewToAIRequestMapper.map_interview_to_ai_sections(interview)
    sections["user_profile"].age = calculate_age_from_date_of_birth(
        client.date_of_birth,
        min_age=14,
        max_age=100,
    )

    return {
        "client_id": str(parsed_client_id),
        "client_name": client.full_name,
        "user_profile": sections["user_profile"].model_dump(),
        "goals": sections["goals"].model_dump(),
        "availability": sections["availability"].model_dump(),
        "equipment": sections["equipment"].model_dump(),
        "restrictions": sections["restrictions"].model_dump() if sections["restrictions"] else None,
        "preferences": sections["preferences"].model_dump() if sections["preferences"] else None,
    }


@router.post("/test-generate", response_model=AIWorkoutResponse)
async def test_generate_workout(
    request: AIWorkoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint de PRUEBA que genera datos mock sin llamar a la API de Claude.
    Ãštil para probar el flujo completo sin gastar crÃ©ditos.
    """
    _ensure_trainer_or_admin(current_user)

    # Limitar a un solo microciclo
    single_cycle_warning = _enforce_single_microcycle(request)
    _enforce_client_age_from_db(request, db)

    # Obtener ejercicios reales de la DB para usar IDs vÃ¡lidos
    exercises = db.query(Exercise).limit(50).all()
    if not exercises:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay ejercicios en la base de datos"
        )

    # Organizar ejercicios por categorÃ­a/tipo (usar name_en para filtrado)
    chest_exercises = [e for e in exercises if "bench" in (e.name_en or "").lower() or "chest" in (e.name_en or "").lower() or "push" in (e.name_en or "").lower()]
    back_exercises = [e for e in exercises if "row" in (e.name_en or "").lower() or "pull" in (e.name_en or "").lower() or "lat" in (e.name_en or "").lower()]
    leg_exercises = [e for e in exercises if "squat" in (e.name_en or "").lower() or "leg" in (e.name_en or "").lower() or "lunge" in (e.name_en or "").lower()]
    shoulder_exercises = [e for e in exercises if "shoulder" in (e.name_en or "").lower() or "press" in (e.name_en or "").lower() or "raise" in (e.name_en or "").lower()]

    # Fallback si no hay suficientes de cada tipo
    all_exercises = list(exercises)
    if len(chest_exercises) < 3:
        chest_exercises = all_exercises[:3]
    if len(back_exercises) < 3:
        back_exercises = all_exercises[3:6]
    if len(leg_exercises) < 3:
        leg_exercises = all_exercises[6:9]
    if len(shoulder_exercises) < 3:
        shoulder_exercises = all_exercises[9:12]

    def make_exercise(ex, order: int, sets: int = 3, reps_min: int = 8, reps_max: int = 12, duration_seconds: int = None):
        return {
            "exercise_id": ex.id,
            "exercise_name": ex.get_name("es"),
            "order_index": order,
            "sets": sets,
            "reps_min": reps_min,
            "reps_max": reps_max,
            "duration_seconds": duration_seconds,
            "rest_seconds": 90,
            "effort_type": "RIR",
            "effort_value": 2,
            "tempo": "2-0-2-0",
            "notes": None
        }

    # Construir programa mock basado en dÃ­as disponibles
    days_per_week = request.availability.days_per_week
    total_weeks = request.program_duration.total_weeks

    _attach_patient_context(request, db)

    # Crear dÃ­as de entrenamiento segÃºn disponibilidad
    training_days = []
    if days_per_week >= 4:
        # Push/Pull/Legs/Upper
        training_days = [
            {
                "day_number": 1,
                "name": "Push - Pecho y TrÃ­ceps",
                "focus": "chest",
                "rest_day": False,
                "exercises": [
                    make_exercise(chest_exercises[0], 0, 4, 6, 8),
                    make_exercise(chest_exercises[1] if len(chest_exercises) > 1 else chest_exercises[0], 1, 3, 10, 12),
                    make_exercise(shoulder_exercises[0], 2, 3, 10, 12),
                ],
                "warmup_notes": "5-10 min calentamiento articular"
            },
            {
                "day_number": 2,
                "name": "Pull - Espalda y BÃ­ceps",
                "focus": "back",
                "rest_day": False,
                "exercises": [
                    make_exercise(back_exercises[0], 0, 4, 6, 8),
                    make_exercise(back_exercises[1] if len(back_exercises) > 1 else back_exercises[0], 1, 3, 10, 12),
                    make_exercise(back_exercises[2] if len(back_exercises) > 2 else back_exercises[0], 2, 3, 10, 12),
                ],
                "warmup_notes": "5-10 min calentamiento articular"
            },
            {
                "day_number": 3,
                "name": "Descanso",
                "focus": "recovery",
                "rest_day": True,
                "exercises": []
            },
            {
                "day_number": 4,
                "name": "Piernas",
                "focus": "legs",
                "rest_day": False,
                "exercises": [
                    make_exercise(leg_exercises[0], 0, 4, 6, 8),
                    make_exercise(leg_exercises[1] if len(leg_exercises) > 1 else leg_exercises[0], 1, 3, 10, 12),
                    make_exercise(leg_exercises[2] if len(leg_exercises) > 2 else leg_exercises[0], 2, 3, 12, 15),
                ],
                "warmup_notes": "5-10 min calentamiento articular"
            },
        ]
    elif days_per_week >= 3:
        # Full body 3 dÃ­as
        training_days = [
            {
                "day_number": 1,
                "name": "Full Body A",
                "focus": "compound",
                "rest_day": False,
                "exercises": [
                    make_exercise(leg_exercises[0], 0, 4, 6, 8),
                    make_exercise(chest_exercises[0], 1, 3, 8, 10),
                    make_exercise(back_exercises[0], 2, 3, 8, 10),
                ],
                "warmup_notes": "5-10 min calentamiento"
            },
            {
                "day_number": 2,
                "name": "Descanso",
                "focus": "recovery",
                "rest_day": True,
                "exercises": []
            },
            {
                "day_number": 3,
                "name": "Full Body B",
                "focus": "compound",
                "rest_day": False,
                "exercises": [
                    make_exercise(back_exercises[1] if len(back_exercises) > 1 else back_exercises[0], 0, 4, 6, 8),
                    make_exercise(shoulder_exercises[0], 1, 3, 10, 12),
                    make_exercise(leg_exercises[1] if len(leg_exercises) > 1 else leg_exercises[0], 2, 3, 10, 12),
                ],
                "warmup_notes": "5-10 min calentamiento"
            },
        ]
    else:
        # 2 dÃ­as o menos
        training_days = [
            {
                "day_number": 1,
                "name": "Full Body",
                "focus": "compound",
                "rest_day": False,
                "exercises": [
                    make_exercise(leg_exercises[0], 0, 4, 8, 10),
                    make_exercise(chest_exercises[0], 1, 3, 8, 10),
                    make_exercise(back_exercises[0], 2, 3, 8, 10),
                ],
                "warmup_notes": "5-10 min calentamiento"
            },
        ]

    # Crear microciclos (semanas)
    microcycles = []
    for week in range(1, total_weeks + 1):
        intensity = "high" if week % 4 != 0 else "deload"
        microcycles.append({
            "week_number": week,
            "name": f"Semana {week}" + (" (Descarga)" if intensity == "deload" else ""),
            "intensity_level": intensity,
            "training_days": training_days,
            "weekly_notes": "Semana de descarga - reducir volumen 40%" if intensity == "deload" else None
        })

    # Agrupar en mesociclos de 4 semanas
    mesocycles = []
    weeks_per_meso = request.program_duration.mesocycle_weeks
    for i in range(0, len(microcycles), weeks_per_meso):
        block_num = (i // weeks_per_meso) + 1
        meso_micros = microcycles[i:i + weeks_per_meso]
        mesocycles.append({
            "block_number": block_num,
            "name": f"Bloque {block_num} - {'AcumulaciÃ³n' if block_num % 2 == 1 else 'IntensificaciÃ³n'}",
            "focus": request.goals.primary_goal.value,
            "description": f"Bloque de {len(meso_micros)} semanas",
            "microcycles": meso_micros
        })

    # Construir respuesta mock
    from schemas.ai_generator import (
        GeneratedMacrocycle,
        GeneratedMesocycle,
        GeneratedMicrocycle,
        GeneratedTrainingDay,
        GeneratedDayExercise,
        ProgramExplanation,
    )

    mock_response = AIWorkoutResponse(
        success=True,
        macrocycle=GeneratedMacrocycle(
            name=f"Programa de {request.goals.primary_goal.value.replace('_', ' ').title()} - {total_weeks} semanas",
            description=f"Programa personalizado de {total_weeks} semanas para {request.goals.primary_goal.value}",
            objective=request.goals.primary_goal.value,
            mesocycles=[
                GeneratedMesocycle(
                    block_number=m["block_number"],
                    name=m["name"],
                    focus=m["focus"],
                    description=m["description"],
                    microcycles=[
                        GeneratedMicrocycle(
                            week_number=mc["week_number"],
                            name=mc["name"],
                            intensity_level=mc["intensity_level"],
                            training_days=[
                                GeneratedTrainingDay(
                                    day_number=d["day_number"],
                                    name=d["name"],
                                    focus=d["focus"],
                                    rest_day=d["rest_day"],
                                    exercises=[
                                        GeneratedDayExercise(**ex) for ex in d["exercises"]
                                    ],
                                    warmup_notes=d.get("warmup_notes")
                                ) for d in mc["training_days"]
                            ],
                            weekly_notes=mc.get("weekly_notes")
                        ) for mc in m["microcycles"]
                    ]
                ) for m in mesocycles
            ]
        ),
        explanation=ProgramExplanation(
            rationale="[MOCK] Programa generado para pruebas sin usar la API de Claude",
            progression_strategy="ProgresiÃ³n lineal con descarga cada 4 semanas",
            deload_strategy="ReducciÃ³n del 40% en volumen cada 4ta semana",
            volume_distribution="DistribuciÃ³n equitativa entre grupos musculares",
            tips=[
                "Este es un programa de PRUEBA",
                "Los ejercicios son reales pero la estructura es simplificada",
                "Usa /generate para generar un programa real con IA"
            ]
        ),
        warnings=["âš ï¸ MODO TEST: Este programa fue generado sin IA para pruebas"]
    )

    if single_cycle_warning:
        mock_response.warnings.append(single_cycle_warning)

    return mock_response


@router.post("/generate", response_model=AIWorkoutResponse)
async def generate_workout(
    request: AIWorkoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Genera un programa de entrenamiento completo usando IA.

    Requiere rol de trainer o admin.
    """
    # Verificar permisos
    _ensure_trainer_or_admin(current_user)

    # Limitar a un solo microciclo para ahorrar tokens
    single_cycle_warning = _enforce_single_microcycle(request)
    _enforce_client_age_from_db(request, db)

    phase = "load_exercises"
    try:
        # Obtener ejercicios disponibles con datos de músculos
        exercises = db.query(Exercise).all()
        phase = "serialize_exercises"
        exercise_list = _build_exercise_catalog(exercises)

        if not exercise_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No hay ejercicios en la base de datos. Por favor, agregue ejercicios primero.",
            )

        # Enriquecer con contexto de paciente si aplica y no se envió explícitamente
        phase = "attach_patient_context"
        _attach_patient_context(request, db)

        # Generar programa
        phase = "generate_workout"
        generator = AIWorkoutGenerator()
        result = await generator.generate_workout(request, exercise_list)

        # Mapear ejercicios inválidos a equivalentes válidos
        if result.success and result.macrocycle:
            mapper = ExerciseMapper(exercise_list)
            macrocycle_dict = _trim_to_single_microcycle(result.macrocycle.model_dump())
            mapped_macrocycle = mapper.map_exercises_in_program(macrocycle_dict)
            result.macrocycle = GeneratedMacrocycle(**mapped_macrocycle)

            # Agregar warnings si hubo remapeos
            if mapper.mapped_count > 0:
                result.warnings = result.warnings or []
                result.warnings.append(
                    f"{mapper.mapped_count} ejercicio(s) fueron remapeados a equivalentes válidos del catálogo"
                )

            # Agregar warning si hay ejercicios sin mapear
            if mapper.unmapped_exercises:
                result.warnings = result.warnings or []
                unique_unmapped = list(set(mapper.unmapped_exercises))[:5]
                result.warnings.append(
                    f"No se encontraron equivalentes para: {', '.join(unique_unmapped)}"
                    + (f" y {len(mapper.unmapped_exercises) - 5} más" if len(mapper.unmapped_exercises) > 5 else "")
                )

        if single_cycle_warning:
            result.warnings = result.warnings or []
            result.warnings.append(single_cycle_warning)

        return result
    except HTTPException:
        raise
    except Exception:
        request_id = str(uuid4())
        logger.exception(
            "ai_generator.generate.failed",
            extra={
                "request_id": request_id,
                "user_id": getattr(current_user, "id", None),
                "endpoint": "/api/ai/generate",
                "phase": phase,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "AI_GENERATION_FAILED",
                "message": "No se pudo generar el programa de entrenamiento. Intenta nuevamente en unos minutos.",
                "request_id": request_id,
            },
        )

@router.post("/preview", response_model=AIWorkoutResponse)
async def preview_workout(
    request: AIWorkoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Genera una preview del programa (solo 1 semana) para revisión rápida.
    """
    _ensure_trainer_or_admin(current_user)

    # Limitar a un solo microciclo
    single_cycle_warning = _enforce_single_microcycle(request)
    _enforce_client_age_from_db(request, db)

    phase = "load_exercises"
    try:
        exercises = db.query(Exercise).all()
        phase = "serialize_exercises"
        exercise_list = _build_exercise_catalog(exercises)

        if not exercise_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No hay ejercicios en la base de datos. Por favor, agregue ejercicios primero.",
            )

        phase = "attach_patient_context"
        _attach_patient_context(request, db)

        phase = "generate_preview"
        generator = AIWorkoutGenerator()
        result = await generator.generate_preview(request, exercise_list)

        # Mapear ejercicios inválidos a equivalentes válidos
        if result.success and result.macrocycle:
            mapper = ExerciseMapper(exercise_list)
            macrocycle_dict = _trim_to_single_microcycle(result.macrocycle.model_dump())
            mapped_macrocycle = mapper.map_exercises_in_program(macrocycle_dict)
            result.macrocycle = GeneratedMacrocycle(**mapped_macrocycle)

            if mapper.mapped_count > 0:
                result.warnings = result.warnings or []
                result.warnings.append(
                    f"{mapper.mapped_count} ejercicio(s) fueron remapeados a equivalentes válidos"
                )

        if single_cycle_warning:
            result.warnings = result.warnings or []
            result.warnings.append(single_cycle_warning)

        return result
    except HTTPException:
        raise
    except Exception:
        request_id = str(uuid4())
        logger.exception(
            "ai_generator.preview.failed",
            extra={
                "request_id": request_id,
                "user_id": getattr(current_user, "id", None),
                "endpoint": "/api/ai/preview",
                "phase": phase,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "AI_PREVIEW_FAILED",
                "message": "No se pudo generar la vista previa del programa. Intenta nuevamente en unos minutos.",
                "request_id": request_id,
            },
        )

@router.post("/save")
async def save_generated_workout(
    save_request: SaveWorkoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Guarda un programa generado por IA en la base de datos.

    Soporta dos modos:
    - template: Guarda como plantilla (client_id=None)
    - client: Guarda como programa de cliente (client_id=UUID)
    """
    _ensure_trainer_or_admin(current_user)

    # Validar segÃºn modo
    if save_request.creation_mode == CreationMode.CLIENT and not save_request.client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere client_id para crear programa de cliente"
        )

    if save_request.creation_mode == CreationMode.TEMPLATE and not save_request.template_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere template_name para crear plantilla"
        )

    try:
        # Convertir el macrocycle a diccionario para trabajar con Ã©l
        macrocycle_data = _trim_to_single_microcycle(save_request.workout_data.macrocycle.model_dump())

        # Obtener IDs de ejercicios vÃ¡lidos de la DB
        valid_exercise_ids = {ex.id for ex in db.query(Exercise.id).all()}

        # Contador de ejercicios filtrados
        filtered_exercises_count = 0

        # Determinar nombre segÃºn modo
        if save_request.creation_mode == CreationMode.TEMPLATE:
            program_name = save_request.template_name or macrocycle_data.get("name", "Plantilla Generada por IA")
            program_client_id = None  # Plantilla no tiene cliente
        else:
            program_name = macrocycle_data.get("name", "Programa Generado por IA")
            program_client_id = save_request.client_id

        # Calcular fechas del macrociclo en base a la duraciÃƒÂ³n real (un solo microciclo)
        def _microcycle_length_days(micro: dict) -> int:
            if not micro.get("training_days"):
                return 7
            return max(day.get("day_number", 1) for day in micro.get("training_days", []))

        start_date = save_request.program_duration.start_date
        macrocycle_total_days = 0
        for meso_data in macrocycle_data.get("mesocycles", []):
            for micro_data in meso_data.get("microcycles", []):
                macrocycle_total_days += _microcycle_length_days(micro_data)

        if macrocycle_total_days == 0:
            macrocycle_total_days = 7

        end_date = start_date + timedelta(days=macrocycle_total_days - 1)

        # Crear Macrocycle
        macrocycle = Macrocycle(
            name=program_name,
            description=macrocycle_data.get("description"),
            objective=macrocycle_data.get("objective", save_request.goals.primary_goal.value),
            start_date=start_date,
            end_date=end_date,
            client_id=program_client_id,
            trainer_id=current_user.id,
            status=MesocycleStatus.DRAFT
        )
        db.add(macrocycle)
        db.flush()

        # Crear estructura anidada
        weeks_per_mesocycle = save_request.program_duration.mesocycle_weeks
        current_day_offset = 0

        for meso_data in macrocycle_data.get("mesocycles", []):
            block_number = meso_data.get("block_number", 1)

            meso_start = start_date + timedelta(days=current_day_offset)
            mesocycle = Mesocycle(
                macrocycle_id=macrocycle.id,
                block_number=block_number,
                name=meso_data.get("name") or f"Bloque {block_number}",
                description=meso_data.get("description"),
                start_date=meso_start,
                end_date=meso_start,  # se actualiza luego
                focus=meso_data.get("focus"),
            )
            db.add(mesocycle)
            db.flush()

            meso_day_span = 0

            for micro_data in meso_data.get("microcycles", []):
                week_number = micro_data.get("week_number", (current_day_offset // 7) + 1)

                micro_start = start_date + timedelta(days=current_day_offset)
                micro_days = _microcycle_length_days(micro_data)
                micro_end = micro_start + timedelta(days=micro_days - 1)

                microcycle = Microcycle(
                    mesocycle_id=mesocycle.id,
                    week_number=week_number,
                    name=micro_data.get("name") or f"Semana {week_number}",
                    start_date=micro_start,
                    end_date=micro_end,
                    intensity_level=micro_data.get("intensity_level", "medium"),
                    notes=micro_data.get("weekly_notes"),
                )
                db.add(microcycle)
                db.flush()

                for day_data in micro_data.get("training_days", []):
                    day_number = day_data.get("day_number", 1)

                    # Calcular fecha del dÃ­a (basado en el inicio de la semana)
                    day_date = micro_start + timedelta(days=day_number - 1)

                    training_day = TrainingDay(
                        microcycle_id=microcycle.id,
                        day_number=day_number,
                        date=day_date,
                        name=day_data.get("name") or f"DÃ­a {day_number}",
                        focus=day_data.get("focus"),
                        rest_day=day_data.get("rest_day", False),
                        notes=day_data.get("warmup_notes"),
                    )
                    db.add(training_day)
                    db.flush()

                    for ex_data in day_data.get("exercises", []):
                        exercise_id = ex_data.get("exercise_id")

                        # Validar que el ejercicio existe en la DB
                        if exercise_id not in valid_exercise_ids:
                            filtered_exercises_count += 1
                            continue  # Saltar ejercicios invÃ¡lidos

                        # Determinar si es ejercicio basado en tiempo o reps
                        duration_seconds = ex_data.get("duration_seconds")
                        reps_min = ex_data.get("reps_min")
                        reps_max = ex_data.get("reps_max")

                        # Si tiene duration_seconds, es basado en tiempo (reps null)
                        # Si no tiene duration_seconds, usar valores por defecto de reps
                        if duration_seconds is None and reps_min is None:
                            reps_min = 8
                        if duration_seconds is None and reps_max is None:
                            reps_max = 12

                        day_exercise = DayExercise(
                            training_day_id=training_day.id,
                            exercise_id=exercise_id,
                            order_index=ex_data.get("order_index", 0),
                            sets=ex_data.get("sets", 3),
                            phase=ExercisePhase(ex_data.get("phase", ExercisePhase.MAIN.value)),
                            reps_min=reps_min,
                            reps_max=reps_max,
                            duration_seconds=duration_seconds,
                            rest_seconds=ex_data.get("rest_seconds", 90),
                            effort_type=ex_data.get("effort_type", "RIR"),
                            effort_value=ex_data.get("effort_value", 2),
                            tempo=ex_data.get("tempo"),
                            notes=ex_data.get("notes"),
                        )
                        db.add(day_exercise)

                current_day_offset += micro_days
                meso_day_span += micro_days

            # Si el mesociclo no tiene microciclos, usar duraciÃ³n por defecto
            if meso_day_span == 0:
                meso_day_span = (weeks_per_mesocycle or 1) * 7
                current_day_offset += meso_day_span

            mesocycle.start_date = meso_start
            mesocycle.end_date = meso_start + timedelta(days=meso_day_span - 1)

        if current_day_offset > 0:
            macrocycle.end_date = start_date + timedelta(days=current_day_offset - 1)

        db.commit()

        # Construir respuesta con informaciÃ³n de ejercicios filtrados
        response = {
            "success": True,
            "macrocycle_id": macrocycle.id,
            "message": "Programa guardado exitosamente"
        }

        if filtered_exercises_count > 0:
            response["warning"] = (
                f"{filtered_exercises_count} ejercicio(s) fueron omitidos "
                "porque no existen en la base de datos"
            )

        return response

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error guardando programa: {str(e)}"
        )


