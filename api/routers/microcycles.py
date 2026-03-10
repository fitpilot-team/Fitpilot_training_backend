from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from models.base import get_db
from models.user import User
from models.mesocycle import Microcycle, TrainingDay, DayExercise, IntensityLevel
from schemas.mesocycle import (
    MicrocycleCreate, MicrocycleUpdate, MicrocycleResponse
)
from core.dependencies import (
    assert_macrocycle_access,
    assert_training_professional_access,
    get_macrocycle_or_404,
    get_current_user,
)

router = APIRouter()


def verify_macrocycle_access(db: Session, macrocycle_id: int, current_user: User):
    """Verify user has access to the macrocycle"""
    macrocycle = get_macrocycle_or_404(db, macrocycle_id)
    assert_macrocycle_access(
        macrocycle=macrocycle,
        current_user=current_user,
        forbidden_detail="Not authorized to access this macrocycle",
    )
    return macrocycle


def get_microcycle_with_access(db: Session, microcycle_id: int, current_user: User) -> Microcycle:
    """Get a microcycle and verify the current user can access its parent macrocycle."""
    microcycle = get_microcycle_or_404(db, microcycle_id)
    verify_macrocycle_access(db, microcycle.macrocycle_id, current_user)
    return microcycle


@router.get("/macrocycle/{macrocycle_id}", response_model=list[MicrocycleResponse])
def list_microcycles_by_macrocycle(
    macrocycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all microcycles for a specific macrocycle"""
    # Verify access to the macrocycle
    verify_macrocycle_access(db, macrocycle_id, current_user)

    # Get all microcycles ordered by week_number
    microcycles = db.query(Microcycle).filter(
        Microcycle.macrocycle_id == macrocycle_id
    ).order_by(Microcycle.week_number).all()

    return microcycles


@router.get("/{microcycle_id}", response_model=MicrocycleResponse)
def get_microcycle(
    microcycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific microcycle by ID with all nested data"""
    return get_microcycle_with_access(db, microcycle_id, current_user)


@router.post("/macrocycle/{macrocycle_id}", response_model=MicrocycleResponse, status_code=status.HTTP_201_CREATED)
def create_microcycle(
    macrocycle_id: int,
    microcycle_data: MicrocycleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new microcycle in a specific macrocycle

    Only trainers and admins can create microcycles
    """
    assert_training_professional_access(current_user)

    # Verify macrocycle exists and user has access
    macrocycle = verify_macrocycle_access(db, macrocycle_id, current_user)

    # Create microcycle
    microcycle_dict = microcycle_data.model_dump(exclude={"training_days"})
    microcycle_dict["macrocycle_id"] = macrocycle_id

    new_microcycle = Microcycle(**microcycle_dict)
    db.add(new_microcycle)
    db.flush()

    # Create nested training days if provided
    if microcycle_data.training_days:
        for day_data in microcycle_data.training_days:
            day_dict = day_data.model_dump(exclude={"exercises"})
            day_dict["microcycle_id"] = new_microcycle.id

            training_day = TrainingDay(**day_dict)
            db.add(training_day)
            db.flush()

            # Create day exercises if provided
            if day_data.exercises:
                for exercise_data in day_data.exercises:
                    exercise_dict = exercise_data.model_dump()
                    exercise_dict["training_day_id"] = training_day.id

                    day_exercise = DayExercise(**exercise_dict)
                    db.add(day_exercise)

    db.commit()
    db.refresh(new_microcycle)

    return new_microcycle


@router.put("/{microcycle_id}", response_model=MicrocycleResponse)
def update_microcycle(
    microcycle_id: int,
    microcycle_data: MicrocycleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing microcycle

    Only trainers and admins can update microcycles
    """
    assert_training_professional_access(current_user)

    microcycle = get_microcycle_with_access(db, microcycle_id, current_user)

    # Update only provided fields
    update_data = microcycle_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(microcycle, field, value)

    db.commit()
    db.refresh(microcycle)

    return microcycle


@router.delete("/{microcycle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_microcycle(
    microcycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a microcycle

    This will cascade delete all associated training days and exercises
    Only trainers and admins can delete microcycles
    """
    assert_training_professional_access(current_user)

    microcycle = get_microcycle_with_access(db, microcycle_id, current_user)

    db.delete(microcycle)
    db.commit()

    return None
