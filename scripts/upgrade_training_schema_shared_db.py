"""
Idempotent schema upgrade for shared Supabase DB used by Training API.

Usage:
  python scripts/upgrade_training_schema_shared_db.py --dry-run
  python scripts/upgrade_training_schema_shared_db.py --apply

Reads DSN from:
  1) --dsn
  2) TARGET_DSN
  3) DATABASE_URL
"""

from __future__ import annotations

import argparse
import os
from typing import Iterable

import psycopg


DDL_STATEMENTS: list[str] = [
    "CREATE SCHEMA IF NOT EXISTS training;",
    """
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'exercise_class'
        ) THEN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'training' AND t.typname = 'exercise_class' AND e.enumlabel = 'conditioning'
            ) THEN
                ALTER TYPE training.exercise_class ADD VALUE 'conditioning';
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'training' AND t.typname = 'exercise_class' AND e.enumlabel = 'balance'
            ) THEN
                ALTER TYPE training.exercise_class ADD VALUE 'balance';
            END IF;
        END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'exercise_type' AND e.enumlabel = 'MULTIARTICULAR'
        ) AND NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'exercise_type' AND e.enumlabel = 'multiarticular'
        ) THEN
            ALTER TYPE training.exercise_type RENAME VALUE 'MULTIARTICULAR' TO 'multiarticular';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'exercise_type' AND e.enumlabel = 'MONOARTICULAR'
        ) AND NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'exercise_type' AND e.enumlabel = 'monoarticular'
        ) THEN
            ALTER TYPE training.exercise_type RENAME VALUE 'MONOARTICULAR' TO 'monoarticular';
        END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'intensity_level' AND e.enumlabel = 'LOW'
        ) AND NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'intensity_level' AND e.enumlabel = 'low'
        ) THEN
            ALTER TYPE training.intensity_level RENAME VALUE 'LOW' TO 'low';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'intensity_level' AND e.enumlabel = 'MEDIUM'
        ) AND NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'intensity_level' AND e.enumlabel = 'medium'
        ) THEN
            ALTER TYPE training.intensity_level RENAME VALUE 'MEDIUM' TO 'medium';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'intensity_level' AND e.enumlabel = 'HIGH'
        ) AND NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'intensity_level' AND e.enumlabel = 'high'
        ) THEN
            ALTER TYPE training.intensity_level RENAME VALUE 'HIGH' TO 'high';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'intensity_level' AND e.enumlabel = 'DELOAD'
        ) AND NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'intensity_level' AND e.enumlabel = 'deload'
        ) THEN
            ALTER TYPE training.intensity_level RENAME VALUE 'DELOAD' TO 'deload';
        END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'exercise_phase' AND e.enumlabel = 'WARMUP'
        ) AND NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'exercise_phase' AND e.enumlabel = 'warmup'
        ) THEN
            ALTER TYPE training.exercise_phase RENAME VALUE 'WARMUP' TO 'warmup';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'exercise_phase' AND e.enumlabel = 'MAIN'
        ) AND NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'exercise_phase' AND e.enumlabel = 'main'
        ) THEN
            ALTER TYPE training.exercise_phase RENAME VALUE 'MAIN' TO 'main';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'exercise_phase' AND e.enumlabel = 'COOLDOWN'
        ) AND NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'training' AND t.typname = 'exercise_phase' AND e.enumlabel = 'cooldown'
        ) THEN
            ALTER TYPE training.exercise_phase RENAME VALUE 'COOLDOWN' TO 'cooldown';
        END IF;
    END $$;
    """,
    """
    ALTER TABLE training.exercises
        ADD COLUMN IF NOT EXISTS resistance_profile VARCHAR(50),
        ADD COLUMN IF NOT EXISTS category VARCHAR(100),
        ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
        ADD COLUMN IF NOT EXISTS anatomy_image_url TEXT,
        ADD COLUMN IF NOT EXISTS equipment_needed TEXT,
        ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(20),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE,
        ADD COLUMN IF NOT EXISTS description_en TEXT,
        ADD COLUMN IF NOT EXISTS description_es TEXT,
        ADD COLUMN IF NOT EXISTS cardio_subclass VARCHAR(20),
        ADD COLUMN IF NOT EXISTS intensity_zone INTEGER,
        ADD COLUMN IF NOT EXISTS target_heart_rate_min INTEGER,
        ADD COLUMN IF NOT EXISTS target_heart_rate_max INTEGER,
        ADD COLUMN IF NOT EXISTS calories_per_minute DOUBLE PRECISION;
    """,
    """
    UPDATE training.exercises
       SET name_en = COALESCE(NULLIF(name_en, ''), name_es),
           description_en = COALESCE(description_en, description),
           description_es = COALESCE(description_es, description),
           resistance_profile = COALESCE(NULLIF(resistance_profile, ''), 'flat'),
           category = COALESCE(NULLIF(category, ''), 'general'),
           updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP),
           exercise_class = COALESCE(exercise_class, 'strength'::training.exercise_class),
           difficulty_level = CASE
               WHEN difficulty_level IN ('beginner', 'intermediate', 'advanced') THEN difficulty_level
               ELSE NULL
           END;
    """,
    """
    ALTER TABLE training.muscles
        ADD COLUMN IF NOT EXISTS display_name_en VARCHAR(100),
        ADD COLUMN IF NOT EXISTS muscle_category VARCHAR(50),
        ADD COLUMN IF NOT EXISTS svg_ids TEXT[],
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    """,
    """
    UPDATE training.muscles
       SET display_name_en = COALESCE(display_name_en, INITCAP(REPLACE(name, '_', ' '))),
           display_name_es = COALESCE(display_name_es, INITCAP(REPLACE(name, '_', ' '))),
           muscle_category = COALESCE(
               NULLIF(muscle_category, ''),
               CASE
                   WHEN name IN ('chest', 'pectorals') THEN 'chest'
                   WHEN name IN ('lats', 'upper_back', 'lower_back') THEN 'back'
                   WHEN name IN ('anterior_deltoid', 'posterior_deltoid', 'deltoids') THEN 'shoulders'
                   WHEN name IN ('biceps', 'triceps', 'forearms') THEN 'arms'
                   WHEN name IN ('quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'tibialis') THEN 'legs'
                   ELSE 'core'
               END
           ),
           body_region = COALESCE(
               NULLIF(body_region, ''),
               CASE
                   WHEN name IN ('quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'tibialis') THEN 'lower_body'
                   WHEN name IN ('abs', 'obliques', 'core') THEN 'core'
                   ELSE 'upper_body'
               END
           ),
           sort_order = COALESCE(sort_order, 0),
           updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP),
           created_at = COALESCE(created_at, CURRENT_TIMESTAMP);
    """,
    """
    ALTER TABLE training.macrocycles
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS objective VARCHAR(200),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    """,
    """
    UPDATE training.macrocycles
       SET objective = COALESCE(NULLIF(objective, ''), 'general'),
           status = COALESCE(LOWER(status), 'draft'),
           created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
           updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);
    """,
    "ALTER TABLE training.macrocycles ALTER COLUMN status SET DEFAULT 'draft';",
    "ALTER TABLE training.macrocycles ALTER COLUMN objective SET DEFAULT 'general';",
    """
    ALTER TABLE training.mesocycles
        ADD COLUMN IF NOT EXISTS block_number INTEGER,
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    """,
    """
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY macrocycle_id ORDER BY COALESCE(start_date, CURRENT_DATE), id) AS rn
        FROM training.mesocycles
    )
    UPDATE training.mesocycles m
       SET block_number = r.rn,
           name = COALESCE(NULLIF(m.name, ''), 'Block ' || r.rn::text),
           start_date = COALESCE(m.start_date, CURRENT_DATE),
           end_date = COALESCE(m.end_date, COALESCE(m.start_date, CURRENT_DATE) + INTERVAL '27 days'),
           created_at = COALESCE(m.created_at, CURRENT_TIMESTAMP),
           updated_at = COALESCE(m.updated_at, CURRENT_TIMESTAMP)
      FROM ranked r
     WHERE m.id = r.id
       AND (m.block_number IS NULL OR m.name IS NULL OR m.start_date IS NULL OR m.end_date IS NULL);
    """,
    """
    ALTER TABLE training.microcycles
        ADD COLUMN IF NOT EXISTS name VARCHAR(200),
        ADD COLUMN IF NOT EXISTS start_date DATE,
        ADD COLUMN IF NOT EXISTS end_date DATE,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    """,
    """
    WITH ranked AS (
        SELECT id, mesocycle_id, ROW_NUMBER() OVER (PARTITION BY mesocycle_id ORDER BY id) AS rn
        FROM training.microcycles
    )
    UPDATE training.microcycles mi
       SET week_number = COALESCE(mi.week_number, r.rn),
           start_date = COALESCE(mi.start_date, ms.start_date + ((COALESCE(mi.week_number, r.rn) - 1) * INTERVAL '7 day')),
           end_date = COALESCE(mi.end_date, COALESCE(mi.start_date, ms.start_date + ((COALESCE(mi.week_number, r.rn) - 1) * INTERVAL '7 day')) + INTERVAL '6 day'),
           name = COALESCE(NULLIF(mi.name, ''), 'Week ' || COALESCE(mi.week_number, r.rn)::text),
           created_at = COALESCE(mi.created_at, CURRENT_TIMESTAMP),
           updated_at = COALESCE(mi.updated_at, CURRENT_TIMESTAMP)
      FROM ranked r
      JOIN training.mesocycles ms ON ms.id = r.mesocycle_id
     WHERE mi.id = r.id;
    """,
    """
    ALTER TABLE training.training_days
        ADD COLUMN IF NOT EXISTS date DATE,
        ADD COLUMN IF NOT EXISTS focus VARCHAR(200),
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    """,
    """
    WITH ranked AS (
        SELECT id, microcycle_id, ROW_NUMBER() OVER (PARTITION BY microcycle_id ORDER BY id) AS rn
        FROM training.training_days
    )
    UPDATE training.training_days td
       SET day_number = COALESCE(td.day_number, r.rn),
           name = COALESCE(NULLIF(td.name, ''), 'Day ' || COALESCE(td.day_number, r.rn)::text),
           date = COALESCE(td.date, mi.start_date + ((COALESCE(td.day_number, r.rn) - 1) * INTERVAL '1 day')),
           is_rest_day = COALESCE(td.is_rest_day, false),
           created_at = COALESCE(td.created_at, CURRENT_TIMESTAMP),
           updated_at = COALESCE(td.updated_at, CURRENT_TIMESTAMP)
      FROM ranked r
      JOIN training.microcycles mi ON mi.id = r.microcycle_id
     WHERE td.id = r.id;
    """,
    """
    ALTER TABLE training.day_exercises
        ADD COLUMN IF NOT EXISTS effort_type VARCHAR(20),
        ADD COLUMN IF NOT EXISTS effort_value DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS tempo VARCHAR(20),
        ADD COLUMN IF NOT EXISTS set_type VARCHAR(20),
        ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
        ADD COLUMN IF NOT EXISTS intensity_zone INTEGER,
        ADD COLUMN IF NOT EXISTS distance_meters INTEGER,
        ADD COLUMN IF NOT EXISTS target_calories INTEGER,
        ADD COLUMN IF NOT EXISTS intervals INTEGER,
        ADD COLUMN IF NOT EXISTS work_seconds INTEGER,
        ADD COLUMN IF NOT EXISTS interval_rest_seconds INTEGER,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    """,
    """
    WITH ranked AS (
        SELECT id, training_day_id, ROW_NUMBER() OVER (PARTITION BY training_day_id ORDER BY id) AS rn
        FROM training.day_exercises
    )
    UPDATE training.day_exercises de
       SET order_index = COALESCE(de.order_index, r.rn - 1),
           phase = COALESCE(de.phase, 'main'::training.exercise_phase),
           sets = COALESCE(de.sets, 3),
           reps_min = COALESCE(de.reps_min, 8),
           reps_max = COALESCE(de.reps_max, 12),
           rest_seconds = COALESCE(de.rest_seconds, 90),
           effort_type = COALESCE(NULLIF(de.effort_type, ''), 'RPE'),
           effort_value = COALESCE(de.effort_value, de.rpe_target, 7),
           created_at = COALESCE(de.created_at, CURRENT_TIMESTAMP),
           updated_at = COALESCE(de.updated_at, CURRENT_TIMESTAMP)
      FROM ranked r
     WHERE de.id = r.id;
    """,
    "CREATE INDEX IF NOT EXISTS idx_training_macrocycles_trainer_client_status ON training.macrocycles (trainer_id, client_id, status);",
    "CREATE INDEX IF NOT EXISTS idx_training_mesocycles_macrocycle_block ON training.mesocycles (macrocycle_id, block_number);",
    "CREATE INDEX IF NOT EXISTS idx_training_microcycles_mesocycle_week ON training.microcycles (mesocycle_id, week_number);",
    "CREATE INDEX IF NOT EXISTS idx_training_days_microcycle_day ON training.training_days (microcycle_id, day_number);",
    "CREATE INDEX IF NOT EXISTS idx_training_day_exercises_day_order ON training.day_exercises (training_day_id, order_index);",
]

ID_DEFAULT_TABLES = [
    "muscles",
    "exercises",
    "macrocycles",
    "mesocycles",
    "microcycles",
    "training_days",
    "day_exercises",
]


def _normalize_dsn(dsn: str) -> str:
    if dsn.startswith("postgres://"):
        return dsn.replace("postgres://", "postgresql://", 1)
    return dsn


def _sequence_setup_sql(table_name: str) -> str:
    seq_name = f"{table_name}_id_seq"
    return f"""
    DO $$
    DECLARE
        max_id BIGINT;
        is_identity_col BOOLEAN;
    BEGIN
        SELECT (c.is_identity = 'YES')
          INTO is_identity_col
          FROM information_schema.columns c
         WHERE c.table_schema = 'training'
           AND c.table_name = '{table_name}'
           AND c.column_name = 'id';

        IF is_identity_col THEN
            RETURN;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'training'
              AND c.relkind = 'S'
              AND c.relname = '{seq_name}'
        ) THEN
            EXECUTE 'CREATE SEQUENCE training.{seq_name}';
        END IF;

        EXECUTE 'ALTER TABLE training.{table_name} ALTER COLUMN id SET DEFAULT nextval(''training.{seq_name}'')';
        EXECUTE 'ALTER SEQUENCE training.{seq_name} OWNED BY training.{table_name}.id';

        EXECUTE 'SELECT COALESCE(MAX(id), 0) FROM training.{table_name}' INTO max_id;
        IF max_id = 0 THEN
            EXECUTE 'SELECT setval(''training.{seq_name}'', 1, false)';
        ELSE
            EXECUTE 'SELECT setval(''training.{seq_name}'', ' || max_id || ', true)';
        END IF;
    END $$;
    """


def run_upgrade(dsn: str, apply: bool) -> None:
    dsn = _normalize_dsn(dsn)

    with psycopg.connect(dsn) as conn:
        if not apply:
            with conn.cursor() as cur:
                cur.execute("SELECT current_database(), current_user")
                db_name, db_user = cur.fetchone()
                print(f"[dry-run] connected to database={db_name}, user={db_user}")
                print(f"[dry-run] will execute {len(DDL_STATEMENTS)} DDL statements + {len(ID_DEFAULT_TABLES)} sequence setup blocks")
            return

        with conn.cursor() as cur:
            for statement in DDL_STATEMENTS:
                cur.execute(statement)

            for table_name in ID_DEFAULT_TABLES:
                cur.execute(_sequence_setup_sql(table_name))

        conn.commit()
        print("[apply] schema upgrade completed successfully")


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upgrade shared Supabase training schema for Training API compatibility.")
    parser.add_argument("--dsn", help="PostgreSQL DSN. Falls back to TARGET_DSN or DATABASE_URL env vars.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Validate connectivity and planned actions (default).")
    mode.add_argument("--apply", action="store_true", help="Apply schema changes.")
    return parser.parse_args(list(argv))


def main(argv: Iterable[str]) -> int:
    args = parse_args(argv)
    dsn = args.dsn or os.getenv("TARGET_DSN") or os.getenv("DATABASE_URL")

    if not dsn:
        print("[error] Missing DSN. Provide --dsn or set TARGET_DSN/DATABASE_URL.")
        return 2

    apply = bool(args.apply)
    if not args.apply and not args.dry_run:
        apply = False

    run_upgrade(dsn=dsn, apply=apply)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(os.sys.argv[1:]))
