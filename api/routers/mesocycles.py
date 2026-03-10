from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from models.base import get_db
from models.user import User
from models.mesocycle import Macrocycle, Mesocycle, Microcycle, TrainingDay, DayExercise, MesocycleStatus
from models.exercise import Exercise
from models.exercise_muscle import ExerciseMuscle
from schemas.mesocycle import (
    MacrocycleCreate, MacrocycleUpdate, MacrocycleResponse, MacrocycleListResponse,
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

router = APIRouter()


# =============== Macrocycle Endpoints ===============

@router.get("", response_model=MacrocycleListResponse)
def list_macrocycles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[MesocycleStatus] = None,
    client_id: Optional[int] = None
):
    """
    Get list of macrocycles

    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    - **status**: Filter by status (draft/active/completed/archived)
    - **client_id**: Filter by client (trainers only)
    """
    query = db.query(Macrocycle)

    role = get_effective_user_role(current_user)
    if role in {"trainer", "admin"}:
        assert_training_professional_access(current_user)

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

    # Get total count
    total = query.count()

    # Apply pagination and order
    macrocycles = query.order_by(Macrocycle.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "total": total,
        "macrocycles": macrocycles
    }


@router.get("/{macrocycle_id}", response_model=MacrocycleResponse)
def get_macrocycle(
    macrocycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific macrocycle by ID with all nested data"""
    macrocycle = db.query(Macrocycle).options(
        joinedload(Macrocycle.mesocycles)
            .joinedload(Mesocycle.microcycles)
            .joinedload(Microcycle.training_days)
            .joinedload(TrainingDay.exercises)
            .joinedload(DayExercise.exercise)
            .joinedload(Exercise.exercise_muscles)
            .joinedload(ExerciseMuscle.muscle)
    ).filter(Macrocycle.id == macrocycle_id).first()

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
