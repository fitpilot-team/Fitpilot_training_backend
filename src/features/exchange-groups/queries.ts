import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { IExchangeGroup } from "./types";

export const useGetExchangeGroups = () => {
    return useQuery<IExchangeGroup[], Error>({
        queryKey: ["exchange-groups"],
        queryFn: api.getExchangeGroups,
    });
};

export const useGetExchangeGroup = (id: number) => {
    return useQuery<IExchangeGroup, Error>({
        queryKey: ["exchange-groups", id],
        queryFn: () => api.getExchangeGroup(id),
        enabled: !!id,
    });
};

export const useCreateExchangeGroup = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (groupData: Partial<IExchangeGroup>) => api.createExchangeGroup(groupData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["exchange-groups"] });
        },
    });
};

export const useUpdateExchangeGroup = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<IExchangeGroup> }) =>
            api.updateExchangeGroup(id, data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["exchange-groups"] });
            queryClient.invalidateQueries({ queryKey: ["exchange-groups", data.id] });
        },
    });
};

export const useDeleteExchangeGroup = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => api.deleteExchangeGroup(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["exchange-groups"] });
        },
    });
};
