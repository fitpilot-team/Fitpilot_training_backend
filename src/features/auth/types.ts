export interface VerifyPhoneDto {
    phone_number: string;
    code: string;
}

export interface SendVerificationDto {
    phone_number: string;
}

export interface AuthResponse {
    message: string;
    access_token?: string;
    refresh_token?: string;
}

export interface SignupDto {
    name: string;
    lastname: string;
    email?: string;
    password: string;
    role: string;
    phone_number: string;
}

export interface AuthSession {
    id: number;
    user_id?: number;
    device?: string | null;
    device_name?: string | null;
    user_agent?: string | null;
    ip_address?: string | null;
    location?: string | null;
    browser?: string | null;
    os?: string | null;
    platform?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    last_activity_at?: string | null;
    last_used_at?: string | null;
    expires_at?: string | null;
    revoked_at?: string | null;
    is_current?: boolean;
    current?: boolean;
    isCurrent?: boolean;
    [key: string]: unknown;
}

export type AuthSessionsResponse =
    | AuthSession[]
    | { sessions: AuthSession[] }
    | { data: AuthSession[] }
    | { items: AuthSession[] };

export interface AuthActionResponse {
    message?: string;
    success?: boolean;
}
