import { apiClient } from './api';
import type { Macrocycle, Mesocycle, Microcycle, TrainingDay, DayExercise, ExercisePhase } from '../types';

// =============== Macrocycle Types ===============

export interface MacrocycleCreateData {
  name: string;
  description?: string;
  objective: string;
  start_date: string; // ISO date format (YYYY-MM-DD)
  end_date: string; // ISO date format (YYYY-MM-DD)
  client_id?: string | null;
}

export interface MacrocycleUpdateData {
  name?: string;
  description?: string;
  objective?: string;
  start_date?: string;
  end_date?: string;
  status?: 'draft' | 'active' | 'completed' | 'archived';
}

interface MacrocycleListResponse {
  total: number;
  macrocycles: Macrocycle[];
}

// =============== Mesocycle Types ===============

export interface MesocycleCreateData {
  block_number: number;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  focus?: string;
  notes?: string;
}

export interface MesocycleUpdateData {
  block_number?: number;
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  focus?: string;
  notes?: string;
}

interface MesocycleListResponse {
  total: number;
  mesocycles: Mesocycle[];
}

// =============== Microcycle Types ===============

export interface MicrocycleCreateData {
  week_number: number;
  name: string;
  start_date: string;
  end_date: string;
  intensity_level?: 'low' | 'medium' | 'high' | 'deload';
  notes?: string;
}

export interface MicrocycleUpdateData {
  week_number?: number;
  name?: string;
  start_date?: string;
  end_date?: string;
  intensity_level?: 'low' | 'medium' | 'high' | 'deload';
  notes?: string;
}

// =============== Training Day Types ===============

export interface TrainingDayCreateData {
  day_number: number;
  date: string;
  name: string;
  focus?: string;
  rest_day?: boolean;
  notes?: string;
}

export interface TrainingDayUpdateData {
  day_number?: number;
  date?: string;
  name?: string;
  focus?: string;
  rest_day?: boolean;
  notes?: string;
}

// =============== Day Exercise Types ===============

export interface DayExerciseCreateData {
  exercise_id: string;
  order_index: number;
  phase?: ExercisePhase;
  sets: number;
  // Campos de fuerza (opcionales para cardio)
  reps_min?: number | null;
  reps_max?: number | null;
  rest_seconds: number;
  effort_type: 'RIR' | 'RPE' | 'percentage';
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

export interface DayExerciseUpdateData {
  exercise_id?: string;
  order_index?: number;
  phase?: ExercisePhase;
  sets?: number;
  // Campos de fuerza
  reps_min?: number | null;
  reps_max?: number | null;
  rest_seconds?: number;
  effort_type?: 'RIR' | 'RPE' | 'percentage';
  effort_value?: number;
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

// =============== Service ===============

export const mesocyclesService = {
  // === Macrocycle Operations ===
  async getAllMacrocycles(): Promise<Macrocycle[]> {
    const response = await apiClient.get<MacrocycleListResponse>('/mesocycles');
    return response.macrocycles || [];
  },

  async getMacrocycleById(id: string): Promise<Macrocycle> {
    return apiClient.get<Macrocycle>(`/mesocycles/${id}`);
  },

  async createMacrocycle(data: MacrocycleCreateData): Promise<Macrocycle> {
    return apiClient.post<Macrocycle>('/mesocycles', data);
  },

  async updateMacrocycle(id: string, data: MacrocycleUpdateData): Promise<Macrocycle> {
    return apiClient.put<Macrocycle>(`/mesocycles/${id}`, data);
  },

  async deleteMacrocycle(id: string): Promise<void> {
    return apiClient.delete(`/mesocycles/${id}`);
  },

  // === Mesocycle Operations ===
  async getMesocycles(macrocycleId: string): Promise<Mesocycle[]> {
    const response = await apiClient.get<MesocycleListResponse>(
      `/mesocycles/${macrocycleId}/mesocycles`
    );
    return response.mesocycles || [];
  },

  async getMesocycleById(macrocycleId: string, mesocycleId: string): Promise<Mesocycle> {
    return apiClient.get<Mesocycle>(
      `/mesocycles/${macrocycleId}/mesocycles/${mesocycleId}`
    );
  },

  async createMesocycle(macrocycleId: string, data: MesocycleCreateData): Promise<Mesocycle> {
    return apiClient.post<Mesocycle>(
      `/mesocycles/${macrocycleId}/mesocycles`,
      data
    );
  },

  async updateMesocycle(
    macrocycleId: string,
    mesocycleId: string,
    data: MesocycleUpdateData
  ): Promise<Mesocycle> {
    return apiClient.put<Mesocycle>(
      `/mesocycles/${macrocycleId}/mesocycles/${mesocycleId}`,
      data
    );
  },

  async deleteMesocycle(macrocycleId: string, mesocycleId: string): Promise<void> {
    return apiClient.delete(
      `/mesocycles/${macrocycleId}/mesocycles/${mesocycleId}`
    );
  },

  // === Microcycle Operations ===
  async createMicrocycle(
    macrocycleId: string,
    mesocycleId: string,
    data: MicrocycleCreateData
  ): Promise<Microcycle> {
    return apiClient.post<Microcycle>(
      `/mesocycles/${macrocycleId}/mesocycles/${mesocycleId}/microcycles`,
      data
    );
  },

  async updateMicrocycle(
    macrocycleId: string,
    mesocycleId: string,
    microcycleId: string,
    data: MicrocycleUpdateData
  ): Promise<Microcycle> {
    return apiClient.put<Microcycle>(
      `/mesocycles/${macrocycleId}/mesocycles/${mesocycleId}/microcycles/${microcycleId}`,
      data
    );
  },

  async deleteMicrocycle(
    macrocycleId: string,
    mesocycleId: string,
    microcycleId: string
  ): Promise<void> {
    return apiClient.delete(
      `/mesocycles/${macrocycleId}/mesocycles/${mesocycleId}/microcycles/${microcycleId}`
    );
  },

  // === Training Day Operations ===
  async createTrainingDay(
    macrocycleId: string,
    mesocycleId: string,
    microcycleId: string,
    data: TrainingDayCreateData
  ): Promise<TrainingDay> {
    return apiClient.post<TrainingDay>(
      `/mesocycles/${macrocycleId}/mesocycles/${mesocycleId}/microcycles/${microcycleId}/days`,
      data
    );
  },

  async updateTrainingDay(
    macrocycleId: string,
    mesocycleId: string,
    microcycleId: string,
    dayId: string,
    data: TrainingDayUpdateData
  ): Promise<TrainingDay> {
    return apiClient.put<TrainingDay>(
      `/mesocycles/${macrocycleId}/mesocycles/${mesocycleId}/microcycles/${microcycleId}/days/${dayId}`,
      data
    );
  },

  async deleteTrainingDay(
    macrocycleId: string,
    mesocycleId: string,
    microcycleId: string,
    dayId: string
  ): Promise<void> {
    return apiClient.delete(
      `/mesocycles/${macrocycleId}/mesocycles/${mesocycleId}/microcycles/${microcycleId}/days/${dayId}`
    );
  },

  // === Day Exercise Operations ===
  async createDayExercise(
    macrocycleId: string,
    mesocycleId: string,
    microcycleId: string,
    dayId: string,
    data: DayExerciseCreateData
  ): Promise<DayExercise> {
    return apiClient.post<DayExercise>(
      `/mesocycles/${macrocycleId}/mesocycles/${mesocycleId}/microcycles/${microcycleId}/days/${dayId}/exercises`,
      data
    );
  },

  async updateDayExercise(
    macrocycleId: string,
    mesocycleId: string,
    microcycleId: string,
    dayId: string,
    exerciseId: string,
    data: DayExerciseUpdateData
  ): Promise<DayExercise> {
    return apiClient.put<DayExercise>(
      `/mesocycles/${macrocycleId}/mesocycles/${mesocycleId}/microcycles/${microcycleId}/days/${dayId}/exercises/${exerciseId}`,
      data
    );
  },

  async deleteDayExercise(
    macrocycleId: string,
    mesocycleId: string,
    microcycleId: string,
    dayId: string,
    exerciseId: string
  ): Promise<void> {
    return apiClient.delete(
      `/mesocycles/${macrocycleId}/mesocycles/${mesocycleId}/microcycles/${microcycleId}/days/${dayId}/exercises/${exerciseId}`
    );
  },

  // === Reorder Operations ===
  async reorderExercises(dayId: string, exerciseIds: string[]): Promise<void> {
    return apiClient.patch(`/training-days/${dayId}/reorder`, { exercise_ids: exerciseIds });
  },

  async moveExerciseBetweenDays(
    exerciseId: string,
    fromDayId: string,
    toDayId: string,
    newIndex: number
  ): Promise<void> {
    return apiClient.patch(`/day-exercises/${exerciseId}/move`, {
      from_day_id: fromDayId,
      to_day_id: toDayId,
      new_index: newIndex,
    });
  },
};

// Legacy alias for backwards compatibility
export const getAll = mesocyclesService.getAllMacrocycles;
export const getById = mesocyclesService.getMacrocycleById;
export const create = mesocyclesService.createMacrocycle;
export const update = mesocyclesService.updateMacrocycle;
