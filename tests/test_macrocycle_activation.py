from datetime import date
from pathlib import Path
from types import SimpleNamespace
import sys
import types


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

if "redis" not in sys.modules:
    redis_module = types.ModuleType("redis")

    class DummyRedis:
        @staticmethod
        def from_url(*args, **kwargs):
            return None

    redis_module.Redis = DummyRedis
    sys.modules["redis"] = redis_module

if "redis.exceptions" not in sys.modules:
    redis_exceptions = types.ModuleType("redis.exceptions")

    class RedisError(Exception):
        pass

    redis_exceptions.RedisError = RedisError
    sys.modules["redis.exceptions"] = redis_exceptions

from api.routers.mesocycles import _shift_macrocycle_schedule  # noqa: E402


def make_training_day(training_day_id: int, day_number: int):
    return SimpleNamespace(
        id=training_day_id,
        day_number=day_number,
        date=date(2026, 3, 1),
    )


def make_microcycle(microcycle_id: int, week_number: int, training_days: list[SimpleNamespace]):
    return SimpleNamespace(
        id=microcycle_id,
        week_number=week_number,
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 7),
        training_days=training_days,
    )


def make_mesocycle(mesocycle_id: int, block_number: int, microcycles: list[SimpleNamespace]):
    return SimpleNamespace(
        id=mesocycle_id,
        block_number=block_number,
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 14),
        microcycles=microcycles,
    )


def test_shift_macrocycle_schedule_reorders_dates_sequentially() -> None:
    mesocycle = make_mesocycle(
        1,
        1,
        [
            make_microcycle(2, 2, [make_training_day(22, 2), make_training_day(21, 1)]),
            make_microcycle(1, 1, [make_training_day(12, 2), make_training_day(11, 1)]),
        ],
    )
    macrocycle = SimpleNamespace(
        mesocycles=[mesocycle],
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 14),
    )

    shifted_count = _shift_macrocycle_schedule(macrocycle, date(2026, 3, 15))

    assert shifted_count == 4
    assert mesocycle.microcycles[1].training_days[1].date == date(2026, 3, 15)
    assert mesocycle.microcycles[1].training_days[0].date == date(2026, 3, 16)
    assert mesocycle.microcycles[0].training_days[1].date == date(2026, 3, 17)
    assert mesocycle.microcycles[0].training_days[0].date == date(2026, 3, 18)


def test_shift_macrocycle_schedule_updates_all_ranges() -> None:
    mesocycle_one = make_mesocycle(
        1,
        1,
        [make_microcycle(1, 1, [make_training_day(11, 1), make_training_day(12, 2)])],
    )
    mesocycle_two = make_mesocycle(
        2,
        2,
        [make_microcycle(2, 1, [make_training_day(21, 1)])],
    )
    macrocycle = SimpleNamespace(
        mesocycles=[mesocycle_two, mesocycle_one],
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 21),
    )

    _shift_macrocycle_schedule(macrocycle, date(2026, 3, 20))

    assert macrocycle.start_date == date(2026, 3, 20)
    assert macrocycle.end_date == date(2026, 3, 22)
    assert mesocycle_one.start_date == date(2026, 3, 20)
    assert mesocycle_one.end_date == date(2026, 3, 21)
    assert mesocycle_two.start_date == date(2026, 3, 22)
    assert mesocycle_two.end_date == date(2026, 3, 22)
