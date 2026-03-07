import { nutritionApi } from "@/api/clients/nutrition.client";
import { IFoodItem } from "./types";

/**
 * Fetches foods belonging to a specific exchange group.
 * Endpoint: /v1/foods/exchange-group/{groupId}
 */
export const getFoodsByExchangeGroup = async (groupId: number): Promise<IFoodItem[]> => {
    const { data } = await nutritionApi.get<IFoodItem[]>(`/v1/foods/exchange-group/${groupId}`);
    return data;
};

/**
 * Fetches all foods.
 * Endpoint: /v1/foods
 */
export const getFoods = async (): Promise<IFoodItem[]> => {
    const { data } = await nutritionApi.get<IFoodItem[]>("/v1/foods");
    return data;
};
