export interface IUserProfessionalClient {
    id: number;
    name: string;
    email: string;
    password?: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    role: string;
    phone_number: string | null;
    profile_picture: string | null;
    deleted_at: string | null;
    lastname: string | null;
    username: string | null;
    professional_id?: number | string;
    service_type: string;
}

export interface ITwilioLookupResponse {
    country_code: string;
    phone_number: string;
    national_format: string;
    carrier?: {
        mobile_country_code: string;
        mobile_network_code: string;
        name: string;
        type: string;
        error_code: null | string;
    };
    valid: boolean;
}
