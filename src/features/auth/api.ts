import { createClient } from '@/api/api.client';
import {
    SendVerificationDto,
    VerifyPhoneDto,
    AuthResponse,
    SignupDto,
    AuthActionResponse,
    AuthSession,
    AuthSessionsResponse,
} from './types';

const client = createClient({ baseURL: import.meta.env.VITE_NUTRITION_API_URL });

export const sendVerification = async (data: SendVerificationDto): Promise<AuthResponse> => {
    const response = await client.post('/v1/auth/send-verification', data);
    return response.data;
};

export const verifyPhone = async (data: VerifyPhoneDto): Promise<AuthResponse> => {
    const response = await client.post('/v1/auth/verify-phone', data);
    return response.data;
};

export const signup = async (data: SignupDto): Promise<AuthResponse> => {
    const response = await client.post('/v1/auth/signup', data);
    return response.data;
};

const extractSessions = (payload: AuthSessionsResponse): AuthSession[] => {
    if (Array.isArray(payload)) {
        return payload;
    }

    if ('sessions' in payload && Array.isArray(payload.sessions)) {
        return payload.sessions;
    }

    if ('data' in payload && Array.isArray(payload.data)) {
        return payload.data;
    }

    if ('items' in payload && Array.isArray(payload.items)) {
        return payload.items;
    }

    return [];
};

export const getAuthSessions = async (): Promise<AuthSession[]> => {
    const response = await client.get<AuthSessionsResponse>('/v1/auth/sessions');
    return extractSessions(response.data);
};

export const revokeAuthSession = async (sessionId: number): Promise<AuthActionResponse> => {
    const response = await client.delete<AuthActionResponse>(`/v1/auth/sessions/${sessionId}`);
    return response.data;
};

export const logoutAllAuthSessions = async (): Promise<AuthActionResponse> => {
    const response = await client.post<AuthActionResponse>('/v1/auth/logout-all');
    return response.data;
};
