# AGENTS.md — Fitpilot_training_backend

## Rol del repo
Backend FastAPI del dominio de entrenamiento.
El frontend source of truth vive en FitPilot-frontend.
La auth operativa depende de Nutrition (`/v1/auth/me`).

## Rutas importantes
- api/routers
- services
- prompts
- tests
- backend/Dockerfile
- docker-compose.yml

## Reglas para Command Palette
- Exponer resultados/acciones ligeras para:
  - clients
  - exercises
  - mesocycles
  - microcycles
  - training_days
  - workout_logs
- No meter ni reconstruir frontend aquí.
- No alterar el flujo de auth basado en Nutrition salvo pedido explícito.
- Preferir cambios pequeños en routers/services.

## Validación
- No ejecutar docker compose automáticamente.
- No correr scripts destructivos automáticamente.
- Usar pytest selectivo solo cuando el entorno esté claro o la tarea lo pida.