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
}
