// import { nutritionApi } from "./nutrition.client";
import { createClient } from '@/api/api.client';
import { IAppointment, CreateAppointmentDraftRequest, UpdateAppointmentDraftRequest } from '@/features/appointments/types';

const client = createClient({ baseURL: import.meta.env.VITE_NUTRITION_API_URL });

/**
 * Fetches the clients associated with a specific professional.
 * Endpoint: /v1/professional-clients/professional/{id}
 */
export const getAppointments = async (professionalId: number | string): Promise<IAppointment[]> => {
    const { data } = await client.get<IAppointment[]>(
        `/v1/appointments/professional/${professionalId}`
    );
    return data;
};

export const insertAppointment = async (appointmentData: Partial<IAppointment>): Promise<IAppointment> => {
    const { data } = await client.post<IAppointment>(
        `/v1/appointments`,
        appointmentData
    );
    return data;
};

export const deleteAppointment = async (id: number): Promise<void> => {
    await client.delete(`/v1/appointments/${id}`);
};

export const updateAppointment = async (id: number, appointmentData: Partial<IAppointment>): Promise<IAppointment> => {
    const { data } = await client.patch<IAppointment>(
        `/v1/appointments/${id}`,
        appointmentData
    );
    return data;
};

export const startConsultation = async (id: number): Promise<IAppointment> => {
    return updateAppointment(id, {
        start_date: new Date().toISOString(),
        status: 'in_progress'
    });
};

export const finishConsultation = async (id: number, durationSeconds: number, notes?: string): Promise<IAppointment> => {
    return updateAppointment(id, {
        end_date: new Date().toISOString(),
        effective_duration: durationSeconds,
        status: 'completed',
        notes: notes
    });
};


export const createAppointmentDraft = async (data: CreateAppointmentDraftRequest): Promise<any> => {
    const response = await client.post(`/v1/appointments/${data.appointment_id}/draft`, data);
    return response.data;
};

export const updateAppointmentDraft = async (appointmentId: number, data: UpdateAppointmentDraftRequest): Promise<any> => {
    const response = await client.patch(`/v1/appointments/${appointmentId}/draft`, data);
    return response.data;
};

export const getAppointmentDraft = async (appointmentId: number): Promise<any> => {
    const response = await client.get(`/v1/appointments/${appointmentId}/draft`);
    return response.data;
};
