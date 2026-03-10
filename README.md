# Fitpilot Training Backend

## Auth compatibility (Nutrition -> Training)

Training endpoints accept:
- Nutrition JWT via `NUTRITION_API_URL + NUTRITION_AUTH_ME_PATH` (`/v1/auth/me`)

`/api/auth/login` is intentionally deprecated for operational use. Authenticate against Nutrition API and reuse that Bearer token for Training API.

Role mapping used for authorization:
- `ADMIN` / `admin` -> `admin`
- `PROFESSIONAL` + `public.user_professional_roles` contains `TRAINER` -> `trainer`
- `CLIENT` / `patient` -> `client`

## Shared DB schema upgrade

To align `training.*` with API contract on Supabase shared DB, run:

```bash
python scripts/upgrade_training_schema_shared_db.py --dry-run --dsn "$TARGET_DSN"
python scripts/upgrade_training_schema_shared_db.py --apply --dsn "$TARGET_DSN"
```

The upgrade is idempotent and covers:
- missing columns for exercises/programs payload compatibility
- enum normalization to lowercase where required by frontend contract
- ID sequence/default setup for insert paths

## Exercise media storage providers

`EXERCISE_MEDIA_PROVIDER`:
- `local`: stores files under `static/exercises` and persists `/static/exercises/...`
- `r2`: uploads to Cloudflare R2 and persists public CDN URL (`R2_PUBLIC_BASE_URL/...`)

Dual-read compatibility remains enabled:
- legacy URLs `/static/...` continue to work via FastAPI static mount
- new uploads can target R2

## Media migration script

Dry-run:

```bash
python scripts/migrate_exercise_media_to_r2.py
```

Apply:

```bash
python scripts/migrate_exercise_media_to_r2.py --apply
```

The script migrates only legacy `/static/...` URLs for:
- `image_url`
- `thumbnail_url`
- `anatomy_image_url`

It does not delete local files.

## Suggested `/static` retirement criteria

1. Run migration in apply mode and resolve missing/upload errors.
2. Verify frontend exercise pages and program editor load images without `/static` dependencies.
3. Confirm no critical DB records still reference `/static/exercises/...`.
4. Remove local media serving only after full verification in staging/production.
