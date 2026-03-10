/**
 * API service for Muscle operations.
 * Provides methods to fetch muscles from the backend.
 */
import api from './api';
import { Muscle, MuscleCategory, BodyRegion, MuscleListResponse } from '@/types';

export interface MuscleFilters {
  category?: MuscleCategory;
  body_region?: BodyRegion;
}

/**
 * Fetch all muscles with optional filters.
 */
export async function getMuscles(filters?: MuscleFilters): Promise<MuscleListResponse> {
  const params = new URLSearchParams();

  if (filters?.category) {
    params.append('category', filters.category);
  }
  if (filters?.body_region) {
    params.append('body_region', filters.body_region);
  }

  const queryString = params.toString();
  const url = queryString ? `/muscles?${queryString}` : '/muscles';

  const response = await api.get<MuscleListResponse>(url);
  return response.data;
}

/**
 * Fetch a specific muscle by ID.
 */
export async function getMuscleById(muscleId: string): Promise<Muscle> {
  const response = await api.get<Muscle>(`/muscles/${muscleId}`);
  return response.data;
}

/**
 * Fetch a specific muscle by name.
 */
export async function getMuscleByName(muscleName: string): Promise<Muscle> {
  const response = await api.get<Muscle>(`/muscles/by-name/${muscleName}`);
  return response.data;
}

/**
 * Fetch all unique muscle categories.
 */
export async function getMuscleCategories(): Promise<string[]> {
  const response = await api.get<string[]>('/muscles/categories/list');
  return response.data;
}

/**
 * Fetch all unique body regions.
 */
export async function getBodyRegions(): Promise<string[]> {
  const response = await api.get<string[]>('/muscles/regions/list');
  return response.data;
}

/**
 * Get muscles grouped by category.
 */
export async function getMusclesGroupedByCategory(): Promise<Record<MuscleCategory, Muscle[]>> {
  const { muscles } = await getMuscles();

  const grouped: Record<string, Muscle[]> = {};

  for (const muscle of muscles) {
    const category = muscle.muscle_category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(muscle);
  }

  return grouped as Record<MuscleCategory, Muscle[]>;
}

export const musclesService = {
  getMuscles,
  getMuscleById,
  getMuscleByName,
  getMuscleCategories,
  getBodyRegions,
  getMusclesGroupedByCategory,
};

export default musclesService;
