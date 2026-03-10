import enum
from datetime import datetime
from typing import Iterable

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship

from models.base import Base


class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"


class ExperienceLevel(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class PrimaryGoal(str, enum.Enum):
    HYPERTROPHY = "hypertrophy"
    STRENGTH = "strength"
    POWER = "power"
    ENDURANCE = "endurance"
    FAT_LOSS = "fat_loss"
    GENERAL_FITNESS = "general_fitness"


class ExerciseVariety(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ClientInterview(Base):
    __tablename__ = "client_interviews"
    __table_args__ = {"schema": "training"}

    # Shared DB uses a 1:1 mapping between user and interview.
    client_id = Column(Integer, ForeignKey("public.users.id", ondelete="CASCADE"), primary_key=True)

    # Legacy columns kept for compatibility.
    days_available = Column(Integer, nullable=True)
    injuries = Column(Text, nullable=True)
    equipment_available = Column(ARRAY(String), nullable=True)

    # Personal/contact
    document_id = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(String(500), nullable=True)
    emergency_contact_name = Column(String(200), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)
    insurance_provider = Column(String(200), nullable=True)
    policy_number = Column(String(100), nullable=True)

    # Profile
    experience_level = Column(String(50), nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(50), nullable=True)
    occupation = Column(String(200), nullable=True)
    weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    training_experience_months = Column(Integer, nullable=True)

    # Goals
    primary_goal = Column(String(100), nullable=True)
    specific_goals_text = Column(String(500), nullable=True)
    target_muscle_groups = Column(ARRAY(String), nullable=True)

    # Availability
    days_per_week = Column(Integer, nullable=True)
    session_duration_minutes = Column(Integer, nullable=True)
    preferred_days = Column(ARRAY(Integer), nullable=True)

    # Equipment
    has_gym_access = Column(Boolean, nullable=True)
    available_equipment = Column(ARRAY(String), nullable=True)
    equipment_notes = Column(String(500), nullable=True)

    # Restrictions
    injury_areas = Column(ARRAY(String), nullable=True)
    injury_details = Column(Text, nullable=True)
    excluded_exercises = Column(ARRAY(String), nullable=True)
    medical_conditions = Column(ARRAY(String), nullable=True)
    mobility_limitations = Column(String(500), nullable=True)

    # Preferences
    exercise_variety = Column(String(20), nullable=True)
    include_cardio = Column(Boolean, nullable=True)
    include_warmup = Column(Boolean, nullable=True)
    include_cooldown = Column(Boolean, nullable=True)
    preferred_training_style = Column(String(200), nullable=True)

    # Extra notes
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=True, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("User", backref="interview")

    @property
    def id(self) -> str:
        # Keep response compatibility with interfaces expecting "id".
        return str(self.client_id)

    @staticmethod
    def _normalize_text(value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned if cleaned else None

    @staticmethod
    def _normalize_list(values: Iterable[str] | None) -> list[str]:
        if not values:
            return []
        normalized: list[str] = []
        seen: set[str] = set()
        for raw in values:
            if raw is None:
                continue
            item = str(raw).strip().lower()
            if not item or item in seen:
                continue
            normalized.append(item)
            seen.add(item)
        return normalized

    @staticmethod
    def _split_legacy_list(raw_text: str | None) -> list[str]:
        text = ClientInterview._normalize_text(raw_text)
        if not text:
            return []

        parts: list[str] = []
        for piece in text.replace(";", ",").split(","):
            cleaned = piece.strip()
            if cleaned:
                parts.append(cleaned.lower())
        return ClientInterview._normalize_list(parts)

    def get_days_per_week(self) -> int | None:
        return self.days_per_week or self.days_available

    def get_session_duration_minutes(self) -> int | None:
        return self.session_duration_minutes

    def get_available_equipment(self) -> list[str]:
        return self._normalize_list(self.available_equipment or self.equipment_available or [])

    def get_injury_areas(self) -> list[str]:
        areas = self._normalize_list(self.injury_areas or [])
        if areas:
            return areas
        return self._split_legacy_list(self.injuries)

    def get_injury_details(self) -> str | None:
        return self._normalize_text(self.injury_details) or self._normalize_text(self.injuries)

    def get_experience_level(self) -> str | None:
        return self._normalize_text(self.experience_level.lower() if self.experience_level else None)

    def get_primary_goal(self) -> str | None:
        return self._normalize_text(self.primary_goal.lower() if self.primary_goal else None)

    def get_has_gym_access(self) -> bool | None:
        if self.has_gym_access is not None:
            return self.has_gym_access

        equipment = self.get_available_equipment()
        if not equipment:
            return None
        return any(item != "bodyweight" for item in equipment)

    def is_complete_for_ai(self) -> tuple[bool, list[str]]:
        missing_fields: list[str] = []

        if not self.get_experience_level():
            missing_fields.append("experience_level")

        if not self.get_primary_goal():
            missing_fields.append("primary_goal")

        if not self.get_days_per_week():
            missing_fields.append("days_per_week")

        if not self.get_session_duration_minutes():
            missing_fields.append("session_duration_minutes")

        if self.get_has_gym_access() is None:
            missing_fields.append("has_gym_access")

        if not self.get_available_equipment():
            missing_fields.append("available_equipment")

        return len(missing_fields) == 0, missing_fields

    def __repr__(self):
        return f"<ClientInterview client_id={self.client_id}>"
