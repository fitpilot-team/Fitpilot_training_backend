from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from pydantic import BaseModel
from models.base import get_db
from models.user import User
from models.mesocycle import Macrocycle, Mesocycle, Microcycle, TrainingDay, DayExercise
from models.exercise import Exercise
from schemas.mesocycle import (
    DayExerciseCreate, DayExerciseUpdate, DayExerciseResponse
)
from core.dependencies import get_current_user


class MoveExerciseRequest(BaseModel):
    from_day_id: int
    to_day_id: int
    new_index: int

router = APIRouter()


def verify_training_day_access(db: Session, training_day_id: int, current_user: User):
    """Verify user has access to the training day through its parent macrocycle"""
    training_day = db.query(TrainingDay).filter(TrainingDay.id == training_day_id).first()

    if not training_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training day with id {training_day_id} not found"
        )

    # Get parent microcycle
    microcycle = db.query(Microcycle).filter(Microcycle.id == training_day.microcycle_id).first()

    # Get parent mesocycle
    mesocycle = db.query(Mesocycle).filter(Mesocycle.id == microcycle.mesocycle_id).first()

    # Get parent macrocycle
    macrocycle = db.query(Macrocycle).filter(Macrocycle.id == mesocycle.macrocycle_id).first()

    # Check permissions
    if current_user.role.value == "client" and macrocycle.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this exercise"
        )
    elif current_user.role.value == "trainer" and macrocycle.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this exercise"
        )

    return training_day


@router.get("/training-day/{training_day_id}", response_model=list[DayExerciseResponse])
def list_day_exercises_by_training_day(
    training_day_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all exercises for a specific training day"""
    # Verify access to the training day
    verify_training_day_access(db, training_day_id, current_user)

    # Get all exercises ordered by order_index, with exercise details loaded
    day_exercises = db.query(DayExercise).options(
        joinedload(DayExercise.exercise)
    ).filter(
        DayExercise.training_day_id == training_day_id
    ).order_by(DayExercise.order_index).all()

    return day_exercises


@router.get("/{day_exercise_id}", response_model=DayExerciseResponse)
def get_day_exercise(
    day_exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific day exercise by ID"""
    day_exercise = db.query(DayExercise).filter(DayExercise.id == day_exercise_id).first()

    if not day_exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Day exercise with id {day_exercise_id} not found"
        )

    # Verify access through parent training day
    verify_training_day_access(db, day_exercise.training_day_id, current_user)

    return day_exercise


@router.post("/training-day/{training_day_id}", response_model=DayExerciseResponse, status_code=status.HTTP_201_CREATED)
def create_day_exercise(
    training_day_id: int,
    day_exercise_data: DayExerciseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a new exercise to a training day

    Only trainers and admins can add exercises
    """
    # Only trainers and admins can create exercises
    if current_user.role.value not in ["trainer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can add exercises"
        )

    # Verify training day exists and user has access
    training_day = verify_training_day_access(db, training_day_id, current_user)

    # Verify exercise exists
    exercise = db.query(Exercise).filter(Exercise.id == day_exercise_data.exercise_id).first()
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exercise with id {day_exercise_data.exercise_id} not found"
        )

    # Create day exercise
    exercise_dict = day_exercise_data.model_dump()
    exercise_dict["training_day_id"] = training_day_id

    new_day_exercise = DayExercise(**exercise_dict)
    db.add(new_day_exercise)
    db.commit()
    db.refresh(new_day_exercise)

    # Reload with exercise relationship
    new_day_exercise = db.query(DayExercise).options(
        joinedload(DayExercise.exercise)
    ).filter(DayExercise.id == new_day_exercise.id).first()

    return new_day_exercise


@router.put("/{day_exercise_id}", response_model=DayExerciseResponse)
def update_day_exercise(
    day_exercise_id: int,
    day_exercise_data: DayExerciseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing day exercise

    Only trainers and admins can update exercises
    """
    if current_user.role.value not in ["trainer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can update exercises"
        )

    day_exercise = db.query(DayExercise).filter(DayExercise.id == day_exercise_id).first()

    if not day_exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Day exercise with id {day_exercise_id} not found"
        )

    # Verify access through parent training day
    verify_training_day_access(db, day_exercise.training_day_id, current_user)

    # If exercise_id is being changed, verify new exercise exists
    if day_exercise_data.exercise_id:
        exercise = db.query(Exercise).filter(Exercise.id == day_exercise_data.exercise_id).first()
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exercise with id {day_exercise_data.exercise_id} not found"
            )

    # Update only provided fields
    update_data = day_exercise_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(day_exercise, field, value)

    db.commit()
    db.refresh(day_exercise)

    return day_exercise


@router.delete("/{day_exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_day_exercise(
    day_exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove an exercise from a training day

    Only trainers and admins can delete exercises
    """
    if current_user.role.value not in ["trainer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can delete exercises"
        )

    day_exercise = db.query(DayExercise).filter(DayExercise.id == day_exercise_id).first()

    if not day_exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Day exercise with id {day_exercise_id} not found"
        )

    # Verify access through parent training day
    verify_training_day_access(db, day_exercise.training_day_id, current_user)

    db.delete(day_exercise)
    db.commit()

    return None


@router.post("/training-day/{training_day_id}/reorder", response_model=List[DayExerciseResponse])
def reorder_exercises(
    training_day_id: int,
    exercise_order: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reorder exercises in a training day

    Provide a list of exercise IDs in the desired order.
    The order_index will be updated to match the list position.

    Only trainers and admins can reorder exercises
    """
    if current_user.role.value not in ["trainer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can reorder exercises"
        )

    # Verify training day exists and user has access
    training_day = verify_training_day_access(db, training_day_id, current_user)

    # Get all exercises for this training day
    all_exercises = db.query(DayExercise).filter(
        DayExercise.training_day_id == training_day_id
    ).all()

    # Verify all provided IDs exist in the training day
    exercise_dict = {ex.id: ex for ex in all_exercises}

    if len(exercise_order) != len(all_exercises):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Must provide all exercise IDs. Expected {len(all_exercises)}, got {len(exercise_order)}"
        )

    for ex_id in exercise_order:
        if ex_id not in exercise_dict:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exercise with id {ex_id} not found in this training day"
            )

    # Update order_index for each exercise
    for index, ex_id in enumerate(exercise_order):
        exercise = exercise_dict[ex_id]
        exercise.order_index = index

    db.commit()

    # Return exercises in new order
    updated_exercises = db.query(DayExercise).filter(
        DayExercise.training_day_id == training_day_id
    ).order_by(DayExercise.order_index).all()

    return updated_exercises


@router.post("/{day_exercise_id}/duplicate", response_model=DayExerciseResponse, status_code=status.HTTP_201_CREATED)
def duplicate_day_exercise(
    day_exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Duplicate an existing day exercise

    The duplicate will be placed right after the original exercise

    Only trainers and admins can duplicate exercises
    """
    if current_user.role.value not in ["trainer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can duplicate exercises"
        )

    # Get original exercise
    original_exercise = db.query(DayExercise).filter(DayExercise.id == day_exercise_id).first()

    if not original_exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Day exercise with id {day_exercise_id} not found"
        )

    # Verify access
    verify_training_day_access(db, original_exercise.training_day_id, current_user)

    # Create duplicate with next order_index
    new_exercise = DayExercise(
        training_day_id=original_exercise.training_day_id,
        exercise_id=original_exercise.exercise_id,
        order_index=original_exercise.order_index + 1,
        sets=original_exercise.sets,
        reps_min=original_exercise.reps_min,
        reps_max=original_exercise.reps_max,
        rest_seconds=original_exercise.rest_seconds,
        effort_type=original_exercise.effort_type,
        effort_value=original_exercise.effort_value,
        tempo=original_exercise.tempo,
        notes=f"{original_exercise.notes} (Copy)" if original_exercise.notes else "Copy"
    )

    # Shift all subsequent exercises
    subsequent_exercises = db.query(DayExercise).filter(
        DayExercise.training_day_id == original_exercise.training_day_id,
        DayExercise.order_index > original_exercise.order_index
    ).all()

    for ex in subsequent_exercises:
        ex.order_index += 1

    db.add(new_exercise)
    db.commit()
    db.refresh(new_exercise)

    return new_exercise


@router.patch("/{day_exercise_id}/move", response_model=DayExerciseResponse)
def move_exercise_between_days(
    day_exercise_id: int,
    request: MoveExerciseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Move an exercise from one training day to another.

    This will:
    1. Remove the exercise from the source day
    2. Add it to the target day at the specified index
    3. Reindex exercises in both days

    Only trainers and admins can move exercises.
    """
    if current_user.role.value not in ["trainer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can move exercises"
        )

    # Get the exercise to move
    exercise = db.query(DayExercise).filter(DayExercise.id == day_exercise_id).first()

    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Day exercise with id {day_exercise_id} not found"
        )

    # Verify access to source day
    verify_training_day_access(db, request.from_day_id, current_user)

    # Verify access to target day
    verify_training_day_access(db, request.to_day_id, current_user)

    # Verify the exercise is actually in the source day
    if exercise.training_day_id != request.from_day_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exercise is not in the specified source day"
        )

    # Reindex source day (remove gap)
    source_exercises = db.query(DayExercise).filter(
        DayExercise.training_day_id == request.from_day_id,
        DayExercise.order_index > exercise.order_index
    ).all()

    for ex in source_exercises:
        ex.order_index -= 1

    # Make room in target day
    target_exercises = db.query(DayExercise).filter(
        DayExercise.training_day_id == request.to_day_id,
        DayExercise.order_index >= request.new_index
    ).all()

    for ex in target_exercises:
        ex.order_index += 1

    # Move the exercise
    exercise.training_day_id = request.to_day_id
    exercise.order_index = request.new_index

    db.commit()
    db.refresh(exercise)

    # Reload with exercise relationship
    exercise = db.query(DayExercise).options(
        joinedload(DayExercise.exercise)
    ).filter(DayExercise.id == day_exercise_id).first()

    return exercise
