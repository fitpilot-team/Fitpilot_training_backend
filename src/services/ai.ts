import { apiClient } from './api';
import type {
  AIWorkoutRequest,
  AIWorkoutResponse,
  QuestionnaireConfig,
  SaveWorkoutResponse,
  GeneratedMacrocycle,
  ProgramExplanation,
  InterviewValidationResponse,
  InterviewDataResponse,
} from '../types/ai';

const AI_BASE_URL = '/ai';

export const aiService = {
  /**
   * Obtiene la configuración del cuestionario
   */
  getQuestionnaireConfig: async (): Promise<QuestionnaireConfig> => {
    return apiClient.get<QuestionnaireConfig>(`${AI_BASE_URL}/questionnaire-config`);
  },

  /**
   * Genera un programa de entrenamiento completo
   */
  generateWorkout: async (request: AIWorkoutRequest): Promise<AIWorkoutResponse> => {
    return apiClient.post<AIWorkoutResponse>(`${AI_BASE_URL}/generate`, request, {
      timeout: 300000, // 5 minutos para generación completa (sincronizado con backend)
    });
  },

  /**
   * Genera un programa de TEST (mock) sin llamar a la API de Claude
   * Útil para probar el flujo completo sin gastar créditos
   */
  testGenerate: async (request: AIWorkoutRequest): Promise<AIWorkoutResponse> => {
    return apiClient.post<AIWorkoutResponse>(`${AI_BASE_URL}/test-generate`, request, {
      timeout: 30000, // 30 segundos para test
    });
  },

  /**
   * Genera una preview rápida (solo 1 semana)
   */
  generatePreview: async (request: AIWorkoutRequest): Promise<AIWorkoutResponse> => {
    return apiClient.post<AIWorkoutResponse>(`${AI_BASE_URL}/preview`, request, {
      timeout: 60000, // 1 minuto para preview
    });
  },

  /**
   * Guarda un programa generado en la base de datos
   */
  saveWorkout: async (
    request: AIWorkoutRequest,
    workoutData: {
      macrocycle: GeneratedMacrocycle;
      explanation?: ProgramExplanation;
    }
  ): Promise<SaveWorkoutResponse> => {
    return apiClient.post<SaveWorkoutResponse>(`${AI_BASE_URL}/save`, {
      ...request,
      workout_data: workoutData,
    });
  },

  /**
   * Valida si la entrevista del cliente está completa para generación AI
   */
  validateClientInterview: async (clientId: string): Promise<InterviewValidationResponse> => {
    return apiClient.get<InterviewValidationResponse>(
      `${AI_BASE_URL}/validate-interview/${clientId}`
    );
  },

  /**
   * Obtiene los datos de la entrevista mapeados al formato de AI request
   */
  getInterviewData: async (clientId: string): Promise<InterviewDataResponse> => {
    return apiClient.get<InterviewDataResponse>(
      `${AI_BASE_URL}/interview-data/${clientId}`
    );
  },
};
