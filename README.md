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
- `NUTRITION_API_URL=http://nutrition-backend:3000`
- `NUTRITION_AUTH_ME_PATH=/v1/auth/introspect`
- `REDIS_URL=redis://app:<password-url-encoded>@fitpilot-redis:6379/0`

El backend de training valida JWT emitidos por nutrition usando ese endpoint interno.

Para stack compartido por multiples compose projects, crea la red externa:

```bash
docker network create fitpilot-shared || true
```

### Rollback rapido (produccion)

Si falla conectividad Redis despues del deploy:

1. Restaurar `REDIS_URL` previo en el `.env` del backend en VPS.
2. Re-ejecutar deploy de `main` para `fitpilot-training-backend`.
3. Verificar logs y mantener modo fail-open mientras se corrige red/ACL de Redis compartido.

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
- Nutrition JWT via `NUTRITION_API_URL + NUTRITION_AUTH_ME_PATH` (`/v1/auth/introspect` by default)

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

## Remote-only database guardrail

- `DATABASE_URL` no puede apuntar a `localhost`, `127.0.0.1`, `::1`, `postgres`, `db` ni `host.docker.internal`
- usa siempre un DSN remoto con `sslmode=require` como baseline

## Exercise media storage

Exercise media now uploads only to Cloudflare R2 and persists public CDN URLs (`R2_PUBLIC_BASE_URL/...`).

New exercise media and profile images no longer write to local disk.

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

