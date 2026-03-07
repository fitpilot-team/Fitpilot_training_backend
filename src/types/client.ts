import type {
  FitnessLevel,
  Gender,
  PrimaryGoal,
  MuscleGroupPreference,
  EquipmentType,
  InjuryArea,
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

  // Personal Information
  age?: number;
  gender?: Gender;
  occupation?: string;
  weight_kg?: number;
  height_cm?: number;
  training_experience_months?: number;

  // Training Profile
  experience_level: FitnessLevel;

  // Goals (structured)
  primary_goal?: PrimaryGoal;
  target_muscle_groups?: MuscleGroupPreference[];
  specific_goals_text?: string;

  // Availability (structured)
  days_per_week?: number;
  session_duration_minutes?: number;
  preferred_days?: number[];

  // Equipment (structured)
  has_gym_access?: boolean;
  available_equipment?: EquipmentType[];
  equipment_notes?: string;

  // Restrictions (structured)
  injury_areas?: InjuryArea[];
  injury_details?: string;
  excluded_exercises?: string[];
  medical_conditions?: string[];
  mobility_limitations?: string;

  // Additional Notes
  notes?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface ClientInterviewCreate {
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
  injury_areas?: InjuryArea[];
  injury_details?: string;
  excluded_exercises?: string[];
  medical_conditions?: string[];
  mobility_limitations?: string;
  notes?: string;
}

export type ClientInterviewUpdate = ClientInterviewCreate;
