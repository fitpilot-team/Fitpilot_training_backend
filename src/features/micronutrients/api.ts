import { nutritionApi } from "@/api/clients/nutrition.client";
import { IMicronutrient } from "./types";

/**
 * Fetches all micronutrients.
 * Endpoint: /v1/micronutrients
 */
export const getMicronutrients = async (): Promise<IMicronutrient[]> => {
    const { data } = await nutritionApi.get<IMicronutrient[]>("/v1/micronutrients");
    return data;
};
