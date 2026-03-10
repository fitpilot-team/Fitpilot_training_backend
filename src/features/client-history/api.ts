
import { createClient } from '@/api/api.client';
import { IHistoryClient } from './types';

const client = createClient({ baseURL: import.meta.env.VITE_NUTRITION_API_URL });

export const getClientHistory = async (clientId: number | string): Promise<IHistoryClient> => {
    const { data } = await client.get<IHistoryClient>(
        `/v1/professional-clients/history-client/${clientId}`
    );
    return data;
};

export const saveClientMetric = async (metricData: any): Promise<any> => {
    const { data } = await client.post(
        '/v1/client-metrics',
        metricData
    );
    return data;
};
