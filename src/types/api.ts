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
  email: string;
  password: string;
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
  refreshProfessional: () => Promise<void>;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  role?: 'client' | 'trainer';
}

export type Language = 'es' | 'en';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'trainer' | 'client';
  preferred_language: Language;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
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
