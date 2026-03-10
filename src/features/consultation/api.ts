import { createClient } from '@/api/api.client';

const client = createClient({ baseURL: import.meta.env.VITE_NUTRITION_API_URL });

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData();
    // The backend expects 'file' as the key
    formData.append('file', audioBlob, 'recording.webm'); 

    const { data } = await client.post<string>(
        '/v1/consultation/transcribe',
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        }
    );
    return data;
};
