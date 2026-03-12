import enum

from sqlalchemy import Boolean, Column, Date, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from models.base import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    TRAINER = "trainer"
    CLIENT = "client"
    INFLUENCER = "influencer"


def _db_user_role_values(_: type[UserRole]) -> list[str]:
    # Map python role enum to public.user_role_enum labels in Supabase.
    return ["ADMIN", "PROFESSIONAL", "CLIENT", "INFLUENCER"]


class ProfessionalRole(str, enum.Enum):
    NUTRITIONIST = "NUTRITIONIST"
    TRAINER = "TRAINER"


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    lastname = Column(String(200), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    email = Column(String(150), unique=True, index=True, nullable=True)
    password = Column(String(255), nullable=True)
    role = Column(
        Enum(
            UserRole,
            name="user_role_enum",
            schema="public",
            values_callable=_db_user_role_values,
        ),
        nullable=True,
        default=UserRole.CLIENT,
    )
    is_active = Column(Boolean, nullable=True, default=True)
    is_phone_verified = Column(Boolean, nullable=True, default=False)
    profile_picture = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    created_macrocycles = relationship(
        "Macrocycle",
        back_populates="trainer",
        foreign_keys="Macrocycle.trainer_id",
    )
    assigned_macrocycles = relationship(
        "Macrocycle",
        back_populates="client",
        foreign_keys="Macrocycle.client_id",
    )
    professional_roles = relationship(
        "UserProfessionalRole",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    @property
    def full_name(self) -> str:
        if self.lastname:
            return f"{self.name} {self.lastname}".strip()
        return self.name

    @full_name.setter
    def full_name(self, value: str) -> None:
        parts = (value or "").strip().split(maxsplit=1)
        self.name = parts[0] if parts else ""
        self.lastname = parts[1] if len(parts) > 1 else None

    @property
    def hashed_password(self) -> str | None:
        return self.password

    @hashed_password.setter
    def hashed_password(self, value: str | None) -> None:
        self.password = value

    @property
    def profile_image_url(self) -> str | None:
        return self.profile_picture

    @profile_image_url.setter
    def profile_image_url(self, value: str | None) -> None:
        self.profile_picture = value

    @property
    def preferred_language(self) -> str:
        return "es"

    @property
    def is_verified(self) -> bool:
        return bool(self.is_phone_verified)

    def __repr__(self):
        role = getattr(self.role, "value", self.role)
        return f"<User {self.email} ({role})>"


class UserProfessionalRole(Base):
    __tablename__ = "user_professional_roles"
    __table_args__ = {"schema": "public"}

    user_id = Column(Integer, ForeignKey("public.users.id"), primary_key=True)
    role = Column(
        Enum(ProfessionalRole, name="professional_role_enum", schema="public"),
        primary_key=True,
    )

    user = relationship("User", back_populates="professional_roles")
