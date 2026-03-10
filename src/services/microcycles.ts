import { apiClient } from './api';
import type { Microcycle } from '../types';

export type IntensityLevel = 'low' | 'medium' | 'high' | 'deload' | 'peak';

export interface MicrocycleCreateData {
  name: string;
  week_number: number;
  start_date: string;
  end_date: string;
  intensity_level?: IntensityLevel;
  notes?: string;
}

export const microcyclesService = {
  async getAllByMacrocycle(macrocycleId: string): Promise<Microcycle[]> {
    return apiClient.get<Microcycle[]>(`/microcycles/macrocycle/${macrocycleId}`);
  },

  async getById(id: string): Promise<Microcycle> {
    return apiClient.get<Microcycle>(`/microcycles/${id}`);
  },

  async create(macrocycleId: string, data: MicrocycleCreateData): Promise<Microcycle> {
    return apiClient.post<Microcycle>(`/microcycles/macrocycle/${macrocycleId}`, data);
  },

  async update(id: string, data: Partial<MicrocycleCreateData>): Promise<Microcycle> {
    return apiClient.put<Microcycle>(`/microcycles/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete(`/microcycles/${id}`);
  },

  async reorder(macrocycleId: string, microcycleOrder: string[]): Promise<Microcycle[]> {
    return apiClient.post<Microcycle[]>(`/microcycles/macrocycle/${macrocycleId}/reorder`, {
      microcycle_order: microcycleOrder,
    });
  },
};
