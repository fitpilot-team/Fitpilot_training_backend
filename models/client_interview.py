import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
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


class ClientInterview(Base):
    __tablename__ = "client_interviews"
    __table_args__ = {"schema": "training"}

    # In shared schema, client_id is the PK for 1:1 interview mapping.
    client_id = Column(Integer, ForeignKey("public.users.id", ondelete="CASCADE"), primary_key=True)
    experience_level = Column(String(50), nullable=True)
    primary_goal = Column(String(100), nullable=True)
    days_available = Column(Integer, nullable=True)
    injuries = Column(Text, nullable=True)
    equipment_available = Column(ARRAY(String), nullable=True)
    created_at = Column(DateTime, nullable=True)

    client = relationship("User", backref="interview")

    def __repr__(self):
        return f"<ClientInterview client_id={self.client_id}>"
