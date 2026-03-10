import { apiClient } from './api';
import type { TrainingDay } from '../types';

export interface TrainingDayCreateData {
  day_number: number; // 1-7 for Monday-Sunday
  date: string; // ISO date format (YYYY-MM-DD)
  name: string;
  focus?: string;
  rest_day?: boolean;
  notes?: string;
}

export const trainingDaysService = {
  async getAllByMicrocycle(microcycleId: string): Promise<TrainingDay[]> {
    return apiClient.get<TrainingDay[]>(`/training-days/microcycle/${microcycleId}`);
  },

  async getById(id: string): Promise<TrainingDay> {
    return apiClient.get<TrainingDay>(`/training-days/${id}`);
  },

  async create(microcycleId: string, data: TrainingDayCreateData): Promise<TrainingDay> {
    return apiClient.post<TrainingDay>(`/training-days/microcycle/${microcycleId}`, data);
  },

  async update(id: string, data: Partial<TrainingDayCreateData>): Promise<TrainingDay> {
    return apiClient.put<TrainingDay>(`/training-days/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete(`/training-days/${id}`);
  },

  async duplicate(id: string, newDayNumber: number): Promise<TrainingDay> {
    return apiClient.post<TrainingDay>(`/training-days/${id}/duplicate`, null, {
      params: { new_day_number: newDayNumber },
    });
  },
};
