import { createClient } from '@/api/api.client';
import { IExchangeGroup } from './types';

const client = createClient({ baseURL: import.meta.env.VITE_NUTRITION_API_URL });

export const getExchangeGroups = async (): Promise<IExchangeGroup[]> => {
    const { data } = await client.get<IExchangeGroup[]>('/v1/exchange-groups');
    return data;
};

export const getExchangeGroup = async (id: number): Promise<IExchangeGroup> => {
    const { data } = await client.get<IExchangeGroup>(`/v1/exchange-groups/${id}`);
    return data;
};

export const createExchangeGroup = async (groupData: Partial<IExchangeGroup>): Promise<IExchangeGroup> => {
    const { data } = await client.post<IExchangeGroup>('/v1/exchange-groups', groupData);
    return data;
};

export const updateExchangeGroup = async (id: number, groupData: Partial<IExchangeGroup>): Promise<IExchangeGroup> => {
    const { data } = await client.patch<IExchangeGroup>(`/v1/exchange-groups/${id}`, groupData);
    return data;
};

export const deleteExchangeGroup = async (id: number): Promise<void> => {
    await client.delete(`/v1/exchange-groups/${id}`);
};
