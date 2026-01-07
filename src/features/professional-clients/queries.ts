import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAvailableSlots, getProfessionalClients, insertAvailableSlot, updateAvailableSlot } from "@/features/professional-clients/api";
import { IAvailableSlots, IProfessionalClient } from "@/features/professional-clients/types";

/**
 * Custom hook to fetch professional clients using TanStack Query.
 * @param professionalId The ID of the professional to fetch clients for.
 */
export const useProfessionalClients = (professionalId: number | string) => {
    return useQuery<IProfessionalClient[], Error>({
        queryKey: ["professional-clients", professionalId],
        queryFn: () => getProfessionalClients(professionalId),
        enabled: !!professionalId, // Only run if professionalId is provided
        staleTime: 1000 * 60 * 5, // 5 minutes, adjust as needed
    });
};

// available slots
export const useAvailableSlots = (professionalId: number | string) => {
    return useQuery<IAvailableSlots[], Error>({
        queryKey: ["available-slots", professionalId],
        queryFn: () => getAvailableSlots(professionalId),
        enabled: !!professionalId, // Only run if professionalId is provided
        staleTime: 1000 * 60 * 5, // 5 minutes, adjust as needed
    });
};

/**
 * Custom hook to insert a new availability slot.
 */
export const useInsertAvailableSlot = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (slotData: Partial<IAvailableSlots>) => insertAvailableSlot(slotData),
        onSuccess: () => {
            // Invalidate the available-slots query to refetch the data
            queryClient.invalidateQueries({ queryKey: ["available-slots"] });
        },
    });
};

/**
 * Custom hook to update an existing availability slot.
 */
export const useUpdateAvailableSlot = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, slotData }: { id: number; slotData: Partial<IAvailableSlots> }) =>
            updateAvailableSlot(id, slotData),
        onSuccess: () => {
            // Invalidate the available-slots query to refetch the data
            queryClient.invalidateQueries({ queryKey: ["available-slots"] });
        },
    });
};



