"""
Service for mapping ClientInterview data to AI Generator request format.
"""

from typing import Any, Dict, Optional

from models.client_interview import ClientInterview
from schemas.ai_generator import (
    Availability,
    Equipment,
    EquipmentType,
    ExerciseVariety,
    FitnessLevel,
    Gender,
    MuscleGroupPreference,
    Preferences,
    PrimaryGoal,
    Restrictions,
    TrainingGoals,
    UserProfile,
)


class InterviewToAIRequestMapper:
    """Maps ClientInterview data to the format required by AIWorkoutRequest."""

    @staticmethod
    def _normalize_text(value: Any) -> str | None:
        if value is None:
            return None
        if hasattr(value, "value"):
            value = getattr(value, "value")
        cleaned = str(value).strip()
        return cleaned or None

    @classmethod
    def _normalize_lower(cls, value: Any) -> str | None:
        text = cls._normalize_text(value)
        return text.lower() if text else None

    @staticmethod
    def _normalize_list(value: Any) -> list[str]:
        if value is None:
            return []

        if isinstance(value, str):
            raw_items = [part.strip() for part in value.replace(";", ",").split(",")]
        elif isinstance(value, (list, tuple, set)):
            raw_items = [str(item).strip() for item in value]
        else:
            return []

        normalized: list[str] = []
        seen: set[str] = set()
        for raw in raw_items:
            if not raw:
                continue
            lowered = raw.lower()
            if lowered in seen:
                continue
            normalized.append(lowered)
            seen.add(lowered)
        return normalized

    @staticmethod
    def map_experience_to_fitness_level(experience_level: str | None) -> FitnessLevel:
        mapping = {
            "beginner": FitnessLevel.BEGINNER,
            "intermediate": FitnessLevel.INTERMEDIATE,
            "advanced": FitnessLevel.ADVANCED,
        }
        return mapping.get((experience_level or "").lower(), FitnessLevel.BEGINNER)

    @staticmethod
    def map_gender(gender: str | None) -> Optional[Gender]:
        if not gender:
            return None
        mapping = {
            "male": Gender.MALE,
            "female": Gender.FEMALE,
            "other": Gender.OTHER,
        }
        return mapping.get(gender.lower())

    @staticmethod
    def map_primary_goal(goal: str | None) -> PrimaryGoal:
        mapping = {
            "hypertrophy": PrimaryGoal.HYPERTROPHY,
            "strength": PrimaryGoal.STRENGTH,
            "power": PrimaryGoal.POWER,
            "endurance": PrimaryGoal.ENDURANCE,
            "fat_loss": PrimaryGoal.FAT_LOSS,
            "general_fitness": PrimaryGoal.GENERAL_FITNESS,
        }
        return mapping.get((goal or "").lower(), PrimaryGoal.GENERAL_FITNESS)

    @staticmethod
    def map_muscle_groups(groups: list[str]) -> list[MuscleGroupPreference]:
        mapping = {
            "chest": MuscleGroupPreference.CHEST,
            "back": MuscleGroupPreference.BACK,
            "shoulders": MuscleGroupPreference.SHOULDERS,
            "biceps": MuscleGroupPreference.ARMS,
            "triceps": MuscleGroupPreference.ARMS,
            "arms": MuscleGroupPreference.ARMS,
            "legs": MuscleGroupPreference.LEGS,
            "glutes": MuscleGroupPreference.LEGS,
            "core": MuscleGroupPreference.CORE,
        }
        result: list[MuscleGroupPreference] = []
        seen: set[MuscleGroupPreference] = set()
        for group in groups:
            mapped = mapping.get(group.lower())
            if mapped and mapped not in seen:
                result.append(mapped)
                seen.add(mapped)
        return result

    @staticmethod
    def map_equipment(equipment_list: list[str]) -> list[EquipmentType]:
        if not equipment_list:
            return [EquipmentType.BODYWEIGHT]

        mapping = {
            "barbell": EquipmentType.BARBELL,
            "dumbbells": EquipmentType.DUMBBELLS,
            "cables": EquipmentType.CABLES,
            "machines": EquipmentType.MACHINES,
            "kettlebells": EquipmentType.KETTLEBELLS,
            "resistance_bands": EquipmentType.RESISTANCE_BANDS,
            "pull_up_bar": EquipmentType.PULL_UP_BAR,
            "bench": EquipmentType.BENCH,
            "squat_rack": EquipmentType.SQUAT_RACK,
            "bodyweight": EquipmentType.BODYWEIGHT,
        }

        mapped_values: list[EquipmentType] = []
        seen: set[EquipmentType] = set()
        for equipment in equipment_list:
            mapped = mapping.get(equipment.lower())
            if mapped and mapped not in seen:
                mapped_values.append(mapped)
                seen.add(mapped)

        return mapped_values or [EquipmentType.BODYWEIGHT]

    @staticmethod
    def map_exercise_variety(value: str | None) -> ExerciseVariety:
        mapping = {
            "low": ExerciseVariety.LOW,
            "medium": ExerciseVariety.MEDIUM,
            "high": ExerciseVariety.HIGH,
        }
        return mapping.get((value or "").lower(), ExerciseVariety.MEDIUM)

    @classmethod
    def _get_days_per_week(cls, interview: ClientInterview) -> int:
        if hasattr(interview, "get_days_per_week"):
            value = interview.get_days_per_week()
        else:
            value = interview.days_per_week or interview.days_available
        return value or 3

    @classmethod
    def _get_session_duration(cls, interview: ClientInterview) -> int:
        if hasattr(interview, "get_session_duration_minutes"):
            value = interview.get_session_duration_minutes()
        else:
            value = interview.session_duration_minutes
        return value or 60

    @classmethod
    def _get_available_equipment(cls, interview: ClientInterview) -> list[str]:
        if hasattr(interview, "get_available_equipment"):
            return interview.get_available_equipment() or []
        return cls._normalize_list(interview.available_equipment or interview.equipment_available)

    @classmethod
    def _get_injury_areas(cls, interview: ClientInterview) -> list[str]:
        if hasattr(interview, "get_injury_areas"):
            return interview.get_injury_areas() or []
        return cls._normalize_list(interview.injury_areas)

    @classmethod
    def _get_injury_details(cls, interview: ClientInterview) -> str | None:
        if hasattr(interview, "get_injury_details"):
            return interview.get_injury_details()
        return cls._normalize_text(interview.injury_details or interview.injuries)

    @classmethod
    def _get_has_gym_access(cls, interview: ClientInterview) -> bool:
        if hasattr(interview, "get_has_gym_access"):
            inferred = interview.get_has_gym_access()
        else:
            inferred = interview.has_gym_access

        if inferred is not None:
            return bool(inferred)

        equipment = cls._get_available_equipment(interview)
        return any(item != "bodyweight" for item in equipment)

    @classmethod
    def build_user_profile(cls, interview: ClientInterview) -> UserProfile:
        experience_level = (
            interview.get_experience_level() if hasattr(interview, "get_experience_level") else cls._normalize_lower(interview.experience_level)
        )

        gender = cls._normalize_lower(interview.gender)

        return UserProfile(
            fitness_level=cls.map_experience_to_fitness_level(experience_level),
            age=interview.age,
            weight_kg=interview.weight_kg,
            height_cm=interview.height_cm,
            gender=cls.map_gender(gender),
            training_experience_months=interview.training_experience_months,
        )

    @classmethod
    def build_training_goals(cls, interview: ClientInterview) -> TrainingGoals:
        primary_goal = interview.get_primary_goal() if hasattr(interview, "get_primary_goal") else cls._normalize_lower(interview.primary_goal)
        target_groups = cls._normalize_list(interview.target_muscle_groups)

        specific_goals: list[str] = []
        if interview.specific_goals_text:
            specific_goals = [interview.specific_goals_text]

        return TrainingGoals(
            primary_goal=cls.map_primary_goal(primary_goal),
            specific_goals=specific_goals,
            target_muscle_groups=cls.map_muscle_groups(target_groups),
        )

    @classmethod
    def build_availability(cls, interview: ClientInterview) -> Availability:
        preferred_days = []
        if interview.preferred_days:
            preferred_days = sorted(
                {int(day) for day in interview.preferred_days if isinstance(day, int) and 1 <= day <= 7}
            )

        return Availability(
            days_per_week=cls._get_days_per_week(interview),
            session_duration_minutes=cls._get_session_duration(interview),
            preferred_days=preferred_days,
        )

    @classmethod
    def build_equipment(cls, interview: ClientInterview) -> Equipment:
        return Equipment(
            has_gym_access=cls._get_has_gym_access(interview),
            available_equipment=cls.map_equipment(cls._get_available_equipment(interview)),
            equipment_notes=interview.equipment_notes,
        )

    @classmethod
    def build_restrictions(cls, interview: ClientInterview) -> Optional[Restrictions]:
        injuries = cls._get_injury_areas(interview)
        injury_details = cls._get_injury_details(interview)

        injury_messages: list[str] = [f"injury_{area}" for area in injuries]
        if injury_details:
            injury_messages.append(injury_details)

        excluded_exercises = cls._normalize_list(interview.excluded_exercises)
        medical_conditions = cls._normalize_list(interview.medical_conditions)
        mobility_limitations = cls._normalize_text(interview.mobility_limitations)

        if not injury_messages and not excluded_exercises and not medical_conditions and not mobility_limitations:
            return None

        return Restrictions(
            injuries=injury_messages,
            excluded_exercises=excluded_exercises,
            medical_conditions=medical_conditions,
            mobility_limitations=mobility_limitations,
        )

    @classmethod
    def build_preferences(cls, interview: ClientInterview) -> Preferences:
        return Preferences(
            exercise_variety=cls.map_exercise_variety(cls._normalize_lower(interview.exercise_variety)),
            include_cardio=bool(interview.include_cardio) if interview.include_cardio is not None else False,
            include_warmup=bool(interview.include_warmup) if interview.include_warmup is not None else True,
            include_cooldown=bool(interview.include_cooldown) if interview.include_cooldown is not None else False,
            preferred_training_style=cls._normalize_text(interview.preferred_training_style),
        )

    @classmethod
    def map_interview_to_ai_sections(cls, interview: ClientInterview) -> Dict[str, Any]:
        return {
            "user_profile": cls.build_user_profile(interview),
            "goals": cls.build_training_goals(interview),
            "availability": cls.build_availability(interview),
            "equipment": cls.build_equipment(interview),
            "restrictions": cls.build_restrictions(interview),
            "preferences": cls.build_preferences(interview),
        }

    @classmethod
    def validate_interview_for_ai(cls, interview: Optional[ClientInterview]) -> Dict[str, Any]:
        if not interview:
            return {
                "is_complete": False,
                "missing_fields": ["No existe entrevista para este cliente"],
                "has_interview": False,
            }

        is_complete, missing_fields = interview.is_complete_for_ai()

        field_translations = {
            "experience_level": "Nivel de experiencia",
            "primary_goal": "Objetivo principal",
            "days_per_week": "Dias por semana",
            "session_duration_minutes": "Duracion de sesion",
            "has_gym_access": "Acceso a gimnasio",
            "available_equipment": "Equipamiento disponible",
        }

        translated_missing = [field_translations.get(field, field) for field in missing_fields]

        return {
            "is_complete": is_complete,
            "missing_fields": translated_missing,
            "has_interview": True,
        }
