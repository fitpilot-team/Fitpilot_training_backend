import { useQuery } from "@tanstack/react-query";
import { getFoods, getFoodsByExchangeGroup } from "./api";
import { IFoodItem } from "./types";

/**
 * Hook to fetch foods by exchange group.
 */
export const useGetFoodsByExchangeGroup = (groupId?: number) => {
    return useQuery<IFoodItem[], Error>({
        queryKey: ["foods", "exchange-group", groupId],
        queryFn: () => getFoodsByExchangeGroup(groupId!),
        enabled: !!groupId,
    });
};

/**
 * Hook to fetch all foods.
 */
export const useGetFoods = () => {
    return useQuery<IFoodItem[], Error>({
        queryKey: ["foods"],
        queryFn: getFoods,
    });
};
