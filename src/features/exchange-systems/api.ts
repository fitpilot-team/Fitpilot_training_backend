import { createClient } from '@/api/api.client';
import { IExchangeSystem } from './types';

const client = createClient({ baseURL: import.meta.env.VITE_NUTRITION_API_URL });

export const getExchangeSystems = async (): Promise<IExchangeSystem[]> => {
    const { data } = await client.get<IExchangeSystem[]>('/v1/exchange-systems');
    return data;
};

export const getExchangeSystem = async (id: number): Promise<IExchangeSystem> => {
    const { data } = await client.get<IExchangeSystem>(`/v1/exchange-systems/${id}`);
    return data;
};
