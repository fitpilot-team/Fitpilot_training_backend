"""
One-off adaptation script for Laura Torres Camarillo's training program.

Usage:
  python scripts/adapt_laura_microcycle.py --dry-run
  python scripts/adapt_laura_microcycle.py --apply

Reads DSN from:
  1) --dsn
  2) TARGET_DSN
  3) DATABASE_URL
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable, Sequence
from urllib.parse import urlparse

from sqlalchemy import create_engine, func
from sqlalchemy.orm import Session, joinedload, sessionmaker


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

LOCAL_DATABASE_HOSTS = {
    "",
    "localhost",
    "127.0.0.1",
    "::1",
    "postgres",
    "db",
    "host.docker.internal",
}


def is_remote_postgres_dsn(dsn: str | None) -> bool:
    if not dsn:
        return False
    parsed = urlparse(dsn)
    if parsed.scheme not in {"postgres", "postgresql", "postgresql+psycopg"}:
        return False
    return (parsed.hostname or "").lower() not in LOCAL_DATABASE_HOSTS


def extract_cli_dsn(argv: Sequence[str]) -> str | None:
    args = list(argv)
    for index, item in enumerate(args):
        if item == "--dsn" and index + 1 < len(args):
            return args[index + 1]
        if item.startswith("--dsn="):
            return item.split("=", 1)[1]
    return None


def bootstrap_database_url(argv: Sequence[str]) -> str | None:
    original_database_url = os.getenv("DATABASE_URL")
    if original_database_url is not None:
        os.environ["_ADAPT_LAURA_ORIGINAL_DATABASE_URL"] = original_database_url

    candidate_dsn = extract_cli_dsn(argv) or os.getenv("TARGET_DSN") or original_database_url
    if is_remote_postgres_dsn(candidate_dsn):
        os.environ["DATABASE_URL"] = candidate_dsn
        return candidate_dsn

    os.environ["DATABASE_URL"] = "postgresql://user:password@remote-db.example.com:5432/fitpilot?sslmode=require"
    return None


bootstrap_database_url(sys.argv[1:])

from models.mesocycle import Macrocycle, Mesocycle, MesocycleStatus, Microcycle, TrainingDay  # noqa: E402
from models.user import User  # noqa: E402
from models.workout_log import WorkoutLog, WorkoutStatus  # noqa: E402


DEFAULT_EMAIL = "laura.torres.camarillo@gmail.com"


@dataclass(frozen=True)
class TrainingDayNormalization:
    training_day_id: int
    day_number: int
    date: date
    session_index: int
    session_label: str | None
    fallback_name: str | None


def normalize_dsn(dsn: str) -> str:
    if dsn.startswith("postgres://"):
        return dsn.replace("postgres://", "postgresql+psycopg://", 1)
    if dsn.startswith("postgresql://"):
        return dsn.replace("postgresql://", "postgresql+psycopg://", 1)
    return dsn


def build_session_factory(dsn: str) -> sessionmaker:
    engine = create_engine(normalize_dsn(dsn), pool_pre_ping=True)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def enum_value(value: object) -> str | None:
    return getattr(value, "value", value)


def status_priority(status: object) -> int:
    value = enum_value(status)
    if value == WorkoutStatus.COMPLETED.value:
        return 0
    if value == WorkoutStatus.IN_PROGRESS.value:
        return 1
    if value == WorkoutStatus.ABANDONED.value:
        return 2
    return 3


def canonical_session_label(label: str | None) -> str | None:
    if label is None:
        return None
    trimmed = label.strip()
    return trimmed or None


def fallback_training_day_name(name: str | None, day_number: int) -> str | None:
    trimmed = (name or "").strip()
    if trimmed:
        return None
    return f"Day {day_number}"


def training_day_sort_key(training_day: object, microcycle: object) -> tuple[date, int, int, int]:
    span = (microcycle.end_date - microcycle.start_date).days + 1
    current_date = getattr(training_day, "date", None)
    if isinstance(current_date, date) and microcycle.start_date <= current_date <= microcycle.end_date:
        anchor = current_date
    else:
        day_number = getattr(training_day, "day_number", None)
        if isinstance(day_number, int) and 1 <= day_number <= span:
            anchor = microcycle.start_date + timedelta(days=day_number - 1)
        else:
            anchor = microcycle.end_date

    day_number = getattr(training_day, "day_number", None)
    safe_day_number = day_number if isinstance(day_number, int) and day_number > 0 else span + 1
    session_index = getattr(training_day, "session_index", None)
    safe_session_index = session_index if isinstance(session_index, int) and session_index > 0 else 1
    return anchor, safe_day_number, safe_session_index, int(getattr(training_day, "id"))


def build_training_day_normalizations(
    microcycle: object,
    training_days: Sequence[object],
) -> list[TrainingDayNormalization]:
    ordered_days = sorted(training_days, key=lambda training_day: training_day_sort_key(training_day, microcycle))
    span = (microcycle.end_date - microcycle.start_date).days + 1
    if span <= 0:
        raise RuntimeError(f"Microcycle {getattr(microcycle, 'id', '?')} has an invalid date range.")

    grouped_days: list[list[object]] = []
    grouped_keys: set[tuple[str, object]] = set()
    by_group: dict[tuple[str, object], list[object]] = defaultdict(list)

    for training_day in ordered_days:
        current_date = getattr(training_day, "date", None)
        day_number = getattr(training_day, "day_number", None)
        if isinstance(current_date, date) and microcycle.start_date <= current_date <= microcycle.end_date:
            group_key = ("date", current_date)
        elif isinstance(day_number, int) and 1 <= day_number <= span:
            group_key = ("day_number", day_number)
        else:
            group_key = ("id", int(getattr(training_day, "id")))

        if group_key not in grouped_keys:
            grouped_keys.add(group_key)
            grouped_days.append(by_group[group_key])
        by_group[group_key].append(training_day)

    grouped_days = [group for group in grouped_days if group]
    if len(grouped_days) > span:
        raise RuntimeError(
            f"Microcycle {getattr(microcycle, 'id', '?')} has {len(grouped_days)} planned day groups "
            f"for a {span}-day range."
        )

    normalizations: list[TrainingDayNormalization] = []
    used_day_numbers: set[int] = set()
    last_assigned_day_number = 0

    for group in grouped_days:
        preferred_day_number: int | None = None
        first_day = group[0]
        first_date = getattr(first_day, "date", None)
        first_ordinal = getattr(first_day, "day_number", None)

        if isinstance(first_date, date) and microcycle.start_date <= first_date <= microcycle.end_date:
            preferred_day_number = (first_date - microcycle.start_date).days + 1
        elif isinstance(first_ordinal, int) and 1 <= first_ordinal <= span:
            preferred_day_number = first_ordinal

        candidate_day_number: int | None = None
        if preferred_day_number is not None and preferred_day_number not in used_day_numbers and preferred_day_number >= last_assigned_day_number:
            candidate_day_number = preferred_day_number
        else:
            for current_day_number in range(max(1, last_assigned_day_number), span + 1):
                if current_day_number not in used_day_numbers:
                    candidate_day_number = current_day_number
                    break

        if candidate_day_number is None:
            raise RuntimeError(
                f"Unable to assign a canonical day number to microcycle {getattr(microcycle, 'id', '?')}."
            )

        used_day_numbers.add(candidate_day_number)
        last_assigned_day_number = candidate_day_number
        canonical_date = microcycle.start_date + timedelta(days=candidate_day_number - 1)

        group.sort(key=lambda training_day: training_day_sort_key(training_day, microcycle))
        for session_position, training_day in enumerate(group, start=1):
            normalizations.append(
                TrainingDayNormalization(
                    training_day_id=int(getattr(training_day, "id")),
                    day_number=candidate_day_number,
                    date=canonical_date,
                    session_index=session_position,
                    session_label=canonical_session_label(getattr(training_day, "session_label", None)),
                    fallback_name=fallback_training_day_name(getattr(training_day, "name", None), candidate_day_number),
                )
            )

    return sorted(normalizations, key=lambda item: (item.date, item.session_index, item.training_day_id))


def sort_logs_for_authoritative_choice(workout_logs: Sequence[object]) -> list[object]:
    ordered_logs = list(workout_logs)
    ordered_logs.sort(key=lambda workout_log: int(getattr(workout_log, "id", 0)), reverse=True)
    ordered_logs.sort(
        key=lambda workout_log: getattr(workout_log, "completed_at", None)
        or getattr(workout_log, "started_at", None)
        or datetime.min,
        reverse=True,
    )
    ordered_logs.sort(key=lambda workout_log: status_priority(getattr(workout_log, "status", None)))
    return ordered_logs


def workout_log_performed_on_date(workout_log: WorkoutLog) -> date:
    if workout_log.started_at:
        return workout_log.started_at.date()
    if workout_log.performed_on_date:
        return workout_log.performed_on_date
    if workout_log.training_day and workout_log.training_day.date:
        return workout_log.training_day.date
    return date.today()


def find_target_user(db: Session, email: str) -> User:
    user = (
        db.query(User)
        .filter(func.lower(User.email) == email.strip().lower())
        .first()
    )
    if not user:
        raise RuntimeError(f"Client not found for email {email}.")
    return user


def find_latest_macrocycle(db: Session, client_id: int) -> Macrocycle:
    macrocycle = (
        db.query(Macrocycle)
        .options(
            joinedload(Macrocycle.mesocycles)
            .joinedload(Mesocycle.microcycles),
        )
        .filter(Macrocycle.client_id == client_id)
        .order_by(Macrocycle.created_at.desc(), Macrocycle.start_date.desc(), Macrocycle.id.desc())
        .first()
    )
    if not macrocycle:
        raise RuntimeError(f"No macrocycle found for client {client_id}.")
    return macrocycle


def iter_ordered_microcycles(macrocycle: Macrocycle) -> list[Microcycle]:
    microcycles: list[Microcycle] = []
    ordered_mesocycles = sorted(
        list(macrocycle.mesocycles or []),
        key=lambda mesocycle: (mesocycle.block_number, mesocycle.start_date, mesocycle.id),
    )
    for mesocycle in ordered_mesocycles:
        ordered_microcycles = sorted(
            list(mesocycle.microcycles or []),
            key=lambda microcycle: (microcycle.week_number, microcycle.start_date, microcycle.id),
        )
        microcycles.extend(ordered_microcycles)
    return microcycles


def apply_macrocycle_activation(
    macrocycles: Sequence[Macrocycle],
    latest_macrocycle_id: int,
) -> list[str]:
    changes: list[str] = []
    today = date.today()

    for macrocycle in macrocycles:
        original_status = enum_value(macrocycle.status)
        if int(macrocycle.id) == latest_macrocycle_id:
            target_status = MesocycleStatus.ACTIVE
        elif original_status == MesocycleStatus.ACTIVE.value:
            target_status = MesocycleStatus.COMPLETED if macrocycle.end_date and macrocycle.end_date < today else MesocycleStatus.ARCHIVED
        else:
            continue

        if enum_value(target_status) != original_status:
            macrocycle.status = target_status
            changes.append(
                f"macrocycle {macrocycle.id}: status {original_status or 'null'} -> {enum_value(target_status)}"
            )

    return changes


def apply_training_day_normalization(db: Session, macrocycle: Macrocycle) -> list[str]:
    changes: list[str] = []

    for microcycle in iter_ordered_microcycles(macrocycle):
        training_days = (
            db.query(TrainingDay)
            .filter(TrainingDay.microcycle_id == microcycle.id)
            .order_by(TrainingDay.date, TrainingDay.day_number, TrainingDay.session_index, TrainingDay.id)
            .all()
        )
        if not training_days:
            continue

        normalizations = build_training_day_normalizations(microcycle, training_days)
        by_id = {int(training_day.id): training_day for training_day in training_days}

        for normalization in normalizations:
            training_day = by_id[normalization.training_day_id]
            before = (
                training_day.day_number,
                training_day.date,
                training_day.session_index,
                canonical_session_label(training_day.session_label),
                (training_day.name or "").strip(),
            )

            training_day.day_number = normalization.day_number
            training_day.date = normalization.date
            training_day.session_index = normalization.session_index
            training_day.session_label = normalization.session_label
            if normalization.fallback_name:
                training_day.name = normalization.fallback_name

            after = (
                training_day.day_number,
                training_day.date,
                training_day.session_index,
                training_day.session_label,
                (training_day.name or "").strip(),
            )

            if before != after:
                changes.append(
                    "training_day "
                    f"{training_day.id}: day/date/session/label/name "
                    f"{before} -> {after}"
                )

    return changes


def apply_workout_log_normalization(db: Session, client_id: int) -> list[str]:
    changes: list[str] = []
    workout_logs = (
        db.query(WorkoutLog)
        .options(joinedload(WorkoutLog.training_day))
        .filter(WorkoutLog.client_id == client_id)
        .order_by(WorkoutLog.training_day_id, WorkoutLog.id)
        .all()
    )

    logs_by_training_day: dict[int | None, list[WorkoutLog]] = defaultdict(list)
    for workout_log in workout_logs:
        target_performed_on_date = workout_log_performed_on_date(workout_log)
        if workout_log.performed_on_date != target_performed_on_date:
            changes.append(
                f"workout_log {workout_log.id}: performed_on_date {workout_log.performed_on_date} -> {target_performed_on_date}"
            )
            workout_log.performed_on_date = target_performed_on_date

        logs_by_training_day[int(workout_log.training_day_id) if workout_log.training_day_id is not None else None].append(workout_log)

    for training_day_id, duplicate_logs in logs_by_training_day.items():
        if training_day_id is None:
            continue

        ranked_logs = sort_logs_for_authoritative_choice(duplicate_logs)
        for index, workout_log in enumerate(ranked_logs):
            target_authoritative = index == 0
            if bool(workout_log.is_authoritative) != target_authoritative:
                changes.append(
                    f"workout_log {workout_log.id}: is_authoritative {bool(workout_log.is_authoritative)} -> {target_authoritative}"
                )
                workout_log.is_authoritative = target_authoritative

    return changes


def run_adaptation(
    *,
    dsn: str,
    email: str,
    apply: bool,
) -> tuple[list[str], dict[str, int]]:
    session_factory = build_session_factory(dsn)

    with session_factory() as db:
        user = find_target_user(db, email)
        macrocycles = (
            db.query(Macrocycle)
            .options(
                joinedload(Macrocycle.mesocycles)
                .joinedload(Mesocycle.microcycles),
                joinedload(Macrocycle.mesocycles)
                .joinedload(Mesocycle.microcycles)
                .joinedload(Microcycle.training_days),
            )
            .filter(Macrocycle.client_id == user.id)
            .order_by(Macrocycle.created_at.desc(), Macrocycle.start_date.desc(), Macrocycle.id.desc())
            .all()
        )
        if not macrocycles:
            raise RuntimeError(f"No macrocycles found for client {user.email}.")

        latest_macrocycle = macrocycles[0]
        changes: list[str] = []
        changes.extend(apply_macrocycle_activation(macrocycles, int(latest_macrocycle.id)))
        changes.extend(apply_training_day_normalization(db, latest_macrocycle))
        changes.extend(apply_workout_log_normalization(db, int(user.id)))

        summary = {
            "client_id": int(user.id),
            "macrocycle_id": int(latest_macrocycle.id),
            "changes": len(changes),
        }

        if apply:
            db.commit()
        else:
            db.rollback()

        return changes, summary


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Adapt Laura Torres Camarillo's macrocycle to the variable microcycle model.")
    parser.add_argument("--dsn", help="PostgreSQL DSN. Falls back to TARGET_DSN or DATABASE_URL env vars.")
    parser.add_argument("--email", default=DEFAULT_EMAIL, help=f"Client email. Defaults to {DEFAULT_EMAIL}.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Inspect and print planned changes (default).")
    mode.add_argument("--apply", action="store_true", help="Persist the adaptation.")
    return parser.parse_args(list(argv))


def main(argv: Iterable[str]) -> int:
    args = parse_args(argv)
    dsn = (
        args.dsn
        or os.getenv("TARGET_DSN")
        or os.getenv("_ADAPT_LAURA_ORIGINAL_DATABASE_URL")
        or os.getenv("DATABASE_URL")
    )
    if not is_remote_postgres_dsn(dsn):
        print("[error] Missing DSN. Provide --dsn or set TARGET_DSN/DATABASE_URL.")
        return 2

    apply = bool(args.apply)
    if not args.apply and not args.dry_run:
        apply = False

    changes, summary = run_adaptation(dsn=dsn, email=args.email, apply=apply)
    mode = "apply" if apply else "dry-run"
    print(
        f"[{mode}] client_id={summary['client_id']} macrocycle_id={summary['macrocycle_id']} "
        f"planned_changes={summary['changes']}"
    )
    for change in changes:
        print(f"[{mode}] {change}")

    if not changes:
        print(f"[{mode}] no changes required")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
