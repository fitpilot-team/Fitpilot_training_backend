from datetime import date, datetime
from pathlib import Path
from types import SimpleNamespace
import sys


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


from scripts.adapt_laura_microcycle import (  # noqa: E402
    build_training_day_normalizations,
    sort_logs_for_authoritative_choice,
)


def test_build_training_day_normalizations_keeps_double_session_same_date() -> None:
    microcycle = SimpleNamespace(
        id=9,
        start_date=date(2026, 3, 17),
        end_date=date(2026, 3, 26),
    )
    training_days = [
        SimpleNamespace(
            id=101,
            day_number=1,
            date=date(2026, 3, 17),
            session_index=1,
            session_label="",
            name="Pierna A",
        ),
        SimpleNamespace(
            id=102,
            day_number=1,
            date=date(2026, 3, 17),
            session_index=4,
            session_label=" PM ",
            name="Torso PM",
        ),
        SimpleNamespace(
            id=103,
            day_number=4,
            date=date(2026, 3, 20),
            session_index=1,
            session_label=None,
            name="Pierna B",
        ),
    ]

    normalized = build_training_day_normalizations(microcycle, training_days)

    assert [(item.training_day_id, item.day_number, item.date, item.session_index) for item in normalized] == [
        (101, 1, date(2026, 3, 17), 1),
        (102, 1, date(2026, 3, 17), 2),
        (103, 4, date(2026, 3, 20), 1),
    ]
    assert normalized[0].session_label is None
    assert normalized[1].session_label == "PM"


def test_sort_logs_for_authoritative_choice_prefers_completed_before_newer_in_progress() -> None:
    logs = [
        SimpleNamespace(
            id=5,
            status="in_progress",
            started_at=datetime(2026, 3, 21, 10, 0, 0),
            completed_at=None,
        ),
        SimpleNamespace(
            id=4,
            status="completed",
            started_at=datetime(2026, 3, 19, 10, 0, 0),
            completed_at=datetime(2026, 3, 19, 11, 0, 0),
        ),
        SimpleNamespace(
            id=3,
            status="abandoned",
            started_at=datetime(2026, 3, 20, 10, 0, 0),
            completed_at=None,
        ),
    ]

    ranked = sort_logs_for_authoritative_choice(logs)

    assert [log.id for log in ranked] == [4, 5, 3]
