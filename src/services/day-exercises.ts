import { apiClient } from './api';
import type { DayExercise } from '../types';

export type EffortType = 'RIR' | 'RPE' | 'percentage';

export interface DayExerciseCreateData {
  exercise_id: string;
  order_index: number;
  sets: number;
  // Campos de fuerza (opcionales para cardio)
  reps_min?: number | null;
  reps_max?: number | null;
  rest_seconds: number;
  effort_type: EffortType;
  effort_value: number;
  tempo?: string | null;
  set_type?: string | null;
  notes?: string;
  // Campos de cardio
  duration_seconds?: number | null;
  intensity_zone?: number | null;
  distance_meters?: number | null;
  target_calories?: number | null;
  // Campos de HIIT
  intervals?: number | null;
  work_seconds?: number | null;
  interval_rest_seconds?: number | null;
}

export const dayExercisesService = {
  async getAllByTrainingDay(trainingDayId: string): Promise<DayExercise[]> {
    return apiClient.get<DayExercise[]>(`/day-exercises/training-day/${trainingDayId}`);
  },

  async getById(id: string): Promise<DayExercise> {
    return apiClient.get<DayExercise>(`/day-exercises/${id}`);
  },

  async create(trainingDayId: string, data: DayExerciseCreateData): Promise<DayExercise> {
    return apiClient.post<DayExercise>(`/day-exercises/training-day/${trainingDayId}`, data);
  },

  async update(id: string, data: Partial<DayExerciseCreateData>): Promise<DayExercise> {
    return apiClient.put<DayExercise>(`/day-exercises/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete(`/day-exercises/${id}`);
  },

  async reorder(trainingDayId: string, exerciseOrder: string[]): Promise<DayExercise[]> {
    return apiClient.post<DayExercise[]>(`/day-exercises/training-day/${trainingDayId}/reorder`, {
      exercise_order: exerciseOrder,
    });
  },

  async duplicate(id: string): Promise<DayExercise> {
    return apiClient.post<DayExercise>(`/day-exercises/${id}/duplicate`);
  },
};
