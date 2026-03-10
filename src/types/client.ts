import type {
  FitnessLevel,
  Gender,
  PrimaryGoal,
  MuscleGroupPreference,
  EquipmentType,
  ExerciseVariety,
} from './ai';

export interface Client {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientCreate {
  email: string;
  full_name: string;
  password: string;
}

export interface ClientUpdate {
  full_name?: string;
  is_active?: boolean;
}

export interface ClientListResponse {
  clients: Client[];
  total: number;
}

// =============== Client Interview Types ===============

export interface ClientInterview {
  id: string;
  client_id: string;

  // Personal/contact
  document_id?: string;
  phone?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  insurance_provider?: string;
  policy_number?: string;

  // Profile
  age?: number;
  gender?: Gender;
  occupation?: string;
  weight_kg?: number;
  height_cm?: number;
  training_experience_months?: number;
  experience_level?: FitnessLevel;

  // Goals
  primary_goal?: PrimaryGoal;
  target_muscle_groups?: MuscleGroupPreference[];
  specific_goals_text?: string;

  // Availability
  days_per_week?: number;
  session_duration_minutes?: number;
  preferred_days?: number[];

  // Equipment
  has_gym_access?: boolean;
  available_equipment?: EquipmentType[];
  equipment_notes?: string;

  // Restrictions
  injury_areas?: string[];
  injury_details?: string;
  excluded_exercises?: string[];
  medical_conditions?: string[];
  mobility_limitations?: string;

  // Preferences
  exercise_variety?: ExerciseVariety;
  include_cardio?: boolean;
  include_warmup?: boolean;
  include_cooldown?: boolean;
  preferred_training_style?: string;

  // Legacy
  days_available?: number;
  injuries?: string;
  equipment_available?: string[];

  // Additional notes
  notes?: string;

  created_at?: string;
  updated_at?: string;
}

export interface ClientInterviewCreate {
  document_id?: string;
  phone?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  insurance_provider?: string;
  policy_number?: string;
  age?: number;
  gender?: Gender;
  occupation?: string;
  weight_kg?: number;
  height_cm?: number;
  training_experience_months?: number;
  experience_level?: FitnessLevel;
  primary_goal?: PrimaryGoal;
  target_muscle_groups?: MuscleGroupPreference[];
  specific_goals_text?: string;
  days_per_week?: number;
  session_duration_minutes?: number;
  preferred_days?: number[];
  has_gym_access?: boolean;
  available_equipment?: EquipmentType[];
  equipment_notes?: string;
  injury_areas?: string[];
  injury_details?: string;
  excluded_exercises?: string[];
  medical_conditions?: string[];
  mobility_limitations?: string;
  exercise_variety?: ExerciseVariety;
  include_cardio?: boolean;
  include_warmup?: boolean;
  include_cooldown?: boolean;
  preferred_training_style?: string;
  days_available?: number;
  injuries?: string;
  equipment_available?: string[];
  notes?: string;
}

export type ClientInterviewUpdate = ClientInterviewCreate;
