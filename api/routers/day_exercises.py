from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from typing import List
from models.base import get_db
from models.user import User
from models.mesocycle import DayExercise, ExercisePhase
from models.exercise import Exercise
from schemas.mesocycle import (
    DayExerciseCreate,
    DayExerciseTransferRequest,
    DayExerciseTransferResponse,
    DayExerciseUpdate,
    DayExerciseResponse,
)
from core.dependencies import (
    assert_macrocycle_access,
    assert_training_professional_access,
    get_macrocycle_for_microcycle,
    get_current_user,
    get_microcycle_or_404,
    get_training_day_or_404,
)

router = APIRouter()

DAY_EXERCISE_COPY_FIELDS = (
    "exercise_id",
    "sets",
    "reps_min",
    "reps_max",
    "rest_seconds",
    "effort_type",
    "effort_value",
    "tempo",
    "set_type",
    "duration_seconds",
    "intensity_zone",
    "distance_meters",
    "target_calories",
    "intervals",
    "work_seconds",
    "interval_rest_seconds",
    "notes",
    "rpe_target",
)


class MoveExerciseRequest(BaseModel):
    from_day_id: int
    to_day_id: int
    new_index: int


def verify_training_day_access(db: Session, training_day_id: int, current_user: User):
    """Verify user has access to the training day through its parent macrocycle"""
    training_day = get_training_day_or_404(db, training_day_id)
    microcycle = get_microcycle_or_404(db, training_day.microcycle_id)
    macrocycle = get_macrocycle_for_microcycle(db, microcycle)
    assert_macrocycle_access(
        macrocycle=macrocycle,
        current_user=current_user,
        forbidden_detail="Not authorized to access this exercise",
    )

    return training_day


def get_day_exercise_or_404(db: Session, day_exercise_id: int) -> DayExercise:
    day_exercise = db.query(DayExercise).filter(DayExercise.id == day_exercise_id).first()
    if not day_exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Day exercise with id {day_exercise_id} not found"
        )
    return day_exercise


def get_day_exercise_with_access(db: Session, day_exercise_id: int, current_user: User) -> DayExercise:
    day_exercise = get_day_exercise_or_404(db, day_exercise_id)
    verify_training_day_access(db, day_exercise.training_day_id, current_user)
    return day_exercise


def ensure_exercise_exists(db: Session, exercise_id: int) -> Exercise:
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exercise with id {exercise_id} not found"
        )
    return exercise


def list_day_exercises_for_day(db: Session, training_day_id: int) -> list[DayExercise]:
    return db.query(DayExercise).options(
        joinedload(DayExercise.exercise)
    ).filter(
        DayExercise.training_day_id == training_day_id
    ).order_by(
        DayExercise.order_index,
        DayExercise.id,
    ).all()


def clamp_insert_index(new_index: int, collection_size: int) -> int:
    return max(0, min(new_index, collection_size))


def reindex_day_exercises(day_exercises: list[DayExercise]) -> None:
    for index, exercise in enumerate(day_exercises):
        exercise.order_index = index


def build_day_exercise_copy(
    source_exercise: DayExercise,
    *,
    training_day_id: int,
    order_index: int,
    phase: ExercisePhase | str | None = None,
    notes: str | None = None,
) -> DayExercise:
    exercise_data = {
        field: getattr(source_exercise, field)
        for field in DAY_EXERCISE_COPY_FIELDS
    }
    exercise_data["training_day_id"] = training_day_id
    exercise_data["order_index"] = order_index
    exercise_data["phase"] = phase or source_exercise.phase
    if notes is not None:
        exercise_data["notes"] = notes
    return DayExercise(**exercise_data)


def apply_day_exercise_transfer(
    *,
    mode: str,
    exercise: DayExercise,
    source_day_exercises: list[DayExercise],
    target_day_exercises: list[DayExercise],
    target_day_id: int,
    requested_index: int,
    target_phase: ExercisePhase | str,
) -> DayExercise:
    normalized_index = clamp_insert_index(requested_index, len(target_day_exercises))

    if mode == "move":
        source_without_exercise = [
            source_exercise
            for source_exercise in source_day_exercises
            if source_exercise.id != exercise.id
        ]
        target_day_exercises.insert(normalized_index, exercise)
        exercise.training_day_id = target_day_id
        exercise.phase = target_phase
        reindex_day_exercises(source_without_exercise)
        reindex_day_exercises(target_day_exercises)
        source_day_exercises[:] = source_without_exercise
        return exercise

    cloned_exercise = build_day_exercise_copy(
        exercise,
        training_day_id=target_day_id,
        order_index=normalized_index,
        phase=target_phase,
    )
    target_day_exercises.insert(normalized_index, cloned_exercise)
    reindex_day_exercises(target_day_exercises)
    return cloned_exercise


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
    return list_day_exercises_for_day(db, training_day_id)


@router.get("/{day_exercise_id}", response_model=DayExerciseResponse)
def get_day_exercise(
    day_exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific day exercise by ID"""
    return get_day_exercise_with_access(db, day_exercise_id, current_user)


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
    # Only trainer professionals with training plan access (or admin) can create.
    assert_training_professional_access(current_user)

    # Verify training day exists and user has access
    training_day = verify_training_day_access(db, training_day_id, current_user)

    # Verify exercise exists
    ensure_exercise_exists(db, day_exercise_data.exercise_id)

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
    assert_training_professional_access(current_user)

    day_exercise = get_day_exercise_with_access(db, day_exercise_id, current_user)

    # If exercise_id is being changed, verify new exercise exists
    if day_exercise_data.exercise_id:
        ensure_exercise_exists(db, day_exercise_data.exercise_id)

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
    assert_training_professional_access(current_user)

    day_exercise = get_day_exercise_with_access(db, day_exercise_id, current_user)

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
    assert_training_professional_access(current_user)

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
    assert_training_professional_access(current_user)

    # Get original exercise
    original_exercise = get_day_exercise_with_access(db, day_exercise_id, current_user)
    target_day_exercises = list_day_exercises_for_day(db, original_exercise.training_day_id)
    original_index = next(
        (
            index
            for index, exercise in enumerate(target_day_exercises)
            if exercise.id == original_exercise.id
        ),
        None,
    )
    if original_index is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original exercise not found in its training day"
        )

    new_exercise = build_day_exercise_copy(
        original_exercise,
        training_day_id=original_exercise.training_day_id,
        order_index=original_index + 1,
        notes=f"{original_exercise.notes} (Copy)" if original_exercise.notes else "Copy",
    )
    target_day_exercises.insert(original_index + 1, new_exercise)
    reindex_day_exercises(target_day_exercises)

    db.add(new_exercise)
    db.commit()
    db.refresh(new_exercise)

    return db.query(DayExercise).options(
        joinedload(DayExercise.exercise)
    ).filter(DayExercise.id == new_exercise.id).first()


@router.post("/{day_exercise_id}/transfer", response_model=DayExerciseTransferResponse)
def transfer_day_exercise_between_days(
    day_exercise_id: int,
    request: DayExerciseTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Move or clone an exercise between training days.

    The operation is transactional and returns the full source and target day state
    so the frontend can update both columns without a follow-up fetch.
    """
    assert_training_professional_access(current_user)

    exercise = get_day_exercise_with_access(db, day_exercise_id, current_user)
    verify_training_day_access(db, request.from_day_id, current_user)
    verify_training_day_access(db, request.to_day_id, current_user)

    if exercise.training_day_id != request.from_day_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exercise is not in the specified source day"
        )

    source_day_exercises = list_day_exercises_for_day(db, request.from_day_id)
    target_day_exercises = list_day_exercises_for_day(db, request.to_day_id)

    if request.mode == "move" and request.from_day_id == request.to_day_id:
        source_day_exercises = [
            day_exercise
            for day_exercise in source_day_exercises
            if day_exercise.id != exercise.id
        ]
        target_day_exercises = list(source_day_exercises)

    transferred_exercise = apply_day_exercise_transfer(
        mode=request.mode,
        exercise=exercise,
        source_day_exercises=source_day_exercises,
        target_day_exercises=target_day_exercises,
        target_day_id=request.to_day_id,
        requested_index=request.new_index,
        target_phase=request.phase,
    )

    if request.mode == "clone":
        db.add(transferred_exercise)

    db.commit()
    db.refresh(transferred_exercise)
    transferred_exercise = db.query(DayExercise).options(
        joinedload(DayExercise.exercise)
    ).filter(DayExercise.id == transferred_exercise.id).first()

    source_response = list_day_exercises_for_day(db, request.from_day_id)
    target_response = list_day_exercises_for_day(db, request.to_day_id)

    return {
        "mode": request.mode,
        "source_day_id": request.from_day_id,
        "target_day_id": request.to_day_id,
        "transferred_exercise": transferred_exercise,
        "source_day_exercises": source_response,
        "target_day_exercises": target_response,
    }


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
    assert_training_professional_access(current_user)

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
