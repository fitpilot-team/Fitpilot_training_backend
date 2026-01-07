import { createClient } from "../api.client";


export const nutritionApi = createClient({
    baseURL: import.meta.env.VITE_NUTRITION_API_URL,
});