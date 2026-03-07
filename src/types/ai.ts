// AI Workout Generator Types - Matching Backend Schemas

// =============== Enums ===============

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type PrimaryGoal = 'hypertrophy' | 'strength' | 'power' | 'endurance' | 'fat_loss' | 'general_fitness';
export type ExerciseVariety = 'low' | 'medium' | 'high';
export type MuscleGroupPreference = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';
export type EquipmentType =
  | 'barbell'
  | 'dumbbells'
  | 'cables'
  | 'machines'
  | 'kettlebells'
  | 'resistance_bands'
  | 'pull_up_bar'
  | 'bench'
  | 'squat_rack'
  | 'bodyweight';

export type InjuryArea =
  | 'shoulder'
  | 'knee'
  | 'lower_back'
  | 'upper_back'
  | 'hip'
  | 'ankle'
  | 'wrist'
  | 'elbow'
  | 'neck'
  | 'other';

export type CreationMode = 'template' | 'client';

// =============== Questionnaire Input Types ===============

export interface UserProfile {
  fitness_level: FitnessLevel;
  age?: number;
  weight_kg?: number;
  height_cm?: number;
  gender?: Gender;
  training_experience_months?: number;
}

export interface TrainingGoals {
  primary_goal: PrimaryGoal;
  specific_goals?: string[];
  target_muscle_groups?: MuscleGroupPreference[];
}

export interface Availability {
  days_per_week: number;
  session_duration_minutes: number;
  preferred_days?: number[];
}

export interface Equipment {
  has_gym_access: boolean;
  available_equipment: EquipmentType[];
  equipment_notes?: string;
}

export interface Restrictions {
  injuries?: string[];
  excluded_exercises?: string[];
  medical_conditions?: string[];
  mobility_limitations?: string;
}

export interface Preferences {
  exercise_variety?: ExerciseVariety;
  include_cardio?: boolean;
  include_warmup?: boolean;
  include_cooldown?: boolean;
  preferred_training_style?: string;
}

export interface ProgramDuration {
  total_weeks: number;
  mesocycle_weeks: number;
  include_deload: boolean;
  start_date: string; // ISO date string
}

// =============== Main Request Type ===============

export interface AIWorkoutRequest {
  user_profile: UserProfile;
  goals: TrainingGoals;
  availability: Availability;
  equipment: Equipment;
  restrictions?: Restrictions;
  preferences?: Preferences;
  program_duration: ProgramDuration;

  // Mode and identification
  creation_mode: CreationMode;
  client_id?: string; // Required if creation_mode='client'
  template_name?: string; // Required if creation_mode='template'
  additional_notes?: string;
}

// =============== Interview Validation Types ===============

export interface InterviewValidationResponse {
  is_complete: boolean;
  missing_fields: string[];
  has_interview: boolean;
  client_name?: string;
}

export interface InterviewDataResponse {
  client_id: string;
  client_name: string;
  user_profile: UserProfile;
  goals: TrainingGoals;
  availability: Availability;
  equipment: Equipment;
  restrictions?: Restrictions;
}

// =============== Generated Program Types ===============

export interface GeneratedDayExercise {
  exercise_id: string;
  exercise_name: string;
  order_index: number;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
  effort_type: 'RIR' | 'RPE' | 'percentage';
  effort_value: number;
  tempo?: string;
  notes?: string;
}

export interface GeneratedTrainingDay {
  day_number: number;
  name: string;
  focus: string;
  rest_day: boolean;
  exercises: GeneratedDayExercise[];
  warmup_notes?: string;
  cooldown_notes?: string;
}

export interface GeneratedMicrocycle {
  week_number: number;
  name: string;
  intensity_level: 'low' | 'medium' | 'high' | 'deload';
  training_days: GeneratedTrainingDay[];
  weekly_notes?: string;
}

export interface GeneratedMesocycle {
  block_number: number;
  name: string;
  focus: string;
  description?: string;
  microcycles: GeneratedMicrocycle[];
}

export interface GeneratedMacrocycle {
  name: string;
  description: string;
  objective: string;
  mesocycles: GeneratedMesocycle[];
}

export interface ProgramExplanation {
  rationale: string;
  progression_strategy: string;
  deload_strategy?: string;
  volume_distribution: string;
  tips: string[];
}

// =============== Response Types ===============

export interface AIWorkoutResponse {
  success: boolean;
  macrocycle?: GeneratedMacrocycle;
  explanation?: ProgramExplanation;
  warnings: string[];
  error?: string;
}

export interface SaveWorkoutResponse {
  success: boolean;
  macrocycle_id: string;
  message: string;
}

// =============== Questionnaire Config Types ===============

export interface QuestionnaireField {
  name: string;
  type: 'select' | 'multiselect' | 'number' | 'slider' | 'boolean' | 'textarea' | 'date';
  required: boolean;
  label: string;
  options?: Array<string | { value: string | number; label: string }>;
  min?: number;
  max?: number;
  default?: string | number | boolean;
  placeholder?: string;
}

export interface QuestionnaireStep {
  step_id: string;
  title: string;
  description: string;
  fields: QuestionnaireField[];
}

export interface QuestionnaireConfig {
  steps: QuestionnaireStep[];
  total_steps: number;
}

// =============== Store State Types ===============

export type QuestionnaireStepId =
  | 'profile'
  | 'goals'
  | 'availability'
  | 'equipment'
  | 'restrictions'
  | 'preferences';

export interface QuestionnaireAnswers {
  // Profile
  fitness_level?: FitnessLevel;
  age?: number;
  gender?: Gender;
  weight_kg?: number;
  height_cm?: number;
  training_experience_months?: number;

  // Goals
  primary_goal?: PrimaryGoal;
  specific_goals?: string;
  target_muscle_groups?: MuscleGroupPreference[];

  // Availability
  days_per_week?: number;
  session_duration_minutes?: number;
  preferred_days?: number[];

  // Equipment
  has_gym_access?: boolean;
  available_equipment?: EquipmentType[];
  equipment_notes?: string;

  // Restrictions
  injuries?: string;
  excluded_exercises?: string;
  medical_conditions?: string;
  mobility_limitations?: string;

  // Preferences
  exercise_variety?: ExerciseVariety;
  include_cardio?: boolean;
  include_warmup?: boolean;
  preferred_training_style?: string;

  // Duration
  total_weeks?: number;
  mesocycle_weeks?: number;
  include_deload?: boolean;
  start_date?: string;
}

export interface AIGeneratorState {
  // Mode state
  creationMode: CreationMode | null;
  selectedClientId: string | null;
  selectedClientName: string | null;
  templateName: string;

  // Questionnaire state
  currentStep: number;
  answers: QuestionnaireAnswers;
  config: QuestionnaireConfig | null;

  // Generation state
  isGenerating: boolean;
  generatedWorkout: AIWorkoutResponse | null;

  // Validation state
  isValidatingInterview: boolean;
  interviewValidation: InterviewValidationResponse | null;

  // UI state
  isSaving: boolean;

  // Error state
  error: string | null;
}
