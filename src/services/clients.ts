import { apiClient } from './api';
import type { Client, ClientCreate, ClientUpdate, ClientListResponse } from '../types/client';

export const clientsApi = {
  getClients: (params?: { skip?: number; limit?: number; search?: string }): Promise<ClientListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    return apiClient.get<ClientListResponse>(`/clients/${queryString ? `?${queryString}` : ''}`);
  },

  getClient: (clientId: string): Promise<Client> => {
    return apiClient.get<Client>(`/clients/${clientId}`);
  },

  createClient: (data: ClientCreate): Promise<Client> => {
    return apiClient.post<Client>('/clients/', data);
  },

  updateClient: (clientId: string, data: ClientUpdate): Promise<Client> => {
    return apiClient.put<Client>(`/clients/${clientId}`, data);
  },

  deleteClient: (clientId: string): Promise<void> => {
    return apiClient.delete<void>(`/clients/${clientId}`);
  },
};
