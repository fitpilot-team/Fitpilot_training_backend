from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID

from models.base import Base


class PatientContextSnapshot(Base):
    __tablename__ = "patient_context_snapshots"
    __table_args__ = {"schema": "training"}

    id = Column(UUID(as_uuid=False), primary_key=True)
    client_id = Column(Integer, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(String, nullable=False, index=True)
    effective_at = Column(DateTime(timezone=True), nullable=False)
    source = Column(String(50), nullable=True)
    data = Column(JSONB, nullable=False)
    created_by = Column(Integer, ForeignKey("public.users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)

    def __repr__(self):
        return f"<PatientContextSnapshot client_id={self.client_id} version={self.version}>"
