// API Request and Response Types

export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface ApiError {
  detail: string | ValidationError[] | { message?: string; msg?: string };
  status?: number;
}

export interface PaginatedResponse<T> {
  total: number;
  items: T[];
}

// Auth Types
export interface LoginRequest {
  identifier: string;
  password: string;
  app_type?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  professional_role?: string[];
  exp: number;
  iat: number;
  [key: string]: any;
}

export interface ProfessionalContextType {
  professional: JWTPayload | null;
  userData: User | null;
  isLoading: boolean;
  error: string | null;
  requiresSubscriptionSelection: boolean;
  refreshProfessional: (forceRefresh?: boolean) => Promise<void>;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  role?: 'client' | 'trainer';
}

export type Language = 'es' | 'en';

export interface User {
  id: string | number;
  email: string;
  full_name?: string;
  name?: string;
  lastname?: string | null;
  username?: string | null;
  phone?: string;
  phone_number?: string | null;
  role: string;
  preferred_language?: Language;
  is_active?: boolean;
  email_verified?: boolean;
  is_phone_verified?: boolean;
  onboarding_status?: string | null;
  profile_picture?: string | null;
  professional_role?: string[];
  subscriptions?: Subscription[];
  current_subscription?: Subscription | null;
  has_subscription?: boolean;
  has_active_subscription?: boolean;
  subscription_vigency?: SubscriptionVigency | null;
  genre?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SubscriptionVigency {
  start_at?: string | null;
  end_at?: string | null;
  is_vigent?: boolean;
  days_remaining?: number | null;
}

export interface Subscription {
  id?: number | string;
  plan_id?: number | string;
  name?: string;
  code?: string;
  status?: string;
  cancel_at_period_end?: boolean;
  auto_renew?: boolean;
  current_period_start?: string | null;
  current_period_end?: string | null;
  trial_start?: string | null;
  trial_end?: string | null;
  canceled_at?: string | null;
  ended_at?: string | null;
  plan_details?: {
    id?: number | string;
    name?: string;
    price_monthly?: string | number | null;
    trial_days?: number | null;
    is_active?: boolean;
  } | null;
  plan?: string | {
    id?: number | string;
    name?: string;
    price_monthly?: string | number | null;
    trial_days?: number | null;
    is_active?: boolean;
  } | null;
  [key: string]: unknown;
}

export interface UserUpdate {
  full_name?: string;
  email?: string;
  password?: string;
  preferred_language?: Language;
}

// Exercise List Response
export interface ExerciseListResponse {
  total: number;
  exercises: Exercise[];
}

// Mesocycle List Response
export interface MacrocycleListResponse {
  total: number;
  macrocycles: Macrocycle[];
}

// Re-export from main types
import type { Exercise, Macrocycle } from './index';
