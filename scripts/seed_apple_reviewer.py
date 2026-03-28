from __future__ import annotations

import logging
import os
import sys
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.base import SessionLocal
from models.exercise import Exercise
from models.mesocycle import (
    DayExercise,
    EffortType,
    ExercisePhase,
    IntensityLevel,
    Macrocycle,
    Mesocycle,
    MesocycleStatus,
    Microcycle,
    TrainingDay,
)
from models.user import User, UserRole
from models.workout_log import ExerciseSetLog, WorkoutLog, WorkoutStatus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REVIEWER_EMAIL = "appreview@fitpilot.fit"
REVIEWER_PASSWORD_HASH = "$2b$10$5u2UYMqQvSrX8/9HHxMrfO3KSSELoUcsxpKDOswd/5UTT8K5ubdsC"
REVIEWER_NAME = "Apple Reviewer"
MACROCYCLE_NAME = "Definicion Reviewer"
MACROCYCLE_DESCRIPTION = "Mock data for App Store Review"
MESOCYCLE_NAME = "Hipertrofia - Review Phase 1"
MICROCYCLE_NAME = "Semana 1 - Review"
COMPLETED_LOG_NOTE = "Sesion demo para App Review"


@dataclass(frozen=True)
class ExerciseTemplate:
    exercise_name: str
    sets: int
    reps_min: int
    reps_max: int
    rest_seconds: int
    weight_kg: float | None = None


@dataclass(frozen=True)
class TrainingDayTemplate:
    name: str
    focus: str
    rest_day: bool = False
    notes: str | None = None
    exercises: tuple[ExerciseTemplate, ...] = ()


DAY_TEMPLATES: tuple[TrainingDayTemplate, ...] = (
    TrainingDayTemplate(
        name="Pecho y Triceps",
        focus="Push",
        notes="Sesion completada demo para App Review.",
        exercises=(
            ExerciseTemplate("Chest Press Machine", 4, 8, 10, 90, 25.0),
            ExerciseTemplate("Overhead Press", 3, 8, 10, 90, 12.5),
            ExerciseTemplate("Lateral Raise (Dumbbell)", 3, 12, 15, 60, 6.0),
            ExerciseTemplate("Tricep Pushdown (Rope)", 3, 12, 15, 60, 20.0),
        ),
    ),
    TrainingDayTemplate(
        name="Espalda y Biceps",
        focus="Pull",
        notes="Sesion pendiente para que el reviewer pueda abrirla.",
        exercises=(
            ExerciseTemplate("Lat Pulldown", 4, 8, 10, 90),
            ExerciseTemplate("Seated Cable Row", 4, 8, 10, 90),
            ExerciseTemplate("Barbell Curl", 3, 10, 12, 60),
            ExerciseTemplate("Hammer Curl", 3, 12, 15, 60),
        ),
    ),
    TrainingDayTemplate(
        name="Descanso activo",
        focus="Recuperacion",
        rest_day=True,
        notes="Movilidad suave y caminata ligera.",
    ),
    TrainingDayTemplate(
        name="Descanso",
        focus="Recuperacion",
        rest_day=True,
        notes="Recuperacion total.",
    ),
    TrainingDayTemplate(
        name="Descanso",
        focus="Recuperacion",
        rest_day=True,
        notes="Recuperacion total.",
    ),
    TrainingDayTemplate(
        name="Descanso",
        focus="Recuperacion",
        rest_day=True,
        notes="Recuperacion total.",
    ),
    TrainingDayTemplate(
        name="Descanso",
        focus="Recuperacion",
        rest_day=True,
        notes="Recuperacion total.",
    ),
)


def get_or_create_reviewer(db) -> User:
    reviewer = db.query(User).filter(User.email == REVIEWER_EMAIL).first()
    if reviewer:
        reviewer.full_name = REVIEWER_NAME
        reviewer.hashed_password = REVIEWER_PASSWORD_HASH
        reviewer.role = UserRole.CLIENT
        reviewer.is_active = True
        reviewer.is_phone_verified = True
        return reviewer

    reviewer = User(
        email=REVIEWER_EMAIL,
        full_name=REVIEWER_NAME,
        hashed_password=REVIEWER_PASSWORD_HASH,
        role=UserRole.CLIENT,
        is_active=True,
        is_phone_verified=True,
    )
    db.add(reviewer)
    db.flush()
    logger.info("Created Apple Reviewer user with id=%s", reviewer.id)
    return reviewer


def resolve_trainer(db, reviewer: User) -> User:
    trainer = (
        db.query(User)
        .filter(User.is_active.is_(True), User.role == UserRole.TRAINER)
        .order_by(User.id)
        .first()
    )
    if trainer:
        return trainer

    admin = (
        db.query(User)
        .filter(User.is_active.is_(True), User.role == UserRole.ADMIN)
        .order_by(User.id)
        .first()
    )
    if admin:
        return admin

    return reviewer


def get_or_create_macrocycle(
    db,
    *,
    reviewer: User,
    trainer: User,
    start_date: date,
    end_date: date,
) -> Macrocycle:
    macrocycle = (
        db.query(Macrocycle)
        .filter(Macrocycle.client_id == reviewer.id)
        .order_by(Macrocycle.id.desc())
        .first()
    )
    if macrocycle is None:
        macrocycle = Macrocycle(client_id=reviewer.id, trainer_id=trainer.id)
        db.add(macrocycle)
        db.flush()

    macrocycle.name = MACROCYCLE_NAME
    macrocycle.description = MACROCYCLE_DESCRIPTION
    macrocycle.objective = "Fat Loss"
    macrocycle.start_date = start_date
    macrocycle.end_date = end_date
    macrocycle.status = MesocycleStatus.ACTIVE
    macrocycle.client_id = reviewer.id
    macrocycle.trainer_id = trainer.id
    return macrocycle


def get_or_create_mesocycle(
    db,
    *,
    macrocycle: Macrocycle,
    start_date: date,
    end_date: date,
) -> Mesocycle:
    mesocycle = (
        db.query(Mesocycle)
        .filter(Mesocycle.macrocycle_id == macrocycle.id)
        .order_by(Mesocycle.id.desc())
        .first()
    )
    if mesocycle is None:
        mesocycle = Mesocycle(macrocycle_id=macrocycle.id, block_number=1, name=MESOCYCLE_NAME)
        db.add(mesocycle)
        db.flush()

    mesocycle.macrocycle_id = macrocycle.id
    mesocycle.block_number = 1
    mesocycle.name = MESOCYCLE_NAME
    mesocycle.description = "Review phase with visible demo data."
    mesocycle.start_date = start_date
    mesocycle.end_date = end_date
    mesocycle.focus = "Fat Loss"
    mesocycle.notes = "Week 1 demo for App Review."
    return mesocycle


def get_or_create_microcycle(
    db,
    *,
    mesocycle: Mesocycle,
    start_date: date,
    end_date: date,
) -> Microcycle:
    microcycle = (
        db.query(Microcycle)
        .filter(Microcycle.mesocycle_id == mesocycle.id)
        .order_by(Microcycle.id.desc())
        .first()
    )
    if microcycle is None:
        microcycle = Microcycle(mesocycle_id=mesocycle.id, week_number=1, name=MICROCYCLE_NAME)
        db.add(microcycle)
        db.flush()

    microcycle.mesocycle_id = mesocycle.id
    microcycle.week_number = 1
    microcycle.name = MICROCYCLE_NAME
    microcycle.start_date = start_date
    microcycle.end_date = end_date
    microcycle.intensity_level = IntensityLevel.MEDIUM
    microcycle.notes = "2 training sessions and 5 rest days for the reviewer demo."
    return microcycle


def require_exercise(db, exercise_name: str) -> Exercise:
    exercise = (
        db.query(Exercise)
        .filter((Exercise.name_en == exercise_name) | (Exercise.name_es == exercise_name))
        .first()
    )
    if exercise is None:
        raise RuntimeError(f"Required exercise '{exercise_name}' was not found in the catalog.")
    return exercise


def clear_microcycle_demo_data(db, microcycle_id: int) -> None:
    training_day_ids = [
        int(training_day_id)
        for (training_day_id,) in db.query(TrainingDay.id).filter(TrainingDay.microcycle_id == microcycle_id).all()
    ]
    if not training_day_ids:
        return

    workout_log_ids = [
        int(workout_log_id)
        for (workout_log_id,) in db.query(WorkoutLog.id).filter(WorkoutLog.training_day_id.in_(training_day_ids)).all()
    ]
    if workout_log_ids:
        db.query(ExerciseSetLog).filter(
            ExerciseSetLog.workout_log_id.in_(workout_log_ids)
        ).delete(synchronize_session=False)
        db.query(WorkoutLog).filter(WorkoutLog.id.in_(workout_log_ids)).delete(synchronize_session=False)

    db.query(DayExercise).filter(DayExercise.training_day_id.in_(training_day_ids)).delete(
        synchronize_session=False
    )
    db.query(TrainingDay).filter(TrainingDay.id.in_(training_day_ids)).delete(synchronize_session=False)


def create_training_days(
    db,
    *,
    microcycle: Microcycle,
    micro_start: date,
) -> dict[int, tuple[TrainingDay, list[DayExercise]]]:
    created_days: dict[int, tuple[TrainingDay, list[DayExercise]]] = {}

    for day_number, template in enumerate(DAY_TEMPLATES, start=1):
        training_day = TrainingDay(
            microcycle_id=microcycle.id,
            day_number=day_number,
            date=micro_start + timedelta(days=day_number - 1),
            session_index=1,
            session_label=None,
            name=template.name,
            focus=template.focus,
            rest_day=template.rest_day,
            notes=template.notes,
        )
        db.add(training_day)
        db.flush()

        exercises: list[DayExercise] = []
        if not template.rest_day:
            for order_index, exercise_template in enumerate(template.exercises, start=1):
                exercise = require_exercise(db, exercise_template.exercise_name)
                day_exercise = DayExercise(
                    training_day_id=training_day.id,
                    exercise_id=exercise.id,
                    order_index=order_index,
                    phase=ExercisePhase.MAIN,
                    sets=exercise_template.sets,
                    reps_min=exercise_template.reps_min,
                    reps_max=exercise_template.reps_max,
                    rest_seconds=exercise_template.rest_seconds,
                    effort_type=EffortType.RIR,
                    effort_value=2.0,
                    set_type="straight",
                )
                db.add(day_exercise)
                db.flush()
                exercises.append(day_exercise)

        created_days[day_number] = (training_day, exercises)

    return created_days


def build_day_one_template_map(db) -> dict[int, ExerciseTemplate]:
    exercise_map: dict[int, ExerciseTemplate] = {}
    for template in DAY_TEMPLATES[0].exercises:
        exercise = require_exercise(db, template.exercise_name)
        exercise_map[int(exercise.id)] = template
    return exercise_map


def create_completed_log(
    db,
    *,
    reviewer: User,
    training_day: TrainingDay,
    day_exercises: list[DayExercise],
) -> None:
    start_at = datetime.combine(training_day.date, time(hour=18, minute=0))
    completed_at = datetime.combine(training_day.date, time(hour=18, minute=45))
    workout_log = WorkoutLog(
        client_id=reviewer.id,
        training_day_id=training_day.id,
        started_at=start_at,
        completed_at=completed_at,
        performed_on_date=training_day.date,
        is_authoritative=True,
        status=WorkoutStatus.COMPLETED,
        notes=COMPLETED_LOG_NOTE,
    )
    db.add(workout_log)
    db.flush()

    template_by_exercise_id = build_day_one_template_map(db)
    set_completion_at = start_at

    for day_exercise in day_exercises:
        template = template_by_exercise_id[int(day_exercise.exercise_id)]
        for set_number in range(1, day_exercise.sets + 1):
            set_completion_at += timedelta(minutes=3)
            db.add(
                ExerciseSetLog(
                    workout_log_id=workout_log.id,
                    exercise_id=day_exercise.exercise_id,
                    day_exercise_id=day_exercise.id,
                    set_number=set_number,
                    reps_completed=template.reps_min,
                    weight_kg=template.weight_kg,
                    effort_value=2.0,
                    completed_at=set_completion_at,
                )
            )


def seed_apple_reviewer() -> None:
    db = SessionLocal()
    try:
        reviewer = get_or_create_reviewer(db)
        trainer = resolve_trainer(db, reviewer)

        today = date.today()
        micro_start = today - timedelta(days=1)
        macro_start = micro_start
        macro_end = macro_start + timedelta(days=27)
        micro_end = micro_start + timedelta(days=6)

        macrocycle = get_or_create_macrocycle(
            db,
            reviewer=reviewer,
            trainer=trainer,
            start_date=macro_start,
            end_date=macro_end,
        )
        mesocycle = get_or_create_mesocycle(
            db,
            macrocycle=macrocycle,
            start_date=macro_start,
            end_date=macro_end,
        )
        microcycle = get_or_create_microcycle(
            db,
            mesocycle=mesocycle,
            start_date=micro_start,
            end_date=micro_end,
        )

        clear_microcycle_demo_data(db, microcycle.id)
        created_days = create_training_days(db, microcycle=microcycle, micro_start=micro_start)

        first_day, first_day_exercises = created_days[1]
        create_completed_log(
            db,
            reviewer=reviewer,
            training_day=first_day,
            day_exercises=first_day_exercises,
        )

        db.commit()
        logger.info(
            "Apple Reviewer seeded: reviewer_id=%s trainer_id=%s macrocycle_id=%s microcycle_id=%s",
            reviewer.id,
            trainer.id,
            macrocycle.id,
            microcycle.id,
        )
    except Exception:
        db.rollback()
        logger.exception("Failed to seed Apple Reviewer demo data")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_apple_reviewer()
