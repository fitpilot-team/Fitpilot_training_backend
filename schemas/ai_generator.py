from pydantic import BaseModel, ConfigDict, Field
from datetime import date
from typing import Optional, List, Literal
from enum import Enum


# =============== Enums para el Cuestionario ===============

class FitnessLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class PrimaryGoal(str, Enum):
    HYPERTROPHY = "hypertrophy"
    STRENGTH = "strength"
    POWER = "power"
    ENDURANCE = "endurance"
    FAT_LOSS = "fat_loss"
    GENERAL_FITNESS = "general_fitness"


class ExerciseVariety(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class MuscleGroupPreference(str, Enum):
    CHEST = "chest"
    BACK = "back"
    SHOULDERS = "shoulders"
    ARMS = "arms"
    LEGS = "legs"
    CORE = "core"


class EquipmentType(str, Enum):
    BARBELL = "barbell"
    DUMBBELLS = "dumbbells"
    CABLES = "cables"
    MACHINES = "machines"
    KETTLEBELLS = "kettlebells"
    RESISTANCE_BANDS = "resistance_bands"
    PULL_UP_BAR = "pull_up_bar"
    BENCH = "bench"
    SQUAT_RACK = "squat_rack"
    BODYWEIGHT = "bodyweight"


# =============== Schemas del Cuestionario ===============

class UserProfile(BaseModel):
    """Perfil básico del usuario"""
    fitness_level: FitnessLevel
    age: Optional[int] = Field(None, ge=14, le=100, description="Edad del usuario")
    weight_kg: Optional[float] = Field(None, ge=30, le=300, description="Peso en kilogramos")
    height_cm: Optional[float] = Field(None, ge=100, le=250, description="Altura en centímetros")
    gender: Optional[Gender] = None
    training_experience_months: Optional[int] = Field(
        None, ge=0, le=600,
        description="Meses de experiencia entrenando"
    )


class TrainingGoals(BaseModel):
    """Objetivos de entrenamiento"""
    primary_goal: PrimaryGoal
    specific_goals: Optional[List[str]] = Field(
        default=[],
        max_length=5,
        description="Objetivos específicos adicionales (ej: 'aumentar press banca', 'mejorar postura')"
    )
    target_muscle_groups: Optional[List[MuscleGroupPreference]] = Field(
        default=[],
        description="Grupos musculares que quiere enfatizar"
    )


class Availability(BaseModel):
    """Disponibilidad para entrenar"""
    days_per_week: int = Field(ge=1, le=7, description="Días disponibles por semana")
    session_duration_minutes: int = Field(
        ge=20, le=180,
        description="Duración de cada sesión en minutos"
    )
    preferred_days: Optional[List[int]] = Field(
        default=[],
        description="Días preferidos (1=Lunes, 7=Domingo)"
    )


class Equipment(BaseModel):
    """Equipamiento disponible"""
    has_gym_access: bool = Field(description="¿Tiene acceso a un gimnasio?")
    available_equipment: List[EquipmentType] = Field(
        default=[EquipmentType.BODYWEIGHT],
        description="Equipamiento disponible"
    )
    equipment_notes: Optional[str] = Field(
        None, max_length=500,
        description="Notas adicionales sobre equipamiento"
    )


class Restrictions(BaseModel):
    """Restricciones y limitaciones"""
    injuries: Optional[List[str]] = Field(
        default=[],
        max_length=10,
        description="Lesiones actuales o pasadas"
    )
    excluded_exercises: Optional[List[str]] = Field(
        default=[],
        max_length=20,
        description="Ejercicios que desea evitar"
    )
    medical_conditions: Optional[List[str]] = Field(
        default=[],
        max_length=10,
        description="Condiciones médicas relevantes"
    )
    mobility_limitations: Optional[str] = Field(
        None, max_length=500,
        description="Limitaciones de movilidad"
    )


class Preferences(BaseModel):
    """Preferencias de entrenamiento"""
    exercise_variety: ExerciseVariety = Field(
        default=ExerciseVariety.MEDIUM,
        description="Nivel de variedad deseada en ejercicios"
    )
    include_cardio: bool = Field(
        default=False,
        description="¿Incluir cardio en el programa?"
    )
    include_warmup: bool = Field(
        default=True,
        description="¿Incluir calentamiento?"
    )
    include_cooldown: bool = Field(
        default=False,
        description="¿Incluir enfriamiento?"
    )
    preferred_training_style: Optional[str] = Field(
        None, max_length=200,
        description="Estilo de entrenamiento preferido (ej: 'push/pull/legs', 'full body')"
    )


class ProgramDuration(BaseModel):
    """Duración del programa"""
    total_weeks: int = Field(ge=1, le=52, description="Duración total en semanas")
    mesocycle_weeks: int = Field(
        default=4, ge=1, le=8,
        description="Duración de cada mesociclo en semanas"
    )
    include_deload: bool = Field(
        default=True,
        description="¿Incluir semanas de descarga?"
    )
    start_date: date = Field(description="Fecha de inicio del programa")


# =============== Request Principal ===============

class CreationMode(str, Enum):
    TEMPLATE = "template"
    CLIENT = "client"


class AIWorkoutRequest(BaseModel):
    """Request completo para generar un programa de entrenamiento"""
    user_profile: UserProfile
    goals: TrainingGoals
    availability: Availability
    equipment: Equipment
    restrictions: Optional[Restrictions] = None
    preferences: Optional[Preferences] = None
    program_duration: ProgramDuration

    # Modo de creación
    creation_mode: CreationMode = Field(
        default=CreationMode.CLIENT,
        description="Modo de creación: 'template' para plantilla, 'client' para programa de cliente"
    )

    # ID del cliente (opcional, requerido solo si creation_mode='client')
    client_id: Optional[str] = Field(
        None,
        description="ID del cliente. Requerido si creation_mode='client', null para plantillas"
    )

    # Nombre de plantilla (solo si creation_mode='template')
    template_name: Optional[str] = Field(
        None, max_length=200,
        description="Nombre de la plantilla. Requerido si creation_mode='template'"
    )

    additional_notes: Optional[str] = Field(
        None, max_length=1000,
        description="Notas adicionales para la generación"
    )

    # Contexto clínico/paciente opcional para enriquecer la generación
    patient_context: Optional["PatientContext"] = Field(
        default=None,
        description="Contexto completo del paciente (antropometría, clínica, estilo de vida)"
    )
    context_version: Optional[str] = Field(
        default=None,
        description="Versión del contexto usada para trazabilidad"
    )


# =============== Interview Preload Response ===============

class InterviewDataResponse(BaseModel):
    client_id: str
    client_name: str
    user_profile: UserProfile
    goals: TrainingGoals
    availability: Availability
    equipment: Equipment
    restrictions: Optional[Restrictions] = None
    preferences: Optional[Preferences] = None


class ExerciseCatalogItem(BaseModel):
    """Ejercicio serializado para el prompt del generador IA."""

    id: int
    name: str
    type: str = "multiarticular"
    category: Optional[str] = None
    primary_muscles: List[str] = Field(default_factory=list)
    secondary_muscles: List[str] = Field(default_factory=list)
    difficulty_level: Optional[str] = None
    equipment_needed: Optional[str] = None
    resistance_profile: Optional[str] = None
    exercise_class: str = "strength"
    cardio_subclass: Optional[str] = None
    intensity_zone: Optional[int] = None
    target_heart_rate_min: Optional[int] = None
    target_heart_rate_max: Optional[int] = None
    calories_per_minute: Optional[float] = None

# =============== Schemas de Respuesta Generada ===============

class ExerciseClassType(str, Enum):
    """Clasificación principal del ejercicio"""
    STRENGTH = "strength"
    CARDIO = "cardio"
    PLYOMETRIC = "plyometric"
    FLEXIBILITY = "flexibility"
    MOBILITY = "mobility"
    WARMUP = "warmup"
    CONDITIONING = "conditioning"
    BALANCE = "balance"


class CardioSubclassType(str, Enum):
    """Sub-clasificación para ejercicios de cardio"""
    LISS = "liss"  # Low Intensity Steady State
    HIIT = "hiit"  # High Intensity Interval Training
    MISS = "miss"  # Moderate Intensity Steady State


class ExercisePhaseType(str, Enum):
    """Fase del ejercicio dentro del día"""
    WARMUP = "warmup"
    MAIN = "main"
    COOLDOWN = "cooldown"


class GeneratedDayExercise(BaseModel):
    """Ejercicio generado para un día"""
    exercise_id: str = Field(description="ID del ejercicio de la biblioteca")
    exercise_name: str = Field(description="Nombre del ejercicio (para referencia)")
    order_index: int = Field(ge=0)
    sets: int = Field(ge=1, le=10)
    phase: ExercisePhaseType = Field(
        default=ExercisePhaseType.MAIN,
        description="Fase: warmup/main/cooldown"
    )

    # Clasificación del ejercicio
    exercise_class: Optional[ExerciseClassType] = Field(
        default=ExerciseClassType.STRENGTH,
        description="Clase de ejercicio (strength, cardio, plyometric, etc.)"
    )
    cardio_subclass: Optional[CardioSubclassType] = Field(
        None,
        description="Sub-clase para cardio (liss, hiit, miss)"
    )
    intensity_zone: Optional[int] = Field(
        None,
        ge=1,
        le=5,
        description="Zona de frecuencia cardíaca (1-5) para cardio"
    )

    # Reps son opcionales para ejercicios basados en tiempo
    reps_min: Optional[int] = Field(None, ge=1, le=100)
    reps_max: Optional[int] = Field(None, ge=1, le=100)
    # Duración para ejercicios de cardio/isométricos (en segundos)
    duration_seconds: Optional[int] = Field(None, ge=10, le=3600, description="Duración en segundos para cardio/isométricos")
    rest_seconds: int = Field(ge=0, le=300)  # 0 permitido para cardio continuo
    effort_type: Literal["RIR", "RPE", "percentage"] = "RIR"
    effort_value: float = Field(ge=0, le=10)
    tempo: Optional[str] = None
    notes: Optional[str] = None
    slot_role: Optional[str] = Field(
        default=None,
        description="Rol funcional interno del ejercicio cuando se usa generacion por slots"
    )
    slot_candidate_ids: Optional[List[int]] = Field(
        default=None,
        description="IDs candidatos considerados para este slot; opcional y no breaking"
    )


class GeneratedTrainingDay(BaseModel):
    """Día de entrenamiento generado"""
    day_number: int = Field(ge=1, le=14, description="Día del microciclo (1-14 para microciclos extendidos)")
    name: str
    focus: str
    rest_day: bool = False
    exercises: List[GeneratedDayExercise] = []
    warmup_notes: Optional[str] = None
    cooldown_notes: Optional[str] = None


class GeneratedMicrocycle(BaseModel):
    """Semana generada"""
    week_number: int = Field(ge=1)
    name: str
    intensity_level: Literal["low", "medium", "high", "deload"]
    training_days: List[GeneratedTrainingDay] = []
    weekly_notes: Optional[str] = None


class GeneratedMesocycle(BaseModel):
    """Bloque de entrenamiento generado"""
    block_number: int = Field(ge=1)
    name: str
    focus: str
    description: Optional[str] = None
    microcycles: List[GeneratedMicrocycle] = []


class GeneratedMacrocycle(BaseModel):
    """Programa completo generado"""
    name: str
    description: str
    objective: str
    mesocycles: List[GeneratedMesocycle] = []


class ProgramExplanation(BaseModel):
    """Explicación del programa generado"""
    rationale: str = Field(description="Por qué se diseñó este programa así")
    progression_strategy: str = Field(description="Estrategia de progresión")
    deload_strategy: Optional[str] = Field(None, description="Estrategia de descarga")
    volume_distribution: str = Field(description="Distribución del volumen")
    tips: List[str] = Field(default=[], description="Consejos adicionales")


# =============== Patient Context Schemas ===============

class PatientIdentity(BaseModel):
    full_name: Optional[str] = None
    document_id: Optional[str] = None
    dob: Optional[date] = None
    sex: Optional[str] = Field(None, description="male/female/other")
    gender: Optional[str] = None


class PatientContact(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    address: Optional[str] = None


class AnthropometricPoint(BaseModel):
    date: date
    value: float


class Anthropometrics(BaseModel):
    latest: Optional[dict] = Field(
        default=None,
        description="Valores antropométricos más recientes normalizados"
    )
    trend: Optional[dict] = Field(
        default=None,
        description="Tendencias por métrica [{date, value}]"
    )


class MedicalConditionItem(BaseModel):
    name: str
    status: Optional[str] = None
    onset_date: Optional[date] = None
    notes: Optional[str] = None


class MedicationItem(BaseModel):
    name: str
    dose: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    active: Optional[bool] = None
    notes: Optional[str] = None


class AllergyItem(BaseModel):
    substance: str
    reaction: Optional[str] = None
    severity: Optional[str] = None


class PatientMedicalHistory(BaseModel):
    conditions: List[MedicalConditionItem] = []
    medications: List[MedicationItem] = []
    allergies: List[AllergyItem] = []
    contraindications: List[str] = []


class PatientInjury(BaseModel):
    area: str
    status: Optional[str] = None
    notes: Optional[str] = None


class PatientLifestyle(BaseModel):
    sleep_hours: Optional[float] = None
    stress_level: Optional[str] = None
    activity_outside_gym: Optional[str] = None
    diet_pattern: Optional[str] = None
    alcohol: Optional[str] = None
    tobacco: Optional[str] = None
    steps_per_day: Optional[int] = None
    occupation: Optional[str] = None


class PatientPreferences(BaseModel):
    training_style: Optional[str] = None
    avoid_exercises: List[str] = []
    environment: Optional[str] = None


class PatientConstraints(BaseModel):
    session_time_min: Optional[int] = None
    days_per_week: Optional[int] = None
    equipment: List[str] = []
    mobility_limitations: Optional[str] = None
    notes: Optional[str] = None


class PatientContext(BaseModel):
    """Contexto extendido del paciente para IA/chatbot."""
    identity: Optional[PatientIdentity] = None
    contact: Optional[PatientContact] = None
    anthropometrics: Optional[Anthropometrics] = None
    medical_history: Optional[PatientMedicalHistory] = None
    injuries: List[PatientInjury] = []
    lifestyle: Optional[PatientLifestyle] = None
    preferences: Optional[PatientPreferences] = None
    constraints: Optional[PatientConstraints] = None
    goals: Optional[List[str]] = None
    context_version: Optional[str] = None


# Reconstruir modelos con referencias adelantadas
# Nota: SaveWorkoutRequest.model_rebuild() se llama después de su definición


# =============== Response Principal ===============

class GenerationMetadata(BaseModel):
    """Metadata no breaking para debug y observabilidad de la generacion IA."""

    generation_scope: Optional[Literal["preview", "full_short", "full_standard", "full_phased"]] = None
    used_slot_based_generation: bool = False
    used_phased_generation: bool = False
    progression_model: Optional[str] = None
    template_version: Optional[str] = None
    candidate_group_count: Optional[int] = None
    flat_catalog_size: Optional[int] = None
    slot_candidate_count: Optional[int] = None

    model_config = ConfigDict(extra="ignore")

class AIWorkoutResponse(BaseModel):
    """Respuesta completa de la generación"""
    success: bool
    macrocycle: Optional[GeneratedMacrocycle] = None
    explanation: Optional[ProgramExplanation] = None
    generation_metadata: Optional[GenerationMetadata] = None
    warnings: List[str] = Field(default=[], description="Advertencias sobre el programa")
    error: Optional[str] = None


# =============== Schemas Auxiliares ===============

class QuestionnaireStep(BaseModel):
    """Configuración de un paso del cuestionario"""
    step_id: str
    title: str
    description: str
    fields: List[dict]


class QuestionnaireConfig(BaseModel):
    """Configuración completa del cuestionario"""
    steps: List[QuestionnaireStep]
    total_steps: int


class GenerationStatus(BaseModel):
    """Estado de una generación en progreso"""
    status: Literal["pending", "processing", "completed", "failed"]
    progress: int = Field(ge=0, le=100)
    message: Optional[str] = None
    result: Optional[AIWorkoutResponse] = None


class WorkoutData(BaseModel):
    """Datos del programa generado para guardar"""
    macrocycle: GeneratedMacrocycle
    explanation: Optional[ProgramExplanation] = None


class SaveWorkoutRequest(AIWorkoutRequest):
    """Request para guardar un programa generado - extiende AIWorkoutRequest"""
    workout_data: WorkoutData


# Rebuild models with forward references after all classes are defined
AIWorkoutRequest.model_rebuild()
SaveWorkoutRequest.model_rebuild()

