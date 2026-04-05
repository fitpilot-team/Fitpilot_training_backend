## Integracion con `fit-pilot10` (Docker Compose raiz)

Este backend forma parte del stack local orquestado desde:
`C:\Users\ale_o\Fit-pilot1.0\docker-compose.yml`

La base de datos es remote-only en desarrollo y produccion. `DATABASE_URL` debe apuntar a una instancia PostgreSQL remota; hosts locales o aliases Docker se rechazan al arrancar.
Cuando el DSN usa el pooler compartido de Supabase en session mode, usa un pool pequeno en la app (`DATABASE_POOL_SIZE=1`, `DATABASE_MAX_OVERFLOW=0`) para evitar `MaxClientsInSessionMode`.

### Flujo recomendado

1. Copiar plantilla de variables especificas de training:

```bash
cp .env.fit-pilot10.example .env.fit-pilot10
```

2. Desde la raiz del workspace:

```bash
docker compose --env-file .env.fit-pilot10 -f docker-compose.yml up -d --build training-schema-check training-backend
```

### Dependencia de auth contra Nutrition

En modo integracion local:
- `NUTRITION_JWT_SECRETS=<JWT_SECRET de Nutrition>[,<anterior>]`
- `NUTRITION_JWT_ALGORITHM=HS256`
- `REDIS_URL=redis://app:<password-url-encoded>@fitpilot-redis:6379/0`

El backend de training valida localmente los JWT emitidos por nutrition usando el mismo secret de firma del access token.

Para stack compartido por multiples compose projects, crea la red externa:

```bash
docker network create fitpilot-shared || true
```

### Rollback rapido (produccion)

Si falla conectividad Redis despues del deploy:

1. Restaurar `REDIS_URL` previo en el `.env` del backend en VPS.
2. Re-ejecutar deploy de `main` para `fitpilot-training-backend`.
3. Verificar logs y mantener modo fail-open mientras se corrige red/ACL de Redis compartido.

### Variables de entorno en VPS

- El workflow de deploy sincroniza `docker-compose.release.yml`, pero no sincroniza el `.env` del VPS.
- Antes de desplegar, confirma que el archivo objetivo (`VPS_BACKEND_ENV_FILE`, por defecto `/opt/Fitpilot_training_backend/.env`) exista y tenga valores no vacios para:
  - `DATABASE_URL`
  - `NUTRITION_JWT_SECRETS`
  - `R2_ENDPOINT`
  - `R2_BUCKET`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_PUBLIC_BASE_URL`
- El workflow ahora aborta el deploy si falta cualquiera de esas variables para evitar un backend healthy con uploads rotos.

### Validacion de esquema (dry-run)

El servicio `training-schema-check` ejecuta:

```bash
python scripts/upgrade_training_schema_shared_db.py --dry-run --dsn "$SUPABASE_DATABASE_URL"
```

Si este check falla, `training-backend` no arranca.

---
# Fitpilot Training Backend

## Frontend source of truth

This repository no longer contains the React frontend (`src/`, Vite config, and frontend build files were removed).
The only supported frontend codebase is:

- https://github.com/fitpilot-team/FitPilot-frontend

## Auth compatibility (Nutrition -> Training)

Training endpoints accept:
- Nutrition JWT validated locally via `NUTRITION_JWT_SECRETS`
- `NUTRITION_JWT_SECRETS` accepts rotacion sin downtime en formato `nuevo,anterior`
- `NUTRITION_JWT_SECRETS` must contain the same access-token signing secret configured in Nutrition as `JWT_SECRET`

`/api/auth/login` is intentionally deprecated for operational use. Authenticate against Nutrition API and reuse that Bearer token for Training API.

Recommended rotation flow:
- deploy Training with `NUTRITION_JWT_SECRETS=nuevo,anterior`
- deploy Nutrition signing new access tokens with `JWT_SECRET=nuevo`
- wait longer than `JWT_ACCESS_EXPIRES_IN` (`15m` by default)
- remove the previous secret from `NUTRITION_JWT_SECRETS`

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

## Remote-only database guardrail

- `DATABASE_URL` no puede apuntar a `localhost`, `127.0.0.1`, `::1`, `postgres`, `db` ni `host.docker.internal`
- usa siempre un DSN remoto con `sslmode=require` como baseline

## Exercise media storage

Exercise media now uploads only to Cloudflare R2 and persists public CDN URLs (`R2_PUBLIC_BASE_URL/...`).

New exercise media and profile images no longer write to local disk.

At startup the API logs a warning if the R2 configuration is incomplete. The service remains healthy, but upload endpoints will fail until the missing `R2_*` values are fixed in the VPS `.env`.

## AI generator

The training AI generator now supports a slot-based internal architecture for multi-week programs while keeping the public response contract backward compatible.

Current behavior:
- `/api/ai/preview` remains a fast 1-microcycle preview
- `/api/ai/generate` respects the full requested duration
- `/api/ai/save` persists the full generated macrocycle
- multi-week generation can use slot candidates, base-week expansion, and phased generation

Anthropic model configuration:
- default model: `claude-sonnet-4-6`
- override with `ANTHROPIC_MODEL` if you need to pin another Claude release
- add `ANTHROPIC_API_KEY` in `fitpilot-training-backend/.env` when you run the backend directly
- add `ANTHROPIC_API_KEY` in `fitpilot-training-backend/.env.fit-pilot10` when you run the root Docker stack

How to test:
- `/api/ai/test-generate` does not call Anthropic and is useful for validating the backend flow without credits
- `/api/ai/preview` is the cheapest real Anthropic test once `ANTHROPIC_API_KEY` is configured
- `/api/ai/generate` is the real full-program path and uses the configured `ANTHROPIC_MODEL`

Operational and architecture details:
- [AI_GENERATOR_SLOT_BASED.md](/c:/Users/ale_o/Fit-pilot1.0/fitpilot-training-backend/AI_GENERATOR_SLOT_BASED.md)

## Legacy image cleanup script

Dry-run:

```bash
python scripts/cleanup_legacy_local_image_urls.py
```

Apply:

```bash
python scripts/cleanup_legacy_local_image_urls.py --apply
```

The script nulls legacy local image URLs for:
- `image_url`
- `thumbnail_url`
- `anatomy_image_url`
- `profile_picture`

No local image compatibility remains enabled after this cleanup.
