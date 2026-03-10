// Core Domain Types - Matching Backend Schemas

export type ExerciseType = 'multiarticular' | 'monoarticular';
export type ResistanceProfile = 'ascending' | 'descending' | 'flat' | 'bell_shaped';

// Exercise classification types
export type ExerciseClass =
  | 'strength'      // Ejercicios de fuerza (requieren músculos primarios)
  | 'cardio'        // Ejercicios cardiovasculares
  | 'plyometric'    // Ejercicios pliométricos/explosivos
  | 'flexibility'   // Estiramientos
  | 'mobility'      // Movilidad articular
  | 'warmup'        // Calentamiento
  | 'conditioning'  // Acondicionamiento metabólico
  | 'balance';      // Equilibrio y estabilidad

// Cardio sub-classification
export type CardioSubclass = 'liss' | 'hiit' | 'miss';

// Exercise phase within a training day
export type ExercisePhase = 'warmup' | 'main' | 'cooldown';

// Muscle names (16 muscles based on SVG mappings)
export type MuscleName =
  | 'chest'              // Pecho
  | 'upper_back'         // Trapecio
  | 'lats'               // Dorsales
  | 'lower_back'         // Espalda baja
  | 'anterior_deltoid'   // Deltoides anterior
  | 'posterior_deltoid'  // Deltoides posterior
  | 'biceps'             // Bíceps
  | 'triceps'            // Tríceps
  | 'forearms'           // Antebrazos
  | 'quadriceps'         // Cuádriceps
  | 'hamstrings'         // Isquiotibiales
  | 'glutes'             // Glúteos
  | 'calves'             // Pantorrillas
  | 'adductors'          // Aductores
  | 'abs'                // Abdominales
  | 'obliques'           // Oblicuos
  | 'tibialis';          // Tibial anterior

// Muscle categories for grouping
export type MuscleCategory = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';

// Body regions
export type BodyRegion = 'upper_body' | 'lower_body' | 'core';

// Muscle role in an exercise
export type MuscleRole = 'primary' | 'secondary';

// Muscle entity from the muscles table
export interface Muscle {
  id: string;
  name: MuscleName;
  display_name_es: string;
  display_name_en: string;
  body_region: BodyRegion;
  muscle_category: MuscleCategory;
  svg_ids: string[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Exercise-muscle relationship
export interface ExerciseMuscle {
  muscle_id: string;
  muscle_name: MuscleName;
  muscle_display_name: string;
  muscle_category: MuscleCategory;
  role: MuscleRole;
}

// Legacy type for backwards compatibility with existing components
export type MuscleGroup = MuscleName | MuscleCategory | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';
export type MesocycleStatus = 'draft' | 'active' | 'completed' | 'archived';
export type IntensityLevel = 'low' | 'medium' | 'high' | 'deload';
export type EffortType = 'RIR' | 'RPE' | 'percentage';

// Tempo types for exercise configuration
export type TempoType = 'controlled' | 'explosive' | 'tut' | 'standard' | 'pause_rep';

// Set types for exercise configuration
export type SetType = 'straight' | 'rest_pause' | 'drop_set' | 'top_set' | 'backoff' | 'myo_reps' | 'cluster';

// Exercise from exercise library
export interface Exercise {
  id: string;
  name_en: string;              // Nombre en inglés (principal, requerido)
  name_es?: string | null;      // Nombre en español
  type: ExerciseType;
  resistance_profile: ResistanceProfile;
  category: string;
  description_en?: string | null;  // Descripción en inglés
  description_es?: string | null;  // Descripción en español
  video_url: string | null;
  thumbnail_url: string | null;  // Movement pattern image (exercise being performed)
  image_url: string | null;  // Custom image uploaded by trainer
  anatomy_image_url: string | null;  // Anatomical image with highlighted muscles
  equipment_needed: string | null;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null;
  primary_muscles: ExerciseMuscle[];
  secondary_muscles: ExerciseMuscle[];
  created_at: string;
  updated_at: string;
  // Clasificación de ejercicio
  exercise_class: ExerciseClass;
  cardio_subclass?: CardioSubclass | null;
  // Campos específicos para cardio
  intensity_zone?: number | null;          // Zona de frecuencia cardíaca (1-5)
  target_heart_rate_min?: number | null;   // BPM mínimo objetivo
  target_heart_rate_max?: number | null;   // BPM máximo objetivo
  calories_per_minute?: number | null;     // Calorías quemadas por minuto
}

// Helper to get primary muscle group name (for backwards compatibility)
export function getPrimaryMuscleGroup(exercise: Exercise): MuscleName | null {
  return exercise.primary_muscles.length > 0 ? exercise.primary_muscles[0].muscle_name : null;
}

// Exercise instance in a training day
export interface DayExercise {
  id: string;
  training_day_id: string;
  exercise_id: string;
  exercise?: Exercise; // Populated when fetched with details
  order_index: number;
  phase: ExercisePhase;
  sets: number;

  // Campos para ejercicios de FUERZA
  reps_min: number | null;
  reps_max: number | null;
  rest_seconds: number;
  effort_type: EffortType;
  effort_value: number;
  tempo: string | null;  // Can be TempoType value or legacy tempo string
  set_type: SetType | null;  // Type of set (straight, drop_set, etc.)

  // Campos para ejercicios de CARDIO (LISS/MISS/HIIT)
  duration_seconds: number | null;  // Duración total en segundos
  intensity_zone: number | null;    // Zona de frecuencia cardíaca (1-5)
  distance_meters: number | null;   // Distancia objetivo en metros
  target_calories: number | null;   // Calorías objetivo

  // Campos específicos para HIIT
  intervals: number | null;              // Número de intervalos
  work_seconds: number | null;           // Duración del intervalo de trabajo
  interval_rest_seconds: number | null;  // Descanso entre intervalos

  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Single training day
export interface TrainingDay {
  id: string;
  microcycle_id: string;
  day_number: number;
  date: string; // ISO date string
  name: string;
  focus: string | null;
  rest_day: boolean;
  notes: string | null;
  exercises: DayExercise[];
  created_at: string;
  updated_at: string;
}

// Week-level structure (typically 1 week)
export interface Microcycle {
  id: string;
  mesocycle_id: string;
  week_number: number;
  name: string;
  start_date: string; // ISO date string
  end_date: string;   // ISO date string
  intensity_level: IntensityLevel;
  notes: string | null;
  training_days: TrainingDay[];
  created_at: string;
  updated_at: string;
}

// Training block within a macrocycle (typically 3-6 weeks)
export interface Mesocycle {
  id: string;
  macrocycle_id: string;
  block_number: number;
  name: string;
  description: string | null;
  start_date: string; // ISO date string
  end_date: string;   // ISO date string
  focus: string | null; // e.g., "Hypertrophy", "Strength", "Peaking"
  notes: string | null;
  microcycles: Microcycle[];
  created_at: string;
  updated_at: string;
}

// Complete multi-week program (the entire training plan)
// client_id = null means this is a template, not assigned to a specific client
export interface Macrocycle {
  id: string;
  name: string;
  description: string | null;
  objective: string;
  start_date: string; // ISO date string
  end_date: string;   // ISO date string
  client_id: string | null; // NULL = template
  trainer_id: string;
  status: MesocycleStatus;
  mesocycles: Mesocycle[];
  created_at: string;
  updated_at: string;
}

// Filter types for API requests
export interface ExerciseFilters {
  muscle_id?: string;
  muscle_category?: MuscleCategory;
  muscle_role?: MuscleRole;
  exercise_type?: ExerciseType;
  difficulty_level?: string;
  search?: string;
  skip?: number;
  limit?: number;
  // Clasificación de ejercicio
  exercise_class?: ExerciseClass;
  cardio_subclass?: CardioSubclass;
}

// Muscle list response
export interface MuscleListResponse {
  total: number;
  muscles: Muscle[];
}

export interface MacrocycleFilters {
  status?: MesocycleStatus;
  client_id?: string;
  skip?: number;
  limit?: number;
}
