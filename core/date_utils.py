from __future__ import annotations

from datetime import date


def calculate_age_from_date_of_birth(
    date_of_birth: date | None,
    *,
    reference_date: date | None = None,
    min_age: int | None = None,
    max_age: int | None = None,
) -> int | None:
    """Return full years from DOB, or None when DOB is invalid for calculation."""

    if date_of_birth is None:
        return None

    today = reference_date or date.today()
    if date_of_birth > today:
        return None

    age = today.year - date_of_birth.year
    has_had_birthday = (today.month, today.day) >= (date_of_birth.month, date_of_birth.day)
    if not has_had_birthday:
        age -= 1

    if age < 0:
        return None
    if min_age is not None and age < min_age:
        return None
    if max_age is not None and age > max_age:
        return None

    return age
