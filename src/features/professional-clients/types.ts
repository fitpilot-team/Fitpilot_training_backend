// Define the interface based on your API response structure
export interface IProfessionalClient {
    id: number;
    // Add other fields as per your API response
    name?: string;
    email?: string;
    profile_picture?: string;
    deleted_at?: string | null;
}

export interface Client extends IProfessionalClient {
    id: number;
    name: string;
    email: string;
    password: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    role: string;
    phone_number: string | null;
    profile_picture: string;
}

export interface IAvailableSlots {
    id?: number;
    professional_id?: number | string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
    deleted_at?: string | null;
}


