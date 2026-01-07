import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { clientsApi } from '../services/clients';
import type { Client, ClientCreate, ClientUpdate } from '../types/client';

interface ClientState {
  clients: Client[];
  selectedClient: Client | null;
  isLoading: boolean;
  error: string | null;
  total: number;

  // Actions
  fetchClients: (params?: { skip?: number; limit?: number; search?: string }) => Promise<void>;
  fetchClientById: (clientId: string) => Promise<Client>;
  createClient: (data: ClientCreate) => Promise<Client>;
  updateClient: (clientId: string, data: ClientUpdate) => Promise<Client>;
  deleteClient: (clientId: string) => Promise<void>;
  selectClient: (client: Client | null) => void;
  clearError: () => void;
}

export const useClientStore = create<ClientState>()(
  devtools(
    persist(
      (set) => ({
        clients: [],
        selectedClient: null,
        isLoading: false,
        error: null,
        total: 0,

        fetchClients: async (params) => {
          set({ isLoading: true, error: null });

          try {
            const response = await clientsApi.getClients(params);
            console.log("response_clients", response);
            set({ clients: response.clients, total: response.total });
          } catch (error: any) {
            set({ error: error.message || 'Failed to fetch clients' });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        fetchClientById: async (clientId) => {
          set({ error: null });

          try {
            const client = await clientsApi.getClient(clientId);
            set({ selectedClient: client });
            return client;
          } catch (error: any) {
            set({ error: error.message || 'Failed to fetch client' });
            throw error;
          }
        },

        createClient: async (data) => {
          set({ isLoading: true, error: null });

          try {
            const newClient = await clientsApi.createClient(data);
            set((state) => ({
              clients: [...state.clients, newClient],
              total: state.total + 1,
            }));
            return newClient;
          } catch (error: any) {
            set({ error: error.message || 'Failed to create client' });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        updateClient: async (clientId, data) => {
          set({ isLoading: true, error: null });

          try {
            const updatedClient = await clientsApi.updateClient(clientId, data);
            set((state) => ({
              clients: state.clients.map((c) =>
                c.id === clientId ? updatedClient : c
              ),
              selectedClient:
                state.selectedClient?.id === clientId
                  ? updatedClient
                  : state.selectedClient,
            }));
            return updatedClient;
          } catch (error: any) {
            set({ error: error.message || 'Failed to update client' });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        deleteClient: async (clientId) => {
          set({ isLoading: true, error: null });

          try {
            await clientsApi.deleteClient(clientId);
            set((state) => ({
              clients: state.clients.filter((c) => c.id !== clientId),
              total: state.total - 1,
              selectedClient:
                state.selectedClient?.id === clientId
                  ? null
                  : state.selectedClient,
            }));
          } catch (error: any) {
            set({ error: error.message || 'Failed to delete client' });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        selectClient: (client) => {
          set({ selectedClient: client });
        },

        clearError: () => {
          set({ error: null });
        },
      }),
      {
        name: 'client-storage',
        partialize: (state) => ({ selectedClient: state.selectedClient }),
      }
    ),
    { name: 'ClientStore' }
  )
);
