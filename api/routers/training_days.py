from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.orm import Session, joinedload
from typing import List
from pydantic import BaseModel
from models.base import get_db
from models.user import User
from models.mesocycle import Macrocycle, Mesocycle, Microcycle, TrainingDay, DayExercise
from models.exercise import Exercise
from models.exercise_muscle import ExerciseMuscle
from schemas.mesocycle import (
    TrainingDayCreate, TrainingDayUpdate, TrainingDayResponse
)
from core.dependencies import get_current_user
from services.metrics_calculator import MuscleVolumeResponse, calculate_muscle_volume


class ReorderRequest(BaseModel):
    exercise_ids: List[int]

router = APIRouter()


def verify_microcycle_access(db: Session, microcycle_id: int, current_user: User):
    """Verify user has access to the microcycle through its parent macrocycle"""
    microcycle = db.query(Microcycle).filter(Microcycle.id == microcycle_id).first()

    if not microcycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Microcycle with id {microcycle_id} not found"
        )

    # Get parent mesocycle
    mesocycle = db.query(Mesocycle).filter(Mesocycle.id == microcycle.mesocycle_id).first()

    # Get parent macrocycle
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == mesocycle.macrocycle_id).first()

    # Check permissions
    if current_user.role.value == "client" and macrocycle.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this training day"
        )
    elif current_user.role.value == "trainer" and macrocycle.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this training day"
        )

    return microcycle


@router.get("/microcycle/{microcycle_id}", response_model=list[TrainingDayResponse])
def list_training_days_by_microcycle(
    microcycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all training days for a specific microcycle"""
    # Verify access to the microcycle
    verify_microcycle_access(db, microcycle_id, current_user)

    # Get all training days ordered by day_number
    training_days = db.query(TrainingDay).filter(
        TrainingDay.microcycle_id == microcycle_id
    ).order_by(TrainingDay.day_number).all()

    return training_days


@router.get("/{training_day_id}/muscle-volume", response_model=MuscleVolumeResponse)
def get_muscle_volume(
    training_day_id: int,
    count_secondary: bool = Query(True, description="Count secondary muscles with 0.5x multiplier"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get muscle volume breakdown for a specific training day.

    Returns effective sets and total sets per muscle group, calculated as:
    - Primary muscles: 1x sets contribution
    - Secondary muscles: 0.5x sets contribution (configurable via count_secondary param)
    - Effective sets: Only series with RIR ≤ 3, RPE ≥ 7, or %1RM ≥ 65%
    - Warmup exercises are excluded from the calculation

    This endpoint is useful for both web and mobile clients to display
    volume distribution charts.
    """
    # First, check if training day exists (simple query)
    training_day = db.query(TrainingDay).filter(TrainingDay.id == training_day_id).first()

    if not training_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training day with id {training_day_id} not found"
        )

    # Verify access through parent microcycle
    verify_microcycle_access(db, training_day.microcycle_id, current_user)

    # Handle rest days
    if training_day.rest_day:
        return MuscleVolumeResponse(
            training_day_id=training_day.id,
            training_day_name=training_day.name or f"Día {training_day.day_number}",
            total_effective_sets=0,
            muscles=[]
        )

    # Now load with eager loading for muscle calculation
    training_day = db.query(TrainingDay).options(
        joinedload(TrainingDay.exercises)
        .joinedload(DayExercise.exercise)
        .joinedload(Exercise.exercise_muscles)
        .joinedload(ExerciseMuscle.muscle)
    ).filter(TrainingDay.id == training_day_id).first()

    return calculate_muscle_volume(training_day, count_secondary)


@router.get("/{training_day_id}", response_model=TrainingDayResponse)
def get_training_day(
    training_day_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific training day by ID with all exercises"""
    training_day = db.query(TrainingDay).filter(TrainingDay.id == training_day_id).first()

    if not training_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training day with id {training_day_id} not found"
        )

    # Verify access through parent microcycle
    verify_microcycle_access(db, training_day.microcycle_id, current_user)

    return training_day


@router.post("/microcycle/{microcycle_id}", response_model=TrainingDayResponse, status_code=status.HTTP_201_CREATED)
def create_training_day(
    microcycle_id: int,
    training_day_data: TrainingDayCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new training day in a specific microcycle

    Only trainers and admins can create training days
    """
    # Only trainers and admins can create training days
    if current_user.role.value not in ["trainer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can create training days"
        )

    # Verify microcycle exists and user has access
    microcycle = verify_microcycle_access(db, microcycle_id, current_user)

    # Create training day
    day_dict = training_day_data.model_dump(exclude={"exercises"})
    day_dict["microcycle_id"] = microcycle_id

    new_training_day = TrainingDay(**day_dict)
    db.add(new_training_day)
    db.flush()

    # Create day exercises if provided
    if training_day_data.exercises:
        for exercise_data in training_day_data.exercises:
            exercise_dict = exercise_data.model_dump()
            exercise_dict["training_day_id"] = new_training_day.id

            day_exercise = DayExercise(**exercise_dict)
            db.add(day_exercise)

    db.commit()
    db.refresh(new_training_day)

    return new_training_day


@router.put("/{training_day_id}", response_model=TrainingDayResponse)
def update_training_day(
    training_day_id: int,
    training_day_data: TrainingDayUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing training day

    Only trainers and admins can update training days
    """
    if current_user.role.value not in ["trainer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can update training days"
        )

    training_day = db.query(TrainingDay).filter(TrainingDay.id == training_day_id).first()

    if not training_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training day with id {training_day_id} not found"
        )

    # Verify access through parent microcycle
    verify_microcycle_access(db, training_day.microcycle_id, current_user)

    # Update only provided fields
    update_data = training_day_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(training_day, field, value)

    db.commit()
    db.refresh(training_day)

    return training_day


@router.delete("/{training_day_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_training_day(
    training_day_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a training day

    This will cascade delete all associated exercises
    Only trainers and admins can delete training days
    """
    if current_user.role.value not in ["trainer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can delete training days"
        )

    training_day = db.query(TrainingDay).filter(TrainingDay.id == training_day_id).first()

    if not training_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training day with id {training_day_id} not found"
        )

    # Verify access through parent microcycle
    verify_microcycle_access(db, training_day.microcycle_id, current_user)

    db.delete(training_day)
    db.commit()

    return None


@router.post("/{training_day_id}/duplicate", response_model=TrainingDayResponse, status_code=status.HTTP_201_CREATED)
def duplicate_training_day(
    training_day_id: int,
    new_day_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Duplicate an existing training day with all its exercises

    Only trainers and admins can duplicate training days
    """
    if current_user.role.value not in ["trainer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can duplicate training days"
        )

    # Get original training day
    original_day = db.query(TrainingDay).filter(TrainingDay.id == training_day_id).first()

    if not original_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training day with id {training_day_id} not found"
        )

    # Verify access
    verify_microcycle_access(db, original_day.microcycle_id, current_user)

    # Create duplicate
    new_day = TrainingDay(
        microcycle_id=original_day.microcycle_id,
        day_number=new_day_number,
        date=original_day.date,
        name=f"{original_day.name} (Copy)",
        focus=original_day.focus,
        rest_day=original_day.rest_day,
        notes=original_day.notes
    )
    db.add(new_day)
    db.flush()

    # Duplicate exercises
    for original_exercise in original_day.exercises:
        new_exercise = DayExercise(
            training_day_id=new_day.id,
            exercise_id=original_exercise.exercise_id,
            order_index=original_exercise.order_index,
            sets=original_exercise.sets,
            reps_min=original_exercise.reps_min,
            reps_max=original_exercise.reps_max,
            rest_seconds=original_exercise.rest_seconds,
            effort_type=original_exercise.effort_type,
            effort_value=original_exercise.effort_value,
            tempo=original_exercise.tempo,
            notes=original_exercise.notes
        )
        db.add(new_exercise)

    db.commit()
    db.refresh(new_day)

    return new_day


@router.patch("/{training_day_id}/reorder", status_code=status.HTTP_200_OK)
def reorder_exercises(
    training_day_id: int,
    request: ReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reorder exercises within a training day.

    Pass a list of exercise IDs in the desired order.
    Only trainers and admins can reorder exercises.
    """
    if current_user.role.value not in ["trainer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can reorder exercises"
        )

    training_day = db.query(TrainingDay).filter(TrainingDay.id == training_day_id).first()

    if not training_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training day with id {training_day_id} not found"
        )

    # Verify access through parent microcycle
    verify_microcycle_access(db, training_day.microcycle_id, current_user)

    # Update order_index for each exercise
    for index, exercise_id in enumerate(request.exercise_ids):
        exercise = db.query(DayExercise).filter(
            DayExercise.id == exercise_id,
            DayExercise.training_day_id == training_day_id
        ).first()

        if exercise:
            exercise.order_index = index

    db.commit()

    return {"message": "Exercises reordered successfully", "order": request.exercise_ids}
