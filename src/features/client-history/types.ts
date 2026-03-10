
export interface IHistoryClient {
    id: number;
    name: string;
    email: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    role: string;
    phone_number: string;
    profile_picture: string | null;
    deleted_at: string | null;
    lastname: string;
    username: string;
    is_phone_verified: boolean;
    genre?: string;
    client_allergens: ClientAllergen[];
    client_goals: ClientGoal[];
    client_records: ClientRecord[];
    daily_targets: DailyTarget[];
    client_metrics: ClientMetricHistory[];
    client_health_metrics: ClientHealthMetric[];
    appointments: Appointment[];
}

export interface ClientHealthMetric {
    id: number;
    user_id: number;
    recorded_at: string;
    glucose_mg_dl: number | null;
    glucose_context: string | null;
    systolic_mmhg: number | null;
    diastolic_mmhg: number | null;
    heart_rate_bpm: number | null;
    oxygen_saturation_pct: string | null;
    notes: string | null;
}

export interface ClientAllergen {
    client_id: number;
    allergen_id: number;
    allergens: {
        id: number;
        name: string;
        type: string;
        created_at: string;
    };
}

export interface ClientGoal {
    id: number;
    client_id: number;
    goal_id: number;
    is_primary: boolean;
    created_at: string;
    goals: {
        id: number;
        code: string;
        name: string;
        description: string | null;
        created_at: string;
        adjustment_type?: string;
        adjustment_value?: number;
        protein_ratio?: string;
        carbs_ratio?: string;
        fat_ratio?: string;
    };
}

export interface ClientRecord {
    id: number;
    client_id: number;
    medical_conditions: string;
    notes: string;
    preferences: {
        likes: string[];
        dislikes: string[];
    };
    created_at: string;
    updated_at: string;
}

export interface DailyTarget {
    id: number;
    user_id: number;
    start_date: string;
    end_date: string;
    target_calories: number;
    target_protein_g: number;
    target_carbs_g: number;
    target_fat_g: number;
    is_active: boolean;
}

export interface ClientMetricHistory {
    id: string;
    user_id: number;
    date: string;
    logged_at: string;
    weight_kg: string;
    height_cm: string;
    body_fat_pct: string;
    muscle_mass_kg: string;
    visceral_fat: string | null;
    water_pct: string | null;
    waist_cm: string | null;
    hip_cm: string | null;
    chest_cm: string | null;
    arm_left_cm: string | null;
    arm_right_cm: string | null;
    thigh_left_cm: string | null;
    thigh_right_cm: string | null;
    calf_left_cm: string | null;
    calf_right_cm: string | null;
    notes: string;
    recorded_by_user_id: number | null;
}

export interface Appointment {
    id: number;
    professional_id: number;
    client_id: number;
    scheduled_at: string;
    duration_minutes: number;
    status: string;
    title: string | null;
    meeting_link: string | null;
    notes: string | null;
    deleted_at: string | null;
    start_date: string | null;
    end_date: string | null;
    effective_duration: string | null;
    is_intake: boolean;
}
