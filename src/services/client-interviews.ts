import { apiClient } from './api';
import type { ClientInterview, ClientInterviewUpdate } from '../types/client';

export type { ClientInterviewUpdate };

export const clientInterviewsApi = {
  getInterview: (clientId: string): Promise<ClientInterview> => {
    return apiClient.get<ClientInterview>(`/client-interviews/${clientId}`);
  },

  createInterview: (clientId: string, data: ClientInterviewUpdate): Promise<ClientInterview> => {
    return apiClient.post<ClientInterview>(`/client-interviews/${clientId}`, data);
  },

  updateInterview: (clientId: string, data: ClientInterviewUpdate): Promise<ClientInterview> => {
    return apiClient.put<ClientInterview>(`/client-interviews/${clientId}`, data);
  },

  deleteInterview: (clientId: string): Promise<void> => {
    return apiClient.delete<void>(`/client-interviews/${clientId}`);
  },
};
