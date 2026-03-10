import enum

from sqlalchemy import BigInteger, Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from models.base import Base


class MetricType(str, enum.Enum):
    WEIGHT = "weight"
    HEIGHT = "height"
    BODY_FAT = "body_fat"
    MUSCLE_MASS = "muscle_mass"
    BODY_WATER = "body_water"
    BONE_MASS = "bone_mass"
    VISCERAL_FAT = "visceral_fat"
    BMI = "bmi"
    CHEST = "chest"
    WAIST = "waist"
    HIPS = "hips"
    ARMS = "arms"
    THIGHS = "thighs"
    NECK = "neck"
    CALF = "calf"
    SHOULDERS = "shoulders"
    FOREARM = "forearm"
    ABDOMINAL = "abdominal"
    UPPER_ARM = "upper_arm"
    LOWER_ARM = "lower_arm"
    RESTING_HR = "resting_hr"
    BLOOD_PRESSURE_SYS = "blood_pressure_sys"
    BLOOD_PRESSURE_DIA = "blood_pressure_dia"
    BMR = "bmr"
    TDEE = "tdee"
    TARGET_CALORIES = "target_calories"
    PROTEIN_INTAKE = "protein_intake"
    CARB_INTAKE = "carb_intake"
    FAT_INTAKE = "fat_intake"
    TRICEPS_SKINFOLD = "triceps_skinfold"
    SUBSCAPULAR_SKINFOLD = "subscapular_skinfold"
    SUPRAILIAC_SKINFOLD = "suprailiac_skinfold"
    ABDOMINAL_SKINFOLD = "abdominal_skinfold"
    THIGH_SKINFOLD = "thigh_skinfold"


class ClientMetric(Base):
    __tablename__ = "client_metrics"
    __table_args__ = {"schema": "training"}

    id = Column(BigInteger, primary_key=True)
    client_id = Column(Integer, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False, index=True)
    metric_type = Column(String(64), nullable=False)
    value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    date = Column(Date, nullable=False)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)

    client = relationship("User", backref="metrics")

    def __repr__(self):
        return f"<ClientMetric {self.metric_type}={self.value}{self.unit} client_id={self.client_id}>"
