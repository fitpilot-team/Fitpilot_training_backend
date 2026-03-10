import { createClient } from '@/api/api.client';
import { Plan } from './types';

const client = createClient({ baseURL: import.meta.env.VITE_NUTRITION_API_URL });

export const getPlans = async (): Promise<Plan[]> => {
  const { data } = await client.get<Plan[]>('/v1/plans', {
    params: { is_active: true },
  });
  return data;
};
