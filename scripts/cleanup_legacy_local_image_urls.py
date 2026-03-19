"""
Null out legacy local image URLs that still point to /static paths.

Usage:
  python scripts/cleanup_legacy_local_image_urls.py           # dry-run
  python scripts/cleanup_legacy_local_image_urls.py --apply   # execute cleanup
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import sys

from sqlalchemy import text

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from models.base import SessionLocal  # noqa: E402

LEGACY_EXERCISE_PREFIX = "/static/exercises/%"
LEGACY_PROFILE_PREFIX = "/static/profiles/%"


@dataclass
class CleanupCounts:
    image_url: int = 0
    thumbnail_url: int = 0
    anatomy_image_url: int = 0
    profile_picture: int = 0


def detect_exercises_schema(db) -> str:
    query = text(
        """
        SELECT table_schema
        FROM information_schema.tables
        WHERE table_name = 'exercises'
          AND table_schema IN ('training', 'public')
        ORDER BY CASE WHEN table_schema = 'training' THEN 0 ELSE 1 END
        LIMIT 1
        """
    )
    schema = db.execute(query).scalar()
    if not schema:
        raise RuntimeError("Could not find exercises table in training/public schemas")
    return schema


def collect_counts(db, schema: str) -> CleanupCounts:
    def count(column: str, prefix: str, table: str, table_schema: str) -> int:
        query = text(
            f'SELECT COUNT(*) FROM "{table_schema}"."{table}" WHERE {column} LIKE :prefix'
        )
        return int(db.execute(query, {"prefix": prefix}).scalar() or 0)

    return CleanupCounts(
        image_url=count("image_url", LEGACY_EXERCISE_PREFIX, "exercises", schema),
        thumbnail_url=count("thumbnail_url", LEGACY_EXERCISE_PREFIX, "exercises", schema),
        anatomy_image_url=count("anatomy_image_url", LEGACY_EXERCISE_PREFIX, "exercises", schema),
        profile_picture=count("profile_picture", LEGACY_PROFILE_PREFIX, "users", "public"),
    )


def apply_cleanup(db, schema: str) -> CleanupCounts:
    def clear(column: str, prefix: str, table: str, table_schema: str) -> int:
        query = text(
            f'UPDATE "{table_schema}"."{table}" SET {column} = NULL WHERE {column} LIKE :prefix'
        )
        result = db.execute(query, {"prefix": prefix})
        return int(result.rowcount or 0)

    counts = CleanupCounts(
        image_url=clear("image_url", LEGACY_EXERCISE_PREFIX, "exercises", schema),
        thumbnail_url=clear("thumbnail_url", LEGACY_EXERCISE_PREFIX, "exercises", schema),
        anatomy_image_url=clear("anatomy_image_url", LEGACY_EXERCISE_PREFIX, "exercises", schema),
        profile_picture=clear("profile_picture", LEGACY_PROFILE_PREFIX, "users", "public"),
    )
    db.commit()
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove legacy local image URLs from the training DB.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist the cleanup instead of reporting only.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        schema = detect_exercises_schema(db)
        counts = apply_cleanup(db, schema) if args.apply else collect_counts(db, schema)
        mode = "APPLY" if args.apply else "DRY-RUN"
        print(f"[{mode}] Legacy local image cleanup")
        print(f"Exercises schema: {schema}")
        print(f"image_url: {counts.image_url}")
        print(f"thumbnail_url: {counts.thumbnail_url}")
        print(f"anatomy_image_url: {counts.anatomy_image_url}")
        print(f"profile_picture: {counts.profile_picture}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
