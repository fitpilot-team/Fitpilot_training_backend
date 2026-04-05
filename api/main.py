import logging
from time import perf_counter

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from core.config import settings
from core.cors import LOCAL_LAN_ORIGIN_REGEX, resolve_allowed_origins
from core.startup import validate_media_storage_startup_health
from core.timing import elapsed_ms
from api.routers import (
    ai_generator,
    auth,
    clients,
    client_interviews,
    day_exercises,
    exercises,
    mesocycles,
    microcycles,
    muscles,
    training_days,
    translation,
    workout_analytics,
    workout_logs,
)


logger = logging.getLogger(__name__)

app = FastAPI(
    title="FitPilot API",
    version="1.0.0",
    description="API for workout routine management with AI-powered generation"
)

allowed_origins = resolve_allowed_origins(settings)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=LOCAL_LAN_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def log_media_storage_startup_health() -> None:
    validate_media_storage_startup_health()


@app.middleware("http")
async def log_http_request_timing(request: Request, call_next):
    request_started_at = perf_counter()
    request.state.request_started_at = request_started_at
    response = None

    try:
        response = await call_next(request)
        return response
    finally:
        finished_at = perf_counter()
        total_ms = elapsed_ms(request_started_at, finished_at)
        status_code = response.status_code if response is not None else 500
        route_started_at = getattr(request.state, "router_started_at", None)
        route_completed_at = getattr(request.state, "router_completed_at", None)

        extra = ""
        if route_started_at is not None and route_completed_at is not None:
            route_ms = elapsed_ms(route_started_at, route_completed_at)
            finalize_ms = elapsed_ms(route_completed_at, finished_at)
            extra = f" router={route_ms:.2f}ms finalize={finalize_ms:.2f}ms"

        logger.info(
            "[request] %s %s -> %s in %.2fms%s",
            request.method,
            request.url.path,
            status_code,
            total_ms,
            extra,
        )

# Static video files configuration
VIDEO_STATIC_DIR = Path(__file__).parent.parent / "static" / "videos"
VIDEO_STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/videos", StaticFiles(directory=str(VIDEO_STATIC_DIR)), name="static-videos")

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(muscles.router, prefix="/api/muscles", tags=["Muscles"])
app.include_router(exercises.router, prefix="/api/exercises", tags=["Exercises"])
app.include_router(clients.router, prefix="/api/clients", tags=["Clients"])
app.include_router(mesocycles.router, prefix="/api/mesocycles", tags=["Mesocycles"])
app.include_router(microcycles.router, prefix="/api/microcycles", tags=["Microcycles"])
app.include_router(training_days.router, prefix="/api/training-days", tags=["Training Days"])
app.include_router(day_exercises.router, prefix="/api/day-exercises", tags=["Day Exercises"])
app.include_router(client_interviews.router, prefix="/api/client-interviews", tags=["Client Interviews"])

# AI Generator
app.include_router(ai_generator.router, prefix="/api/ai", tags=["AI Generator"])

# Translation (Ollama/Llama)
app.include_router(translation.router, prefix="/api/translation", tags=["Translation"])

# Workout Logs (Mobile App)
app.include_router(workout_logs.router, prefix="/api/workout-logs", tags=["Workout Logs"])
app.include_router(workout_analytics.router, prefix="/api/workout-analytics", tags=["Workout Analytics"])


@app.get("/")
def read_root():
    return {
        "message": "FitPilot API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
