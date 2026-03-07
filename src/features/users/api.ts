import { createClient } from '@/api/api.client';
import { ITwilioLookupResponse, IUserProfessionalClient } from './types';

const client = createClient({ baseURL: import.meta.env.VITE_NUTRITION_API_URL });

export const getUsers = async (): Promise<IUserProfessionalClient[]> => {
    const { data } = await client.get<IUserProfessionalClient[]>('/v1/users');
    return data;
};

export const getUserById = async (id: number): Promise<IUserProfessionalClient> => {
    const { data } = await client.get<IUserProfessionalClient>(`/v1/users/${id}`);
    return data;
};

export const createUser = async (userData: Partial<IUserProfessionalClient>): Promise<IUserProfessionalClient> => {
    const { data } = await client.post<IUserProfessionalClient>('/v1/users/professional-client', userData);
    return data;
};

export const updateUser = async (id: number, userData: Partial<IUserProfessionalClient>): Promise<IUserProfessionalClient> => {
    const { data } = await client.patch<IUserProfessionalClient>(`/v1/users/${id}`, userData);
    return data;
};

export const updateProfilePicture = async (imageBlob: Blob): Promise<void> => {
    const formData = new FormData();
    const fileName =
        imageBlob instanceof File && imageBlob.name
            ? imageBlob.name
            : `profile-${Date.now()}.jpg`;

    formData.append('file', imageBlob, fileName);
    await client.patch('/v1/users/me/profile-picture', formData);
};

export const deleteUser = async (id: number): Promise<void> => {
    await client.delete(`/v1/users/${id}`);
};

export const validatePhone = async (phoneNumber: string): Promise<{ status: string; isValid: boolean }> => {
    const { data } = await client.post<{ status: string; isValid: boolean }>('/v1/users/phone/validate', { phone_number: phoneNumber });
    return data;
};

export const lookupPhone = async (phoneNumber: string): Promise<ITwilioLookupResponse> => {
    const { data } = await client.post<ITwilioLookupResponse>('/v1/users/phone/lookup', { phone_number: phoneNumber });
    return data;
};
