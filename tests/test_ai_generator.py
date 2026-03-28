import asyncio
import os
from pathlib import Path
from types import SimpleNamespace
import sys
import types


os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://user:password@remote-db.example.com:5432/fitpilot?sslmode=require",
)
os.environ.setdefault("NUTRITION_JWT_SECRETS", "test-secret")


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

if "redis" not in sys.modules:
    redis_module = types.ModuleType("redis")

    class DummyRedis:
        @staticmethod
        def from_url(*args, **kwargs):
            return None

    redis_module.Redis = DummyRedis
    sys.modules["redis"] = redis_module

if "redis.exceptions" not in sys.modules:
    redis_exceptions = types.ModuleType("redis.exceptions")

    class RedisError(Exception):
        pass

    redis_exceptions.RedisError = RedisError
    sys.modules["redis.exceptions"] = redis_exceptions

if "anthropic" not in sys.modules:
    anthropic_module = types.ModuleType("anthropic")

    class AsyncAnthropic:
        def __init__(self, *args, **kwargs):
            self.messages = SimpleNamespace(create=None)

    anthropic_module.AsyncAnthropic = AsyncAnthropic
    sys.modules["anthropic"] = anthropic_module

from api.routers import ai_generator as ai_router  # noqa: E402
from models.mesocycle import DayExercise, Macrocycle, Mesocycle, Microcycle, TrainingDay  # noqa: E402
from prompts.workout_generator import (  # noqa: E402
    assemble_optimized_program_prompt,
    build_slot_candidate_catalog,
)
from schemas.ai_generator import (  # noqa: E402
    AIWorkoutRequest,
    AIWorkoutResponse,
    GenerationMetadata,
    GeneratedMacrocycle,
    GeneratedMesocycle,
    GeneratedMicrocycle,
    GeneratedTrainingDay,
    GeneratedDayExercise,
    SaveWorkoutRequest,
    ProgramExplanation,
)
from services import ai_generator as ai_service  # noqa: E402
from services.ai_generator import ExerciseMapper  # noqa: E402
from services.ai_slotting import SlotCatalogBuildResult  # noqa: E402


class DummyExercise:
    def __init__(
        self,
        exercise_id: int,
        name: str,
        *,
        primary_muscles: list[str],
        secondary_muscles: list[str] | None = None,
        exercise_type: str = "multiarticular",
        equipment_needed: str = "barbell",
        difficulty_level: str = "intermediate",
        category: str = "strength",
        exercise_class: str = "strength",
        cardio_subclass: str | None = None,
        resistance_profile: str = "flat",
    ):
        self.id = exercise_id
        self.name_es = name
        self.name_en = name
        self.type = exercise_type
        self.category = category
        self.primary_muscle_names = primary_muscles
        self.secondary_muscle_names = secondary_muscles or []
        self.difficulty_level = difficulty_level
        self.equipment_needed = equipment_needed
        self.resistance_profile = resistance_profile
        self.exercise_class = exercise_class
        self.cardio_subclass = cardio_subclass
        self.intensity_zone = None
        self.target_heart_rate_min = None
        self.target_heart_rate_max = None
        self.calories_per_minute = None

    def get_name(self, language: str = "es") -> str:
        return self.name_es if language == "es" else self.name_en


class FakeQuery:
    def __init__(self, result):
        self._result = result

    def all(self):
        return self._result


class FakeExerciseSession:
    def __init__(self, exercises):
        self.exercises = exercises

    def query(self, model):
        if model is ai_router.Exercise:
            return FakeQuery(self.exercises)
        raise AssertionError(f"Unexpected model queried: {model}")


class SaveSession:
    def __init__(self, exercises):
        self.exercises = exercises
        self.added = []
        self._next_id = 1
        self.committed = False
        self.rolled_back = False

    def query(self, model):
        if model is ai_router.Exercise:
            return FakeQuery(self.exercises)
        raise AssertionError(f"Unexpected model queried: {model}")

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        for obj in self.added:
            if getattr(obj, "id", None) is None:
                obj.id = self._next_id
                self._next_id += 1

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


def build_request_dict(total_weeks: int) -> dict:
    return {
        "user_profile": {"fitness_level": "intermediate", "age": 30},
        "goals": {"primary_goal": "hypertrophy", "target_muscle_groups": ["chest", "back", "legs"]},
        "availability": {"days_per_week": 3, "session_duration_minutes": 60},
        "equipment": {"has_gym_access": True, "available_equipment": ["barbell", "dumbbells", "cables", "machines", "bench", "squat_rack"]},
        "restrictions": {"injuries": [], "excluded_exercises": [], "medical_conditions": []},
        "preferences": {"exercise_variety": "medium", "include_cardio": False, "include_warmup": True, "include_cooldown": False},
        "program_duration": {
            "total_weeks": total_weeks,
            "mesocycle_weeks": 4 if total_weeks >= 4 else max(1, total_weeks),
            "include_deload": True,
            "start_date": "2026-03-26",
        },
        "creation_mode": "client",
        "client_id": "client-1",
    }


def build_exercises() -> list[DummyExercise]:
    return [
        DummyExercise(1, "Bench Press", primary_muscles=["chest", "triceps"], equipment_needed="barbell"),
        DummyExercise(14, "Push Up", primary_muscles=["chest", "triceps"], equipment_needed="bodyweight"),
        DummyExercise(2, "Incline DB Press", primary_muscles=["chest", "shoulders"], equipment_needed="dumbbells"),
        DummyExercise(3, "Chest Press Machine", primary_muscles=["chest", "triceps"], equipment_needed="machines"),
        DummyExercise(4, "Lat Pulldown", primary_muscles=["back", "lats"], equipment_needed="cables"),
        DummyExercise(15, "Pull Up", primary_muscles=["back", "lats"], equipment_needed="pull_up_bar"),
        DummyExercise(5, "Seated Cable Row", primary_muscles=["back", "rhomboids"], equipment_needed="cables"),
        DummyExercise(16, "Chest Supported Row", primary_muscles=["back", "rhomboids"], equipment_needed="machines"),
        DummyExercise(6, "Back Squat", primary_muscles=["quadriceps", "glutes"], equipment_needed="barbell"),
        DummyExercise(17, "Leg Press", primary_muscles=["quadriceps", "glutes"], equipment_needed="machines"),
        DummyExercise(7, "Romanian Deadlift", primary_muscles=["hamstrings", "glutes"], equipment_needed="barbell"),
        DummyExercise(18, "Hip Thrust", primary_muscles=["hamstrings", "glutes"], equipment_needed="barbell"),
        DummyExercise(8, "Cable Fly", primary_muscles=["chest"], exercise_type="monoarticular", equipment_needed="cables"),
        DummyExercise(9, "Lateral Raise", primary_muscles=["shoulders"], exercise_type="monoarticular", equipment_needed="dumbbells"),
        DummyExercise(10, "Triceps Pushdown", primary_muscles=["triceps"], exercise_type="monoarticular", equipment_needed="cables"),
        DummyExercise(11, "DB Curl", primary_muscles=["biceps"], exercise_type="monoarticular", equipment_needed="dumbbells"),
        DummyExercise(12, "Standing Calf Raise", primary_muscles=["calves"], exercise_type="monoarticular", equipment_needed="machines"),
        DummyExercise(13, "Plank", primary_muscles=["core"], exercise_type="monoarticular", equipment_needed="bodyweight", category="core"),
    ]


def build_generated_macrocycle(total_weeks: int, *, with_slot_metadata: bool = False) -> GeneratedMacrocycle:
    microcycles = []
    for week in range(1, total_weeks + 1):
        exercises = [
            GeneratedDayExercise(
                exercise_id="1",
                exercise_name="Bench Press",
                order_index=0,
                sets=3,
                reps_min=8,
                reps_max=12,
                rest_seconds=90,
                effort_type="RIR",
                effort_value=2,
                slot_role="primary_horizontal_press" if with_slot_metadata else None,
                slot_candidate_ids=[1, 2, 3] if with_slot_metadata else None,
            )
        ]
        microcycles.append(
            GeneratedMicrocycle(
                week_number=week,
                name=f"Semana {week}",
                intensity_level="medium" if week < total_weeks else "high",
                training_days=[
                    GeneratedTrainingDay(
                        day_number=1,
                        name="Dia 1",
                        focus="chest",
                        rest_day=False,
                        exercises=exercises,
                    )
                ],
            )
        )

    return GeneratedMacrocycle(
        name=f"Programa {total_weeks} semanas",
        description="Programa de prueba",
        objective="hypertrophy",
        mesocycles=[
            GeneratedMesocycle(
                block_number=1,
                name="Bloque 1",
                focus="Acumulacion",
                microcycles=microcycles,
            )
        ],
    )


def build_save_request(total_weeks: int) -> SaveWorkoutRequest:
    payload = build_request_dict(total_weeks)
    payload["workout_data"] = {
        "macrocycle": build_generated_macrocycle(total_weeks, with_slot_metadata=True).model_dump(),
        "explanation": {
            "rationale": "Test",
            "progression_strategy": "Base week + progression",
            "deload_strategy": "Deload",
            "volume_distribution": "Balanceado",
            "tips": [],
        },
    }
    return SaveWorkoutRequest.model_validate(payload)


def count_microcycles(macrocycle: GeneratedMacrocycle) -> int:
    return sum(len(mesocycle.microcycles) for mesocycle in macrocycle.mesocycles)


def test_preview_enforces_single_microcycle_before_generator_call(monkeypatch) -> None:
    request = AIWorkoutRequest.model_validate(build_request_dict(4))
    session = FakeExerciseSession(build_exercises())
    current_user = SimpleNamespace(id=10)
    monkeypatch.setattr(ai_router, "_ensure_trainer_or_admin", lambda user: None)

    class FakeGenerator:
        async def generate_preview(self, request, exercise_list):
            assert request.program_duration.total_weeks == 1
            return AIWorkoutResponse(
                success=True,
                macrocycle=build_generated_macrocycle(1),
                explanation=ProgramExplanation(
                    rationale="Preview",
                    progression_strategy="N/A",
                    deload_strategy=None,
                    volume_distribution="N/A",
                    tips=[],
                ),
            )

    monkeypatch.setattr(ai_router, "AIWorkoutGenerator", FakeGenerator)

    response = asyncio.run(ai_router.preview_workout(request, db=session, current_user=current_user))

    assert response.success is True
    assert count_microcycles(response.macrocycle) == 1


def test_generate_keeps_requested_total_weeks_and_returns_full_macrocycle(monkeypatch) -> None:
    request = AIWorkoutRequest.model_validate(build_request_dict(3))
    session = FakeExerciseSession(build_exercises())
    current_user = SimpleNamespace(id=10)
    monkeypatch.setattr(ai_router, "_ensure_trainer_or_admin", lambda user: None)

    class FakeGenerator:
        async def generate_workout(self, request, exercise_list):
            assert request.program_duration.total_weeks == 3
            return AIWorkoutResponse(
                success=True,
                macrocycle=build_generated_macrocycle(3),
                generation_metadata=GenerationMetadata(generation_scope="full_standard"),
            )

    monkeypatch.setattr(ai_router, "AIWorkoutGenerator", FakeGenerator)

    response = asyncio.run(ai_router.generate_workout(request, db=session, current_user=current_user))

    assert response.success is True
    assert count_microcycles(response.macrocycle) == 3
    assert response.generation_metadata.generation_scope == "full_standard"


def test_service_uses_phased_route_for_four_plus_weeks(monkeypatch) -> None:
    request = AIWorkoutRequest.model_validate(build_request_dict(4))
    generator = object.__new__(ai_service.AIWorkoutGenerator)
    called = {}

    monkeypatch.setattr(ai_service.settings, "AI_USE_PROMPT_CACHING", True)
    monkeypatch.setattr(ai_service.settings, "AI_USE_PHASED_GENERATION", True)

    async def fake_phased(request, available_exercises, *, generation_scope, slot_catalog_result):
        called["scope"] = generation_scope
        return AIWorkoutResponse(success=True)

    async def fail(*args, **kwargs):
        raise AssertionError("Unexpected generation path")

    generator._build_slot_catalog_result = lambda request, exercises: SlotCatalogBuildResult(flat_catalog_exercises=exercises)
    generator._generate_phased = fake_phased
    generator._generate_structured_program = fail
    generator._generate_with_caching = fail
    generator._generate_legacy = fail

    response = asyncio.run(generator.generate_workout(request, [{"id": 1, "name": "Bench Press"}]))

    assert response.success is True
    assert called["scope"] == "full_phased"


def test_slot_candidate_catalog_and_prompt_use_candidate_groups() -> None:
    request = AIWorkoutRequest.model_validate(build_request_dict(3))
    exercise_catalog = [ai_router._serialize_exercise_for_ai(exercise).model_dump(mode="json") for exercise in build_exercises()]
    slot_catalog_result, slot_catalog_text = build_slot_candidate_catalog(exercise_catalog, request)

    cacheable, specific = assemble_optimized_program_prompt(
        request,
        exercise_catalog,
        generation_scope="full_standard",
        slot_catalog_result=slot_catalog_result,
    )

    assert slot_catalog_result.eligible is True
    assert "SLOT CANDIDATE GROUPS" in slot_catalog_text
    assert "SLOT CANDIDATE GROUPS" in cacheable
    assert "slot_role" in specific.lower()


def test_prompt_falls_back_to_flat_catalog_when_slot_groups_are_insufficient() -> None:
    request = AIWorkoutRequest.model_validate(build_request_dict(2))
    limited_exercises = [
        ai_router._serialize_exercise_for_ai(build_exercises()[0]).model_dump(mode="json"),
        ai_router._serialize_exercise_for_ai(build_exercises()[3]).model_dump(mode="json"),
    ]
    slot_catalog_result, _ = build_slot_candidate_catalog(limited_exercises, request)

    cacheable, _ = assemble_optimized_program_prompt(
        request,
        limited_exercises,
        generation_scope="full_standard",
        slot_catalog_result=slot_catalog_result,
    )

    assert slot_catalog_result.eligible is False
    assert "## CAT" in cacheable
    assert "SLOT CANDIDATE GROUPS" not in cacheable


def test_exercise_mapper_prefers_slot_candidate_group() -> None:
    exercise_catalog = [ai_router._serialize_exercise_for_ai(exercise).model_dump(mode="json") for exercise in build_exercises()]
    mapper = ExerciseMapper(exercise_catalog)
    macrocycle = {
        "mesocycles": [
            {
                "microcycles": [
                    {
                        "training_days": [
                            {
                                "focus": "chest",
                                "exercises": [
                                    {
                                        "exercise_id": "9999",
                                        "exercise_name": "Incline DB Press",
                                        "slot_role": "primary_horizontal_press",
                                        "slot_candidate_ids": [1, 2, 3],
                                    }
                                ],
                            }
                        ]
                    }
                ]
            }
        ]
    }

    mapped = mapper.map_exercises_in_program(macrocycle)
    exercise = mapped["mesocycles"][0]["microcycles"][0]["training_days"][0]["exercises"][0]

    assert exercise["exercise_id"] == 2
    assert exercise["exercise_name"] == "Incline DB Press"


def test_save_persists_more_than_one_microcycle(monkeypatch) -> None:
    save_request = build_save_request(3)
    session = SaveSession(build_exercises())
    current_user = SimpleNamespace(id=77)
    monkeypatch.setattr(ai_router, "_ensure_trainer_or_admin", lambda user: None)

    response = asyncio.run(ai_router.save_generated_workout(save_request, db=session, current_user=current_user))

    assert response["success"] is True
    assert session.committed is True
    persisted_microcycles = [obj for obj in session.added if isinstance(obj, Microcycle)]
    persisted_days = [obj for obj in session.added if isinstance(obj, TrainingDay)]
    persisted_day_exercises = [obj for obj in session.added if isinstance(obj, DayExercise)]
    assert len(persisted_microcycles) == 3
    assert len(persisted_days) == 3
    assert len(persisted_day_exercises) == 3


def test_response_models_accept_optional_generation_metadata() -> None:
    macrocycle = build_generated_macrocycle(1, with_slot_metadata=True)
    response_without_metadata = AIWorkoutResponse(success=True, macrocycle=macrocycle)
    response_with_metadata = AIWorkoutResponse(
        success=True,
        macrocycle=macrocycle,
        generation_metadata=GenerationMetadata(
            generation_scope="full_standard",
            used_slot_based_generation=True,
            progression_model="base_week_progression",
            template_version="slot_v1",
        ),
    )

    assert response_without_metadata.generation_metadata is None
    assert response_with_metadata.generation_metadata.used_slot_based_generation is True
