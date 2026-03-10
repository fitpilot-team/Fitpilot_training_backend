import { createClient } from "../api.client";

const trainingBaseURL = (import.meta.env.VITE_TRAINING_API_URL as string | undefined) || window.location.origin;

export const trainingApi = createClient({
    baseURL: trainingBaseURL,
});
