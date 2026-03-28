import logging
from datetime import date, timedelta
from time import perf_counter
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, aliased, joinedload
from models.base import get_db
from models.user import User
from models.mesocycle import Macrocycle, Mesocycle, Microcycle, TrainingDay, DayExercise, MesocycleStatus, ExercisePhase
from models.exercise import Exercise
from models.exercise_muscle import ExerciseMuscle
from core.timing import elapsed_ms, format_timing_fields
from schemas.mesocycle import (
    MacrocycleCreate, MacrocycleUpdate, MacrocycleResponse, MacrocycleListItemResponse, MacrocycleListResponse,
    MacrocycleActivationResponse,
    MacrocyclePaletteResult,
    MesocycleCreate, MesocycleUpdate, MesocycleResponse, MesocycleListResponse,
    MicrocycleCreate, MicrocycleUpdate, MicrocycleResponse,
    TrainingDayCreate, TrainingDayUpdate, TrainingDayResponse,
    DayExerciseCreate, DayExerciseUpdate, DayExerciseResponse
)
from core.dependencies import (
    assert_macrocycle_access,
    assert_training_professional_access,
    get_current_user,
    get_effective_user_role,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _today() -> date:
    return date.today()


def _normalize_palette_query(q: str) -> str:
    return q.strip()


def _resolve_palette_limit(limit: int) -> int:
    return min(limit, 10)


def _enum_value(value):
    return value.value if hasattr(value, "value") else value


def _build_macrocycle_client_name(macrocycle: Macrocycle) -> Optional[str]:
    client = getattr(macrocycle, "client", None)
    if client is None:
        return None
    display_name = " ".join(
        part.strip()
        for part in [client.name or "", client.lastname or ""]
        if part and part.strip()
    )
    return display_name or None


def _build_macrocycle_palette_result(macrocycle: Macrocycle) -> MacrocyclePaletteResult:
    return MacrocyclePaletteResult(
        id=str(macrocycle.id),
        title=macrocycle.name,
        client_id=str(macrocycle.client_id) if macrocycle.client_id is not None else None,
        client_name=_build_macrocycle_client_name(macrocycle),
        status=str(_enum_value(macrocycle.status)),
        created_at=macrocycle.created_at,
        updated_at=macrocycle.updated_at,
    )


def _get_macrocycle_with_nested_data(db: Session, macrocycle_id: int) -> Optional[Macrocycle]:
    return db.query(Macrocycle).options(
        joinedload(Macrocycle.mesocycles)
            .joinedload(Mesocycle.microcycles)
            .joinedload(Microcycle.training_days)
            .joinedload(TrainingDay.exercises)
            .joinedload(DayExercise.exercise)
            .joinedload(Exercise.exercise_muscles)
            .joinedload(ExerciseMuscle.muscle)
    ).filter(Macrocycle.id == macrocycle_id).first()


def _shift_date(value: Optional[date], delta_days: int) -> Optional[date]:
    if value is None or delta_days == 0:
        return value
    return value + timedelta(days=delta_days)


def _shift_macrocycle_schedule(macrocycle: Macrocycle, delta_days: int) -> int:
    shifted_training_day_count = 0

    macrocycle.start_date = _shift_date(macrocycle.start_date, delta_days)
    macrocycle.end_date = _shift_date(macrocycle.end_date, delta_days)

    for mesocycle in macrocycle.mesocycles or []:
        mesocycle.start_date = _shift_date(mesocycle.start_date, delta_days)
        mesocycle.end_date = _shift_date(mesocycle.end_date, delta_days)

        for microcycle in mesocycle.microcycles or []:
            microcycle.start_date = _shift_date(microcycle.start_date, delta_days)
            microcycle.end_date = _shift_date(microcycle.end_date, delta_days)

            for training_day in microcycle.training_days or []:
                shifted_date = _shift_date(training_day.date, delta_days)
                if shifted_date != training_day.date:
                    shifted_training_day_count += 1
                training_day.date = shifted_date

    return shifted_training_day_count


def _load_other_active_macrocycles(
    db: Session,
    client_id: int,
    exclude_macrocycle_id: int,
) -> list[Macrocycle]:
    return (
        db.query(Macrocycle)
        .filter(
            Macrocycle.client_id == client_id,
            Macrocycle.id != exclude_macrocycle_id,
            Macrocycle.status == MesocycleStatus.ACTIVE,
        )
        .all()
    )


def _get_microcycle_with_nested_data(
    db: Session,
    mesocycle_id: int,
    microcycle_id: int,
) -> Optional[Microcycle]:
    return (
        db.query(Microcycle)
        .options(
            joinedload(Microcycle.training_days)
            .joinedload(TrainingDay.exercises)
            .joinedload(DayExercise.exercise)
            .joinedload(Exercise.exercise_muscles)
            .joinedload(ExerciseMuscle.muscle)
        )
        .filter(
            Microcycle.id == microcycle_id,
            Microcycle.mesocycle_id == mesocycle_id,
        )
        .first()
    )


def _inclusive_day_count(start_date: date, end_date: date) -> int:
    return (end_date - start_date).days + 1


def _sort_microcycles(microcycles: list[Microcycle]) -> list[Microcycle]:
    return sorted(
        microcycles,
        key=lambda microcycle: (
            microcycle.start_date,
            microcycle.week_number,
            microcycle.id or 0,
        ),
    )


def _sort_mesocycles(mesocycles: list[Mesocycle]) -> list[Mesocycle]:
    return sorted(
        mesocycles,
        key=lambda mesocycle: (
            mesocycle.start_date,
            mesocycle.block_number,
            mesocycle.id or 0,
        ),
    )


def _build_canonical_microcycle_name(week_number: int) -> str:
    return f"Microciclo {week_number}"


def _normalize_mesocycle_microcycle_names(mesocycle: Mesocycle) -> None:
    for microcycle in mesocycle.microcycles or []:
        microcycle.name = _build_canonical_microcycle_name(microcycle.week_number)


def _shift_training_day_schedule(training_day: TrainingDay, delta_days: int) -> None:
    training_day.date = _shift_date(training_day.date, delta_days)


def _shift_microcycle_schedule(microcycle: Microcycle, delta_days: int) -> None:
    microcycle.start_date = _shift_date(microcycle.start_date, delta_days)
    microcycle.end_date = _shift_date(microcycle.end_date, delta_days)

    for training_day in microcycle.training_days or []:
        _shift_training_day_schedule(training_day, delta_days)


def _shift_mesocycle_schedule(mesocycle: Mesocycle, delta_days: int) -> None:
    mesocycle.start_date = _shift_date(mesocycle.start_date, delta_days)
    mesocycle.end_date = _shift_date(mesocycle.end_date, delta_days)

    for microcycle in mesocycle.microcycles or []:
        _shift_microcycle_schedule(microcycle, delta_days)


def _clone_day_exercise(db: Session, training_day_id: int, original_exercise: DayExercise) -> DayExercise:
    phase = original_exercise.phase
    # Some existing rows come back as raw strings even though the database column is a native enum.
    if phase is not None and not isinstance(phase, ExercisePhase):
        phase = ExercisePhase(phase)

    duplicated_exercise = DayExercise(
        training_day_id=training_day_id,
        exercise_id=original_exercise.exercise_id,
        order_index=original_exercise.order_index,
        phase=phase,
        sets=original_exercise.sets,
        reps_min=original_exercise.reps_min,
        reps_max=original_exercise.reps_max,
        rest_seconds=original_exercise.rest_seconds,
        effort_type=original_exercise.effort_type,
        effort_value=original_exercise.effort_value,
        tempo=original_exercise.tempo,
        set_type=original_exercise.set_type,
        duration_seconds=original_exercise.duration_seconds,
        intensity_zone=original_exercise.intensity_zone,
        distance_meters=original_exercise.distance_meters,
        target_calories=original_exercise.target_calories,
        intervals=original_exercise.intervals,
        work_seconds=original_exercise.work_seconds,
        interval_rest_seconds=original_exercise.interval_rest_seconds,
        notes=original_exercise.notes,
        rpe_target=original_exercise.rpe_target,
    )
    db.add(duplicated_exercise)
    return duplicated_exercise


def _clone_training_day(
    db: Session,
    microcycle_id: int,
    original_day: TrainingDay,
    new_microcycle_start_date: date,
    original_microcycle_start_date: date,
) -> TrainingDay:
    day_offset = (original_day.date - original_microcycle_start_date).days
    duplicated_day = TrainingDay(
        microcycle_id=microcycle_id,
        day_number=original_day.day_number,
        date=new_microcycle_start_date + timedelta(days=day_offset),
        session_index=original_day.session_index,
        session_label=original_day.session_label,
        name=original_day.name,
        focus=original_day.focus,
        rest_day=original_day.rest_day,
        notes=original_day.notes,
    )
    db.add(duplicated_day)
    db.flush()

    for original_exercise in original_day.exercises or []:
        _clone_day_exercise(db, duplicated_day.id, original_exercise)

    return duplicated_day


def _duplicate_microcycle_tree(
    db: Session,
    mesocycle_id: int,
    original_microcycle: Microcycle,
    new_week_number: int,
) -> Microcycle:
    duration_days = _inclusive_day_count(original_microcycle.start_date, original_microcycle.end_date)
    duplicated_microcycle = Microcycle(
        mesocycle_id=mesocycle_id,
        week_number=new_week_number,
        name=_build_canonical_microcycle_name(new_week_number),
        start_date=original_microcycle.end_date + timedelta(days=1),
        end_date=original_microcycle.end_date + timedelta(days=duration_days),
        intensity_level=original_microcycle.intensity_level,
        notes=original_microcycle.notes,
    )
    db.add(duplicated_microcycle)
    db.flush()

    for original_day in sorted(
        original_microcycle.training_days or [],
        key=lambda day: (day.day_number, day.session_index, day.id or 0),
    ):
        _clone_training_day(
            db,
            duplicated_microcycle.id,
            original_day,
            duplicated_microcycle.start_date,
            original_microcycle.start_date,
        )

    return duplicated_microcycle


def _insert_duplicate_microcycle(
    db: Session,
    macrocycle: Macrocycle,
    mesocycle: Mesocycle,
    original_microcycle: Microcycle,
) -> Microcycle:
    sorted_microcycles = _sort_microcycles(list(mesocycle.microcycles or []))
    original_index = next(
        index for index, microcycle in enumerate(sorted_microcycles)
        if microcycle.id == original_microcycle.id
    )
    duration_days = _inclusive_day_count(original_microcycle.start_date, original_microcycle.end_date)

    duplicated_microcycle = _duplicate_microcycle_tree(
        db=db,
        mesocycle_id=mesocycle.id,
        original_microcycle=original_microcycle,
        new_week_number=original_microcycle.week_number + 1,
    )

    subsequent_microcycles = sorted_microcycles[original_index + 1:]
    for microcycle in subsequent_microcycles:
        _shift_microcycle_schedule(microcycle, duration_days)
        microcycle.week_number += 1

    _normalize_mesocycle_microcycle_names(mesocycle)

    sorted_mesocycles = _sort_mesocycles(list(macrocycle.mesocycles or []))
    current_mesocycle_index = next(
        index for index, current_mesocycle in enumerate(sorted_mesocycles)
        if current_mesocycle.id == mesocycle.id
    )

    for downstream_mesocycle in sorted_mesocycles[current_mesocycle_index + 1:]:
        _shift_mesocycle_schedule(downstream_mesocycle, duration_days)

    mesocycle.end_date = _shift_date(mesocycle.end_date, duration_days)
    macrocycle.end_date = _shift_date(macrocycle.end_date, duration_days)

    return duplicated_microcycle


# =============== Macrocycle Endpoints ===============

@router.get("", response_model=MacrocycleListResponse)
def list_macrocycles(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[MesocycleStatus] = None,
    client_id: Optional[int] = None
):
    """
    Get lightweight list of macrocycles

    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    - **status**: Filter by status (draft/active/completed/archived)
    - **client_id**: Filter by client (trainers only)
    """
    request_started_at = getattr(request.state, "request_started_at", None)
    route_started_at = perf_counter()
    request.state.router_started_at = route_started_at

    auth_ms = elapsed_ms(request_started_at, route_started_at) if request_started_at is not None else 0.0
    init_ms = 0.0
    filters_ms = 0.0
    count_ms = 0.0
    fetch_ms = 0.0
    serialize_ms = 0.0

    try:
        init_started_at = perf_counter()
        query = db.query(Macrocycle)
        role = get_effective_user_role(current_user)
        init_ms = elapsed_ms(init_started_at)

        auth_started_at = perf_counter()
        if role in {"trainer", "admin"}:
            assert_training_professional_access(current_user)
        auth_ms += elapsed_ms(auth_started_at)

        filters_started_at = perf_counter()
        # Filter based on user role
        if role == "client":
            # Clients can only see their own macrocycles
            query = query.filter(Macrocycle.client_id == current_user.id)
        elif client_id:
            # Trainers/Admins can filter by client_id
            query = query.filter(Macrocycle.client_id == client_id)
        elif role == "admin":
            # Admins see all macrocycles (both templates and client programs)
            pass  # No filter applied
        else:
            # Trainers see only macrocycles they created
            query = query.filter(Macrocycle.trainer_id == current_user.id)

        # Apply status filter
        if status:
            query = query.filter(Macrocycle.status == status)
        filters_ms = elapsed_ms(filters_started_at)

        count_started_at = perf_counter()
        total = query.count()
        count_ms = elapsed_ms(count_started_at)

        fetch_started_at = perf_counter()
        mesocycle_counts = (
            db.query(
                Mesocycle.macrocycle_id.label("macrocycle_id"),
                func.count(Mesocycle.id).label("mesocycles_count"),
            )
            .group_by(Mesocycle.macrocycle_id)
            .subquery()
        )

        rows = (
            query.outerjoin(mesocycle_counts, mesocycle_counts.c.macrocycle_id == Macrocycle.id)
            .with_entities(
                Macrocycle.id,
                Macrocycle.name,
                Macrocycle.description,
                Macrocycle.objective,
                Macrocycle.start_date,
                Macrocycle.end_date,
                Macrocycle.client_id,
                Macrocycle.trainer_id,
                Macrocycle.status,
                Macrocycle.created_at,
                Macrocycle.updated_at,
                func.coalesce(mesocycle_counts.c.mesocycles_count, 0).label("mesocycles_count"),
            )
            .order_by(Macrocycle.created_at.desc(), Macrocycle.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        fetch_ms = elapsed_ms(fetch_started_at)

        serialize_started_at = perf_counter()
        macrocycles = [
            MacrocycleListItemResponse(
                id=str(row.id),
                name=row.name,
                description=row.description,
                objective=row.objective,
                start_date=row.start_date,
                end_date=row.end_date,
                client_id=str(row.client_id) if row.client_id is not None else None,
                trainer_id=str(row.trainer_id),
                status=row.status,
                mesocycles_count=int(row.mesocycles_count or 0),
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
            for row in rows
        ]
        serialize_ms = elapsed_ms(serialize_started_at)

        return {
            "total": total,
            "macrocycles": macrocycles
        }
    finally:
        route_completed_at = perf_counter()
        request.state.router_completed_at = route_completed_at
        total_started_at = request_started_at if request_started_at is not None else route_started_at
        logger.info(
            "[mesocycles] %s",
            format_timing_fields(
                {
                    "init": init_ms,
                    "auth": auth_ms,
                    "filters": filters_ms,
                    "count": count_ms,
                    "fetch": fetch_ms,
                    "serialize": serialize_ms,
                    "total": elapsed_ms(total_started_at, route_completed_at),
                }
            ),
        )


@router.get("/palette-search", response_model=list[MacrocyclePaletteResult])
def palette_search_macrocycles(
    q: str = Query(""),
    limit: int = Query(8, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    normalized_query = _normalize_palette_query(q)
    if len(normalized_query) < 2:
        return []

    role = get_effective_user_role(current_user)
    if role == "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clients are not allowed to access professional palette search",
        )

    assert_training_professional_access(current_user)

    client_alias = aliased(User)
    full_name_expr = func.trim(func.concat(client_alias.name, " ", func.coalesce(client_alias.lastname, "")))
    search_pattern = f"%{normalized_query}%"

    query = (
        db.query(Macrocycle)
        .outerjoin(client_alias, Macrocycle.client_id == client_alias.id)
        .options(joinedload(Macrocycle.client))
        .filter(
            or_(
                Macrocycle.name.ilike(search_pattern),
                Macrocycle.objective.ilike(search_pattern),
                full_name_expr.ilike(search_pattern),
            )
        )
    )

    if role == "trainer":
        query = query.filter(Macrocycle.trainer_id == current_user.id)

    macrocycles = (
        query.order_by(Macrocycle.created_at.desc(), Macrocycle.id.desc())
        .limit(_resolve_palette_limit(limit))
        .all()
    )

    return [_build_macrocycle_palette_result(macrocycle) for macrocycle in macrocycles]


@router.get("/{macrocycle_id}", response_model=MacrocycleResponse)
def get_macrocycle(
    macrocycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific macrocycle by ID with all nested data"""
    macrocycle = _get_macrocycle_with_nested_data(db, macrocycle_id)

    if not macrocycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Macrocycle with id {macrocycle_id} not found"
        )

    role = get_effective_user_role(current_user)
    if role in {"trainer", "admin"}:
        assert_training_professional_access(current_user)

    # Check permissions
    if role == "client" and macrocycle.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this macrocycle"
        )
    elif role == "trainer" and macrocycle.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this macrocycle"
        )

    return macrocycle


@router.post("", response_model=MacrocycleResponse, status_code=status.HTTP_201_CREATED)
def create_macrocycle(
    macrocycle_data: MacrocycleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new macrocycle (trainers and admins only)

    Can optionally include nested mesocycles, microcycles, training days and exercises
    """
    assert_training_professional_access(current_user)

    # Create macrocycle
    macrocycle_dict = macrocycle_data.model_dump(exclude={"mesocycles"})
    macrocycle_dict["trainer_id"] = current_user.id

    new_macrocycle = Macrocycle(**macrocycle_dict)
    db.add(new_macrocycle)
    db.flush()

    # Create nested mesocycles if provided
    if macrocycle_data.mesocycles:
        for meso_data in macrocycle_data.mesocycles:
            _create_mesocycle_nested(db, new_macrocycle.id, meso_data)

    db.commit()
    db.refresh(new_macrocycle)

    return new_macrocycle


@router.put("/{macrocycle_id}", response_model=MacrocycleResponse)
def update_macrocycle(
    macrocycle_id: int,
    macrocycle_data: MacrocycleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing macrocycle (trainers and admins only)
    """
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()

    if not macrocycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Macrocycle with id {macrocycle_id} not found"
        )

    _check_trainer_access(macrocycle, current_user)

    # Update only provided fields
    update_data = macrocycle_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(macrocycle, field, value)

    db.commit()
    db.refresh(macrocycle)

    return macrocycle


@router.post("/{macrocycle_id}/activate", response_model=MacrocycleActivationResponse)
def activate_macrocycle(
    macrocycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Activate a client macrocycle and reschedule all nested dates from today."""
    macrocycle = _get_macrocycle_with_nested_data(db, macrocycle_id)

    if not macrocycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Macrocycle with id {macrocycle_id} not found"
        )

    _check_trainer_access(macrocycle, current_user)

    if macrocycle.client_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Templates cannot be activated"
        )

    if macrocycle.status == MesocycleStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Macrocycle is already active"
        )

    effective_start_date = _today()
    delta_days = (effective_start_date - macrocycle.start_date).days
    shifted_training_day_count = _shift_macrocycle_schedule(macrocycle, delta_days)
    macrocycle.status = MesocycleStatus.ACTIVE

    archived_macrocycle_ids: list[str] = []
    completed_macrocycle_ids: list[str] = []

    other_active_macrocycles = _load_other_active_macrocycles(db, macrocycle.client_id, macrocycle.id)
    for other_macrocycle in other_active_macrocycles:
        if other_macrocycle.end_date and other_macrocycle.end_date < effective_start_date:
            other_macrocycle.status = MesocycleStatus.COMPLETED
            completed_macrocycle_ids.append(str(other_macrocycle.id))
        else:
            other_macrocycle.status = MesocycleStatus.ARCHIVED
            archived_macrocycle_ids.append(str(other_macrocycle.id))

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    refreshed_macrocycle = _get_macrocycle_with_nested_data(db, macrocycle_id)
    if not refreshed_macrocycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Macrocycle with id {macrocycle_id} not found"
        )

    return {
        "macrocycle": refreshed_macrocycle,
        "effective_start_date": effective_start_date,
        "shifted_training_day_count": shifted_training_day_count,
        "archived_macrocycle_ids": archived_macrocycle_ids,
        "completed_macrocycle_ids": completed_macrocycle_ids,
    }


@router.delete("/{macrocycle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_macrocycle(
    macrocycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a macrocycle (trainers and admins only)

    This will cascade delete all associated mesocycles, microcycles, training days, and exercises
    """
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()

    if not macrocycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Macrocycle with id {macrocycle_id} not found"
        )

    _check_trainer_access(macrocycle, current_user)

    db.delete(macrocycle)
    db.commit()

    return None


# =============== Mesocycle Endpoints ===============

@router.get("/{macrocycle_id}/mesocycles", response_model=MesocycleListResponse)
def list_mesocycles(
    macrocycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all mesocycles for a macrocycle"""
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()

    if not macrocycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Macrocycle with id {macrocycle_id} not found"
        )

    # Check permissions
    _check_macrocycle_access(macrocycle, current_user)

    mesocycles = db.query(Mesocycle).filter(
        Mesocycle.macrocycle_id == macrocycle_id
    ).order_by(Mesocycle.block_number).all()

    return {
        "total": len(mesocycles),
        "mesocycles": mesocycles
    }


@router.post("/{macrocycle_id}/mesocycles", response_model=MesocycleResponse, status_code=status.HTTP_201_CREATED)
def create_mesocycle(
    macrocycle_id: int,
    mesocycle_data: MesocycleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new mesocycle within a macrocycle"""
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()

    if not macrocycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Macrocycle with id {macrocycle_id} not found"
        )

    # Check permissions
    _check_trainer_access(macrocycle, current_user)

    mesocycle = _create_mesocycle_nested(db, macrocycle_id, mesocycle_data)

    db.commit()
    db.refresh(mesocycle)

    return mesocycle


@router.get("/{macrocycle_id}/mesocycles/{mesocycle_id}", response_model=MesocycleResponse)
def get_mesocycle(
    macrocycle_id: int,
    mesocycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific mesocycle"""
    mesocycle = _get_mesocycle_or_404(db, macrocycle_id, mesocycle_id)
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()
    _check_macrocycle_access(macrocycle, current_user)

    return mesocycle


@router.put("/{macrocycle_id}/mesocycles/{mesocycle_id}", response_model=MesocycleResponse)
def update_mesocycle(
    macrocycle_id: int,
    mesocycle_id: int,
    mesocycle_data: MesocycleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a mesocycle"""
    mesocycle = _get_mesocycle_or_404(db, macrocycle_id, mesocycle_id)
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()
    _check_trainer_access(macrocycle, current_user)

    update_data = mesocycle_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(mesocycle, field, value)

    db.commit()
    db.refresh(mesocycle)

    return mesocycle


@router.delete("/{macrocycle_id}/mesocycles/{mesocycle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mesocycle(
    macrocycle_id: int,
    mesocycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a mesocycle and all its nested data"""
    mesocycle = _get_mesocycle_or_404(db, macrocycle_id, mesocycle_id)
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()
    _check_trainer_access(macrocycle, current_user)

    db.delete(mesocycle)
    db.commit()

    return None


# =============== Microcycle Endpoints ===============

@router.post("/{macrocycle_id}/mesocycles/{mesocycle_id}/microcycles", response_model=MicrocycleResponse, status_code=status.HTTP_201_CREATED)
def create_microcycle(
    macrocycle_id: int,
    mesocycle_id: int,
    microcycle_data: MicrocycleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new microcycle within a mesocycle"""
    mesocycle = _get_mesocycle_or_404(db, macrocycle_id, mesocycle_id)
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()
    _check_trainer_access(macrocycle, current_user)

    microcycle = _create_microcycle_nested(db, mesocycle.id, microcycle_data)
    _normalize_mesocycle_microcycle_names(mesocycle)

    db.commit()
    db.refresh(microcycle)

    return microcycle


@router.put("/{macrocycle_id}/mesocycles/{mesocycle_id}/microcycles/{microcycle_id}", response_model=MicrocycleResponse)
def update_microcycle(
    macrocycle_id: int,
    mesocycle_id: int,
    microcycle_id: int,
    microcycle_data: MicrocycleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a microcycle"""
    microcycle = _get_microcycle_or_404(db, mesocycle_id, microcycle_id)
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()
    _check_trainer_access(macrocycle, current_user)

    update_data = microcycle_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(microcycle, field, value)

    db.commit()
    db.refresh(microcycle)

    return microcycle


@router.delete("/{macrocycle_id}/mesocycles/{mesocycle_id}/microcycles/{microcycle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_microcycle(
    macrocycle_id: int,
    mesocycle_id: int,
    microcycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a microcycle and all its nested data"""
    microcycle = _get_microcycle_or_404(db, mesocycle_id, microcycle_id)
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()
    _check_trainer_access(macrocycle, current_user)

    db.delete(microcycle)
    db.commit()

    return None


@router.post(
    "/{macrocycle_id}/mesocycles/{mesocycle_id}/microcycles/{microcycle_id}/duplicate",
    response_model=MicrocycleResponse,
    status_code=status.HTTP_201_CREATED,
)
def duplicate_microcycle(
    macrocycle_id: int,
    mesocycle_id: int,
    microcycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Duplicate a microcycle, insert it after the original, and shift downstream schedule."""
    macrocycle = _get_macrocycle_with_nested_data(db, macrocycle_id)
    if not macrocycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Macrocycle with id {macrocycle_id} not found",
        )

    _check_trainer_access(macrocycle, current_user)

    mesocycle = next(
        (current_mesocycle for current_mesocycle in macrocycle.mesocycles or [] if current_mesocycle.id == mesocycle_id),
        None,
    )
    if mesocycle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mesocycle with id {mesocycle_id} not found",
        )

    original_microcycle = next(
        (current_microcycle for current_microcycle in mesocycle.microcycles or [] if current_microcycle.id == microcycle_id),
        None,
    )
    if original_microcycle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Microcycle with id {microcycle_id} not found",
        )

    duplicated_microcycle = _insert_duplicate_microcycle(
        db=db,
        macrocycle=macrocycle,
        mesocycle=mesocycle,
        original_microcycle=original_microcycle,
    )

    db.commit()

    duplicated_microcycle = _get_microcycle_with_nested_data(
        db=db,
        mesocycle_id=mesocycle_id,
        microcycle_id=duplicated_microcycle.id,
    )
    if duplicated_microcycle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Microcycle with id {microcycle_id} not found",
        )

    return duplicated_microcycle


# =============== Training Day Endpoints ===============

@router.post("/{macrocycle_id}/mesocycles/{mesocycle_id}/microcycles/{microcycle_id}/days", response_model=TrainingDayResponse, status_code=status.HTTP_201_CREATED)
def create_training_day(
    macrocycle_id: int,
    mesocycle_id: int,
    microcycle_id: int,
    day_data: TrainingDayCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new training day within a microcycle"""
    microcycle = _get_microcycle_or_404(db, mesocycle_id, microcycle_id)
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()
    _check_trainer_access(macrocycle, current_user)

    training_day = _create_training_day_nested(db, microcycle.id, day_data)

    db.commit()
    db.refresh(training_day)

    return training_day


@router.put("/{macrocycle_id}/mesocycles/{mesocycle_id}/microcycles/{microcycle_id}/days/{day_id}", response_model=TrainingDayResponse)
def update_training_day(
    macrocycle_id: int,
    mesocycle_id: int,
    microcycle_id: int,
    day_id: int,
    day_data: TrainingDayUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a training day"""
    training_day = _get_training_day_or_404(db, microcycle_id, day_id)
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()
    _check_trainer_access(macrocycle, current_user)

    update_data = day_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(training_day, field, value)

    db.commit()
    db.refresh(training_day)

    return training_day


@router.delete("/{macrocycle_id}/mesocycles/{mesocycle_id}/microcycles/{microcycle_id}/days/{day_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_training_day(
    macrocycle_id: int,
    mesocycle_id: int,
    microcycle_id: int,
    day_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a training day and all its exercises"""
    training_day = _get_training_day_or_404(db, microcycle_id, day_id)
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()
    _check_trainer_access(macrocycle, current_user)

    db.delete(training_day)
    db.commit()

    return None


# =============== Day Exercise Endpoints ===============

@router.post("/{macrocycle_id}/mesocycles/{mesocycle_id}/microcycles/{microcycle_id}/days/{day_id}/exercises", response_model=DayExerciseResponse, status_code=status.HTTP_201_CREATED)
def create_day_exercise(
    macrocycle_id: int,
    mesocycle_id: int,
    microcycle_id: int,
    day_id: int,
    exercise_data: DayExerciseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add an exercise to a training day"""
    training_day = _get_training_day_or_404(db, microcycle_id, day_id)
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()
    _check_trainer_access(macrocycle, current_user)

    exercise_dict = exercise_data.model_dump()
    exercise_dict["training_day_id"] = training_day.id

    day_exercise = DayExercise(**exercise_dict)
    db.add(day_exercise)
    db.commit()
    db.refresh(day_exercise)

    return day_exercise


@router.put("/{macrocycle_id}/mesocycles/{mesocycle_id}/microcycles/{microcycle_id}/days/{day_id}/exercises/{exercise_id}", response_model=DayExerciseResponse)
def update_day_exercise(
    macrocycle_id: int,
    mesocycle_id: int,
    microcycle_id: int,
    day_id: int,
    exercise_id: int,
    exercise_data: DayExerciseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an exercise in a training day"""
    day_exercise = _get_day_exercise_or_404(db, day_id, exercise_id)
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()
    _check_trainer_access(macrocycle, current_user)

    update_data = exercise_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(day_exercise, field, value)

    db.commit()
    db.refresh(day_exercise)

    return day_exercise


@router.delete("/{macrocycle_id}/mesocycles/{mesocycle_id}/microcycles/{microcycle_id}/days/{day_id}/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_day_exercise(
    macrocycle_id: int,
    mesocycle_id: int,
    microcycle_id: int,
    day_id: int,
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove an exercise from a training day"""
    day_exercise = _get_day_exercise_or_404(db, day_id, exercise_id)
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == macrocycle_id).first()
    _check_trainer_access(macrocycle, current_user)

    db.delete(day_exercise)
    db.commit()

    return None


# =============== Helper Functions ===============

def _check_macrocycle_access(macrocycle: Macrocycle, current_user: User):
    """Check if user has access to view a macrocycle"""
    assert_macrocycle_access(
        macrocycle=macrocycle,
        current_user=current_user,
        forbidden_detail="Not authorized to access this macrocycle",
    )


def _check_trainer_access(macrocycle: Macrocycle, current_user: User):
    """Check if user has trainer access to modify a macrocycle"""
    context = assert_training_professional_access(current_user)
    if context.effective_role == "trainer" and macrocycle.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this macrocycle"
        )


def _get_mesocycle_or_404(db: Session, macrocycle_id: int, mesocycle_id: int) -> Mesocycle:
    """Get a mesocycle or raise 404"""
    mesocycle = db.query(Mesocycle).filter(
        Mesocycle.id == mesocycle_id,
        Mesocycle.macrocycle_id == macrocycle_id
    ).first()

    if not mesocycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mesocycle with id {mesocycle_id} not found"
        )

    return mesocycle


def _get_microcycle_or_404(db: Session, mesocycle_id: int, microcycle_id: int) -> Microcycle:
    """Get a microcycle or raise 404"""
    microcycle = db.query(Microcycle).filter(
        Microcycle.id == microcycle_id,
        Microcycle.mesocycle_id == mesocycle_id
    ).first()

    if not microcycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Microcycle with id {microcycle_id} not found"
        )

    return microcycle


def _get_training_day_or_404(db: Session, microcycle_id: int, day_id: int) -> TrainingDay:
    """Get a training day or raise 404"""
    training_day = db.query(TrainingDay).filter(
        TrainingDay.id == day_id,
        TrainingDay.microcycle_id == microcycle_id
    ).first()

    if not training_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training day with id {day_id} not found"
        )

    return training_day


def _get_day_exercise_or_404(db: Session, day_id: int, exercise_id: int) -> DayExercise:
    """Get a day exercise or raise 404"""
    day_exercise = db.query(DayExercise).filter(
        DayExercise.id == exercise_id,
        DayExercise.training_day_id == day_id
    ).first()

    if not day_exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Day exercise with id {exercise_id} not found"
        )

    return day_exercise


def _create_mesocycle_nested(db: Session, macrocycle_id: int, meso_data: MesocycleCreate) -> Mesocycle:
    """Create a mesocycle with nested microcycles"""
    meso_dict = meso_data.model_dump(exclude={"microcycles"})
    meso_dict["macrocycle_id"] = macrocycle_id

    mesocycle = Mesocycle(**meso_dict)
    db.add(mesocycle)
    db.flush()

    if meso_data.microcycles:
        for micro_data in meso_data.microcycles:
            _create_microcycle_nested(db, mesocycle.id, micro_data)

    return mesocycle


def _create_microcycle_nested(db: Session, mesocycle_id: int, micro_data: MicrocycleCreate) -> Microcycle:
    """Create a microcycle with nested training days"""
    micro_dict = micro_data.model_dump(exclude={"training_days"})
    micro_dict["mesocycle_id"] = mesocycle_id

    microcycle = Microcycle(**micro_dict)
    db.add(microcycle)
    db.flush()

    if micro_data.training_days:
        for day_data in micro_data.training_days:
            _create_training_day_nested(db, microcycle.id, day_data)

    return microcycle


def _create_training_day_nested(db: Session, microcycle_id: int, day_data: TrainingDayCreate) -> TrainingDay:
    """Create a training day with nested exercises"""
    day_dict = day_data.model_dump(exclude={"exercises"})
    day_dict["microcycle_id"] = microcycle_id

    training_day = TrainingDay(**day_dict)
    db.add(training_day)
    db.flush()

    if day_data.exercises:
        for exercise_data in day_data.exercises:
            exercise_dict = exercise_data.model_dump()
            exercise_dict["training_day_id"] = training_day.id

            day_exercise = DayExercise(**exercise_dict)
            db.add(day_exercise)

    return training_day
