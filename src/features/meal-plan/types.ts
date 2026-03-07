import { IExchangeGroup } from "../exchange-groups/types";

export interface IMealPlanExchange {
    id?: number;
    exchange_group_id: number;
    quantity: number;
    meal_plan_meal_id?: number;
    updated_at?: string;
    deleted_at?: string | null;
    exchange_group?: IExchangeGroup;
}

export interface IMealPlanMeal {
    id?: number;
    meal_name?: string;
    sort_order?: number;
    meal_plan_exchanges?: IMealPlanExchange[];
    meal_plan_id?: number;
    updated_at?: string;
    deleted_at?: string | null;
}

export interface IMealPlan {
    id?: number;
    name?: string;
    description?: string;
    created_by?: number;
    is_template?: boolean;
    meal_plan_meals?: IMealPlanMeal[];
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
}

