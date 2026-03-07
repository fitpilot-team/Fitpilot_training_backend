// import { nutritionApi } from "./nutrition.client";
import { createClient } from '@/api/api.client';
import { IAvailableSlots, IProfessionalClient } from './types';
import { assertNutritionSubscriptionAccess } from '@/features/subscriptions/nutritionAccess';

const client = createClient({ baseURL: import.meta.env.VITE_NUTRITION_API_URL });

/**
 * Fetches the clients associated with a specific professional.
 * Endpoint: /v1/professional-clients/professional/{id}
 */
export const getProfessionalClients = async (professionalId: number | string): Promise<IProfessionalClient[]> => {
    const { data } = await client.get<IProfessionalClient[]>(
        `/v1/professional-clients/professional/${professionalId}`
    );
    return data;
};

// available slots
export const getAvailableSlots = async (professionalId: number | string): Promise<IAvailableSlots[]> => {
    const { data } = await client.get<IAvailableSlots[]>(
        `/v1/availability-slots/professional/${professionalId}`
    );
    return data;
};

export const insertAvailableSlot = async (slotData: Partial<IAvailableSlots>): Promise<IAvailableSlots> => {
    const { data } = await client.post<IAvailableSlots>(
        `/v1/availability-slots`,
        slotData
    );
    return data;
};

export const updateAvailableSlot = async (id: number, slotData: Partial<IAvailableSlots>): Promise<IAvailableSlots> => {
    const { data } = await client.patch<IAvailableSlots>(
        `/v1/availability-slots/${id}`,
        slotData
    );
    return data;
};



// client metrics
export const assignMenusToClient = async (clientId: number, menuIds: number[]): Promise<void> => {
    assertNutritionSubscriptionAccess();
    await client.post(`/v1/professional-clients/${clientId}/assigned-menus`, { menu_ids: menuIds });
};
