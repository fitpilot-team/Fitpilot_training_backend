"""
API router for Exercise endpoints.
Provides CRUD operations for exercises with muscle relationships.
"""
from datetime import UTC, datetime
from enum import Enum
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from core.dependencies import require_trainer
from models.base import get_db
from models.exercise import CardioSubclass, Exercise, ExerciseClass, ExerciseType, ResistanceProfile
from models.exercise_muscle import ExerciseMuscle
from models.muscle import Muscle
from models.user import User
from schemas.exercise import ExerciseCreate, ExerciseListResponse, ExerciseResponse, ExerciseUpdate
from schemas.muscle import ExerciseMuscleResponse
from services.exercise_media_storage import (
    StorageError,
    delete_exercise_media,
    upload_exercise_media,
)

router = APIRouter()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE_MB = 5
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


def _enum_value(value):
    if isinstance(value, Enum):
        return value.value
    return value


def _safe_muscle_display_name(muscle: Muscle) -> str:
    return muscle.display_name_es or muscle.display_name_en or muscle.name


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _resolve_response_timestamps(exercise: Exercise) -> tuple[datetime, datetime]:
    """
    Return non-null timestamps for API responses.
    Keeps response schema stable even for legacy rows with missing dates.
    """
    created_at = exercise.created_at or exercise.updated_at or _utcnow_naive()
    updated_at = exercise.updated_at or created_at
    return created_at, updated_at


def build_exercise_response(exercise: Exercise) -> dict:
    """Build an exercise response with muscle relationships."""
    created_at, updated_at = _resolve_response_timestamps(exercise)
    primary_muscles: List[ExerciseMuscleResponse] = []
    secondary_muscles: List[ExerciseMuscleResponse] = []

    for em in exercise.exercise_muscles:
        muscle_response = ExerciseMuscleResponse(
            muscle_id=str(em.muscle.id),
            muscle_name=em.muscle.name,
            muscle_display_name=_safe_muscle_display_name(em.muscle),
            muscle_category=em.muscle.muscle_category or "core",
            role=em.muscle_role,
        )
        if em.muscle_role == "primary":
            primary_muscles.append(muscle_response)
        else:
            secondary_muscles.append(muscle_response)

    return {
        "id": str(exercise.id),
        "name_en": exercise.name_en,
        "name_es": exercise.name_es,
        "type": _enum_value(exercise.type),
        "resistance_profile": _enum_value(exercise.resistance_profile),
        "category": exercise.category,
        "description_en": exercise.description_en,
        "description_es": exercise.description_es,
        "video_url": exercise.video_url,
        "thumbnail_url": exercise.thumbnail_url,
        "image_url": exercise.image_url,
        "anatomy_image_url": exercise.anatomy_image_url,
        "equipment_needed": exercise.equipment_needed,
        "difficulty_level": exercise.difficulty_level,
        "exercise_class": _enum_value(exercise.exercise_class),
        "cardio_subclass": _enum_value(exercise.cardio_subclass),
        "intensity_zone": exercise.intensity_zone,
        "target_heart_rate_min": exercise.target_heart_rate_min,
        "target_heart_rate_max": exercise.target_heart_rate_max,
        "calories_per_minute": exercise.calories_per_minute,
        "primary_muscles": primary_muscles,
        "secondary_muscles": secondary_muscles,
        "created_at": created_at,
        "updated_at": updated_at,
    }


def _require_existing_exercise(exercise_id: int, db: Session) -> Exercise:
    exercise = (
        db.query(Exercise)
        .options(joinedload(Exercise.exercise_muscles).joinedload(ExerciseMuscle.muscle))
        .filter(Exercise.id == exercise_id)
        .first()
    )
    if exercise is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ejercicio con id {exercise_id} no encontrado",
        )
    return exercise


def _normalize_muscle_ids(primary_muscle_ids: list[str], secondary_muscle_ids: list[str]) -> tuple[list[int], list[int]]:
    try:
        primary = [int(mid) for mid in primary_muscle_ids]
        secondary = [int(mid) for mid in secondary_muscle_ids]
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Muscle IDs must be numeric") from exc
    return primary, secondary


def _validate_muscles_exist(db: Session, muscle_ids: list[int]) -> None:
    if not muscle_ids:
        return
    existing_muscles = db.query(Muscle).filter(Muscle.id.in_(muscle_ids)).all()
    existing_ids = {m.id for m in existing_muscles}
    missing = [str(mid) for mid in muscle_ids if mid not in existing_ids]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"MÃºsculos no encontrados: {', '.join(missing)}",
        )


@router.get("", response_model=ExerciseListResponse)
def list_exercises(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    muscle_id: Optional[int] = Query(None, description="Filter by specific muscle ID"),
    muscle_category: Optional[str] = Query(None, description="Filter by muscle category (chest, back, shoulders, arms, legs, core)"),
    muscle_role: Optional[str] = Query(None, description="Filter by muscle role (primary, secondary)"),
    exercise_type: Optional[ExerciseType] = None,
    exercise_class: Optional[ExerciseClass] = Query(None, description="Filter by exercise class (strength, cardio, plyometric, etc.)"),
    cardio_subclass: Optional[CardioSubclass] = Query(None, description="Filter by cardio subclass (liss, hiit, miss)"),
    resistance_profile: Optional[ResistanceProfile] = Query(None, description="Filter by resistance profile"),
    difficulty_level: Optional[str] = None,
    search: Optional[str] = None,
):
    query = db.query(Exercise).options(
        joinedload(Exercise.exercise_muscles).joinedload(ExerciseMuscle.muscle)
    )

    if muscle_id or muscle_category:
        query = query.join(ExerciseMuscle)
        if muscle_id:
            query = query.filter(ExerciseMuscle.muscle_id == muscle_id)
            if muscle_role:
                query = query.filter(ExerciseMuscle.muscle_role == muscle_role)
        if muscle_category:
            query = query.join(Muscle).filter(Muscle.muscle_category == muscle_category)
            if muscle_role:
                query = query.filter(ExerciseMuscle.muscle_role == muscle_role)

    if exercise_type:
        query = query.filter(Exercise.type == exercise_type.value)

    if exercise_class:
        query = query.filter(Exercise.exercise_class == exercise_class.value)

    if cardio_subclass:
        query = query.filter(Exercise.cardio_subclass == cardio_subclass.value)

    if resistance_profile:
        query = query.filter(Exercise.resistance_profile == resistance_profile.value)

    if difficulty_level:
        query = query.filter(Exercise.difficulty_level == difficulty_level)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Exercise.name_en.ilike(search_pattern))
            | (Exercise.name_es.ilike(search_pattern))
            | (Exercise.description_en.ilike(search_pattern))
            | (Exercise.description_es.ilike(search_pattern))
        )

    total = query.distinct().count()
    exercises = query.distinct().order_by(Exercise.id).offset(skip).limit(limit).all()

    return {"total": total, "exercises": [build_exercise_response(ex) for ex in exercises]}


@router.get("/{exercise_id}", response_model=ExerciseResponse)
def get_exercise(exercise_id: int, db: Session = Depends(get_db)):
    return build_exercise_response(_require_existing_exercise(exercise_id, db))


@router.post("", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
def create_exercise(
    exercise_data: ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer),
):
    del current_user

    existing_exercise = db.query(Exercise).filter(Exercise.name_en == exercise_data.name_en).first()
    if existing_exercise:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un ejercicio con el nombre '{exercise_data.name_en}'",
        )

    primary_ids, secondary_ids = _normalize_muscle_ids(
        exercise_data.primary_muscle_ids,
        exercise_data.secondary_muscle_ids or [],
    )
    _validate_muscles_exist(db, list(set(primary_ids + secondary_ids)))

    exercise_dict = exercise_data.model_dump(mode="json", exclude={"primary_muscle_ids", "secondary_muscle_ids"})
    now = _utcnow_naive()
    exercise_dict["created_at"] = now
    exercise_dict["updated_at"] = now
    new_exercise = Exercise(**exercise_dict)
    db.add(new_exercise)
    db.flush()

    for muscle_id in primary_ids:
        db.add(ExerciseMuscle(exercise_id=new_exercise.id, muscle_id=muscle_id, muscle_role="primary"))

    for muscle_id in secondary_ids:
        if muscle_id not in primary_ids:
            db.add(ExerciseMuscle(exercise_id=new_exercise.id, muscle_id=muscle_id, muscle_role="secondary"))

    db.commit()

    return build_exercise_response(_require_existing_exercise(new_exercise.id, db))


@router.put("/{exercise_id}", response_model=ExerciseResponse)
def update_exercise(
    exercise_id: int,
    exercise_data: ExerciseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer),
):
    del current_user

    exercise = _require_existing_exercise(exercise_id, db)

    if exercise_data.name_en and exercise_data.name_en != exercise.name_en:
        existing = db.query(Exercise).filter(Exercise.name_en == exercise_data.name_en).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un ejercicio con el nombre '{exercise_data.name_en}'",
            )

    update_data = exercise_data.model_dump(
        mode="json",
        exclude_unset=True,
        exclude={"primary_muscle_ids", "secondary_muscle_ids"},
    )
    for field, value in update_data.items():
        setattr(exercise, field, value)

    if exercise_data.primary_muscle_ids is not None:
        primary_ids, secondary_ids = _normalize_muscle_ids(
            exercise_data.primary_muscle_ids,
            exercise_data.secondary_muscle_ids or [],
        )
        _validate_muscles_exist(db, list(set(primary_ids + secondary_ids)))

        db.query(ExerciseMuscle).filter(ExerciseMuscle.exercise_id == exercise_id).delete()

        for muscle_id in primary_ids:
            db.add(ExerciseMuscle(exercise_id=exercise_id, muscle_id=muscle_id, muscle_role="primary"))
        for muscle_id in secondary_ids:
            if muscle_id not in primary_ids:
                db.add(ExerciseMuscle(exercise_id=exercise_id, muscle_id=muscle_id, muscle_role="secondary"))

    exercise.updated_at = _utcnow_naive()
    db.commit()

    return build_exercise_response(_require_existing_exercise(exercise_id, db))


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exercise(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer),
):
    del current_user
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ejercicio con id {exercise_id} no encontrado",
        )
    db.delete(exercise)
    db.commit()
    return None


@router.post("/{exercise_id}/upload-image", response_model=ExerciseResponse)
async def upload_exercise_image(
    exercise_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer),
):
    del current_user

    exercise = _require_existing_exercise(exercise_id, db)

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido. Tipos permitidos: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo ({file_size / 1024 / 1024:.2f}MB) excede el tamaÃ±o mÃ¡ximo ({MAX_FILE_SIZE_MB}MB)",
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo estÃ¡ vacÃ­o",
        )

    old_image_url = exercise.image_url

    try:
        new_image_url = upload_exercise_media(exercise_id=str(exercise_id), file=file)
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al subir la imagen del ejercicio: {str(exc)}",
        ) from exc

    exercise.image_url = new_image_url
    db.commit()

    if old_image_url and old_image_url != new_image_url:
        try:
            delete_exercise_media(old_image_url)
        except StorageError:
            pass

    return build_exercise_response(_require_existing_exercise(exercise_id, db))


@router.delete("/{exercise_id}/image", response_model=ExerciseResponse)
def delete_exercise_image(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer),
):
    del current_user
    exercise = _require_existing_exercise(exercise_id, db)

    if not exercise.image_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El ejercicio no tiene una imagen personalizada",
        )

    try:
        delete_exercise_media(exercise.image_url)
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No se pudo eliminar la imagen en storage: {str(exc)}",
        ) from exc

    exercise.image_url = None
    db.commit()

    return build_exercise_response(_require_existing_exercise(exercise_id, db))


@router.post("/{exercise_id}/fetch-movement-image", response_model=ExerciseResponse)
async def fetch_movement_image(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer),
):
    del current_user
    from services.wger_image import fetch_movement_image as fetch_wger_image, get_mapped_name

    exercise = _require_existing_exercise(exercise_id, db)
    old_thumbnail_url = exercise.thumbnail_url

    search_name = get_mapped_name(exercise.name_en)
    image_url = fetch_wger_image(str(exercise_id), search_name)

    if not image_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"No se encontrÃ³ imagen de movimiento para '{exercise.name_en}' en Wger.de. Intenta subir una imagen personalizada.",
        )

    exercise.thumbnail_url = image_url
    db.commit()

    if old_thumbnail_url and old_thumbnail_url != image_url:
        try:
            delete_exercise_media(old_thumbnail_url)
        except StorageError:
            pass

    return build_exercise_response(_require_existing_exercise(exercise_id, db))


@router.post("/{exercise_id}/generate-anatomy-image", response_model=ExerciseResponse)
async def generate_anatomy_image(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer),
):
    del current_user
    from services.muscle_image import generate_muscle_image_sync

    exercise = _require_existing_exercise(exercise_id, db)
    old_anatomy_image_url = exercise.anatomy_image_url

    primary_relation = next(
        (em for em in exercise.exercise_muscles if em.muscle_role == "primary"),
        None,
    )
    if not primary_relation or not primary_relation.muscle:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El ejercicio no tiene mÃºsculos primarios asignados",
        )

    image_url = generate_muscle_image_sync(
        exercise_id=str(exercise_id),
        muscle_group=primary_relation.muscle.name,
        exercise_name=exercise.name_en,
        use_multicolor=True,
    )

    if not image_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al generar la imagen anatÃ³mica. Por favor, intenta de nuevo.",
        )

    exercise.anatomy_image_url = image_url
    db.commit()

    if old_anatomy_image_url and old_anatomy_image_url != image_url:
        try:
            delete_exercise_media(old_anatomy_image_url)
        except StorageError:
            pass

    return build_exercise_response(_require_existing_exercise(exercise_id, db))
