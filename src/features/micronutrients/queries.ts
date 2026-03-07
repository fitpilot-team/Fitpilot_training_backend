import { useQuery } from "@tanstack/react-query";
import { getMicronutrients } from "./api";
import { IMicronutrient } from "./types";

/**
 * Hook to fetch all micronutrients.
 */
export const useGetMicronutrients = () => {
    return useQuery<IMicronutrient[], Error>({
        queryKey: ["micronutrients"],
        queryFn: getMicronutrients,
    });
};
