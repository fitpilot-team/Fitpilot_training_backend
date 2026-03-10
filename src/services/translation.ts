import api from './api';

export interface TranslationStatus {
    available: boolean;
    model: string;
    host: string;
}

export interface TranslateResponse {
    original: string;
    translated: string;
    source_lang: string;
    target_lang: string;
}

export interface TranslateAllResponse {
    message: string;
    pending: number;
}

export const translationService = {
    /**
     * Check if translation service is available
     */
    getStatus: async (): Promise<TranslationStatus> => {
        const response = await api.get<TranslationStatus>('/translation/status');
        return response.data;
    },

    /**
     * Translate a single text
     */
    translateText: async (text: string, sourceLang = 'en', targetLang = 'es'): Promise<TranslateResponse> => {
        const response = await api.post<TranslateResponse>('/translation/translate', {
            text,
            source_lang: sourceLang,
            target_lang: targetLang,
        });
        return response.data;
    },

    /**
     * Trigger translation for all exercises missing translations
     */
    translateAllExercises: async (): Promise<TranslateAllResponse> => {
        const response = await api.post<TranslateAllResponse>('/translation/exercises/translate-all');
        return response.data;
    },
};
