from time import perf_counter
from typing import Mapping


def elapsed_ms(started_at: float | None, finished_at: float | None = None) -> float:
    if started_at is None:
        return 0.0

    end_time = perf_counter() if finished_at is None else finished_at
    return max((end_time - started_at) * 1000, 0.0)


def format_timing_fields(fields: Mapping[str, float | None]) -> str:
    return " ".join(
        f"{key}={value:.2f}ms"
        for key, value in fields.items()
        if value is not None
    )
