from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from models.base import Base


class ClientWorkoutAnalyticsPreference(Base):
    __tablename__ = "client_workout_analytics_preferences"
    __table_args__ = {"schema": "training"}

    client_id = Column(Integer, ForeignKey("public.users.id", ondelete="CASCADE"), primary_key=True)
    rep_ranges = Column(JSONB, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("User", foreign_keys=[client_id])

    def __repr__(self) -> str:
        return f"<ClientWorkoutAnalyticsPreference client_id={self.client_id}>"
