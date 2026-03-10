import api, { apiClient } from './api';
import type { Exercise, ExerciseClass, CardioSubclass, MuscleCategory, MuscleRole } from '../types';

export interface ExerciseFilters {
  type?: string;
  muscle_id?: string;
  muscle_category?: MuscleCategory;
  muscle_role?: MuscleRole;
  resistance_profile?: string;
  difficulty_level?: string;
  search?: string;
  exercise_class?: ExerciseClass;
  cardio_subclass?: CardioSubclass;
  skip?: number;
  limit?: number;
}

export interface ExerciseCreateData {
  name_en: string;  // Nombre en inglés (requerido)
  name_es?: string; // Nombre en español
  type: string;
  resistance_profile: string;
  category: string;
  description_en?: string;  // Descripción en inglés
  description_es?: string;  // Descripción en español
  video_url?: string;
  thumbnail_url?: string;
  image_url?: string;
  equipment_needed?: string;
  difficulty_level?: string;
  primary_muscle_ids: string[];
  secondary_muscle_ids?: string[];
  // Clasificación de ejercicio
  exercise_class?: ExerciseClass;
  cardio_subclass?: CardioSubclass;
  // Campos específicos para cardio
  intensity_zone?: number;
  target_heart_rate_min?: number;
  target_heart_rate_max?: number;
  calories_per_minute?: number;
}

export interface ExerciseUpdateData {
  name_en?: string;  // Nombre en inglés
  name_es?: string;  // Nombre en español
  type?: string;
  resistance_profile?: string;
  category?: string;
  description_en?: string;  // Descripción en inglés
  description_es?: string;  // Descripción en español
  video_url?: string;
  thumbnail_url?: string;
  image_url?: string;
  equipment_needed?: string;
  difficulty_level?: string;
  primary_muscle_ids?: string[];
  secondary_muscle_ids?: string[];
  // Clasificación de ejercicio
  exercise_class?: ExerciseClass;
  cardio_subclass?: CardioSubclass;
  // Campos específicos para cardio
  intensity_zone?: number;
  target_heart_rate_min?: number;
  target_heart_rate_max?: number;
  calories_per_minute?: number;
}

export const exercisesService = {
  async getAll(filters?: ExerciseFilters): Promise<{ total: number; exercises: Exercise[] }> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('exercise_type', filters.type);
    if (filters?.muscle_id) params.append('muscle_id', filters.muscle_id);
    if (filters?.muscle_category) params.append('muscle_category', filters.muscle_category);
    if (filters?.muscle_role) params.append('muscle_role', filters.muscle_role);
    if (filters?.resistance_profile) params.append('resistance_profile', filters.resistance_profile);
    if (filters?.difficulty_level) params.append('difficulty_level', filters.difficulty_level);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.exercise_class) params.append('exercise_class', filters.exercise_class);
    if (filters?.cardio_subclass) params.append('cardio_subclass', filters.cardio_subclass);
    if (filters?.skip !== undefined) params.append('skip', filters.skip.toString());
    if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const url = `/exercises${queryString ? `?${queryString}` : ''}`;
    return apiClient.get<{ total: number; exercises: Exercise[] }>(url);
  },

  async getById(id: string): Promise<Exercise> {
    return apiClient.get<Exercise>(`/exercises/${id}`);
  },

  async create(data: ExerciseCreateData): Promise<Exercise> {
    return apiClient.post<Exercise>('/exercises', data);
  },

  async update(id: string, data: Partial<ExerciseCreateData>): Promise<Exercise> {
    return apiClient.put<Exercise>(`/exercises/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete(`/exercises/${id}`);
  },

  async uploadImage(exerciseId: string, file: File): Promise<Exercise> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<Exercise>(
      `/exercises/${exerciseId}/upload-image`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  async deleteImage(exerciseId: string): Promise<Exercise> {
    return apiClient.delete<Exercise>(`/exercises/${exerciseId}/image`);
  },

  async generateAnatomyImage(exerciseId: string): Promise<Exercise> {
    return apiClient.post<Exercise>(`/exercises/${exerciseId}/generate-anatomy-image`);
  },

  async fetchMovementImage(exerciseId: string): Promise<Exercise> {
    return apiClient.post<Exercise>(`/exercises/${exerciseId}/fetch-movement-image`);
  },
};
