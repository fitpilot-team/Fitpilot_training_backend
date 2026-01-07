import { createClient } from "../api.client";

export const trainingApi = createClient({
    baseURL: import.meta.env.VITE_API_URL,
});