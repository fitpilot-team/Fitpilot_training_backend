import { useMutation } from '@tanstack/react-query';
import { transcribeAudio } from './api';

export const useTranscribeAudio = () => {
    return useMutation<string, Error, Blob>({
        mutationFn: transcribeAudio,
    });
};
