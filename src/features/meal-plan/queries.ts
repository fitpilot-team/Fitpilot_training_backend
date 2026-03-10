import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createMealPlan,
    deleteMealPlan,
    getMealPlanById,
    getMealPlans,
    updateMealPlan
} from "./api";
import { IMealPlan } from "./types";

/**
 * Hook to fetch all meal plans.
 */
export const useGetMealPlans = () => {
    return useQuery<IMealPlan[], Error>({
        queryKey: ["meal-plans"],
        queryFn: getMealPlans,
    });
};

/**
 * Hook to fetch a single meal plan by ID.
 */
export const useGetMealPlanById = (id: number) => {
    return useQuery<IMealPlan, Error>({
        queryKey: ["meal-plans", id],
        queryFn: () => getMealPlanById(id),
        enabled: !!id,
    });
};

/**
 * Hook to create a new meal plan.
 */
export const useCreateMealPlan = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: IMealPlan) => createMealPlan(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
        },
    });
};

/**
 * Hook to update an existing meal plan.
 */
export const useUpdateMealPlan = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: IMealPlan }) =>
            updateMealPlan(id, data),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
            queryClient.invalidateQueries({ queryKey: ["meal-plans", id] });
        },
    });
};

/**
 * Hook to delete a meal plan.
 */
export const useDeleteMealPlan = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => deleteMealPlan(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
        },
    });
};
