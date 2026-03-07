import { createClient } from "../api.client";

const nutritionBaseURL = (import.meta.env.VITE_NUTRITION_API_URL as string | undefined) || window.location.origin;

export const nutritionApi = createClient({
    baseURL: nutritionBaseURL,
});
