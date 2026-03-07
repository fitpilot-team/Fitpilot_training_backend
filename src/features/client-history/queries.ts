
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClientHistory, saveClientMetric } from './api';
import { IHistoryClient } from './types';

export const useClientHistory = (clientId?: number | string) => {
    return useQuery<IHistoryClient, Error>({
        queryKey: ['client-history', clientId],
        queryFn: () => getClientHistory(clientId!),
        enabled: !!clientId,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });
};

export const useSaveClientMetric = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (metricData: any) => saveClientMetric(metricData),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['client-history', variables.user_id] });
        },
    });
};
