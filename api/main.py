from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from core.config import settings
from api.routers import auth, exercises, muscles, mesocycles, microcycles, training_days, day_exercises, ai_generator, translation, workout_logs

app = FastAPI(
    title="FitPilot API",
    version="1.0.0",
    description="API for workout routine management with AI-powered generation"
)

# CORS configuration - explicit origins for credentials, plus local network for dev/mobile testing
LOCAL_LAN_ORIGIN_REGEX = (
    r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}"
    r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?"
)
frontend_origin = settings.FRONTEND_URL.rstrip("/")
allowed_origins = [frontend_origin] if frontend_origin else ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=LOCAL_LAN_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files configuration
STATIC_DIR = Path(__file__).parent.parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(muscles.router, prefix="/api/muscles", tags=["Muscles"])
app.include_router(exercises.router, prefix="/api/exercises", tags=["Exercises"])
app.include_router(mesocycles.router, prefix="/api/mesocycles", tags=["Mesocycles"])
app.include_router(microcycles.router, prefix="/api/microcycles", tags=["Microcycles"])
app.include_router(training_days.router, prefix="/api/training-days", tags=["Training Days"])
app.include_router(day_exercises.router, prefix="/api/day-exercises", tags=["Day Exercises"])

# AI Generator
app.include_router(ai_generator.router, prefix="/api/ai", tags=["AI Generator"])

# Translation (Ollama/Llama)
app.include_router(translation.router, prefix="/api/translation", tags=["Translation"])

# Workout Logs (Mobile App)
app.include_router(workout_logs.router, prefix="/api/workout-logs", tags=["Workout Logs"])


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
