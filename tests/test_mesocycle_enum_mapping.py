from pathlib import Path
import sys

from sqlalchemy.dialects import postgresql


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from models.mesocycle import DayExercise, Microcycle  # noqa: E402


def test_day_exercise_phase_uses_native_training_enum() -> None:
    phase_type = DayExercise.__table__.c.phase.type

    assert phase_type.native_enum is True
    assert phase_type.name == "exercise_phase"
    assert phase_type.schema == "training"
    assert phase_type.compile(dialect=postgresql.dialect()) == "training.exercise_phase"


def test_microcycle_intensity_level_uses_native_training_enum() -> None:
    intensity_type = Microcycle.__table__.c.intensity_level.type

    assert intensity_type.native_enum is True
    assert intensity_type.name == "intensity_level"
    assert intensity_type.schema == "training"
    assert intensity_type.compile(dialect=postgresql.dialect()) == "training.intensity_level"
