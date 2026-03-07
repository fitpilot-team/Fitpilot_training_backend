export interface IAppointment {
    id: number;
    professional_id: number;
    client_id: number;
    scheduled_at: string;
    duration_minutes?: number;
    status?: string;
    title?: string;
    meeting_link?: string;
    notes?: string;
    deleted_at?: string | null;
    start_date?: string;
    end_date?: string;
    effective_duration?: number;
    type?: 'NUTRITION' | 'TRAINING' | 'BOTH';
    stage?: string;
}

export interface CreateAppointmentDraftRequest {
    appointment_id: number;
    stage: string;
    notes?: string;
    metrics?: any;
    target_macros?: {
        calories: number;
        protein: number;
        carbs: number;
        fats: number;
    };
    json_state?: any;
}

export interface UpdateAppointmentDraftRequest {
    stage?: string;
    notes?: string;
    metrics?: any;
    target_macros?: {
        calories: number;
        protein: number;
        carbs: number;
        fats: number;
    };
    json_state?: any;
}
