import { IFoodItem } from '../foods/types';
import { IExchangeGroup } from '../exchange-groups/types';

export interface IMenu {
    id: number;
    meal_plan_id: number;
    client_id: number;
    start_date: string;
    end_date: string;
    created_at: string;
    created_by: number | null;
    is_reusable: boolean;
    description_: string;
    title: string;
    menu_id_selected_client?: number;
    assigned_date?: string;
    assigned_start_date?: string;
    assigned_end_date?: string;
    alternate_menu_ids?: number[];
    menu_meals: IMenuMeal[];
}

export interface IMenuMeal {
    id: number;
    menu_id: number;
    name: string;
    source_meal_plan_meal_id: number;
    // Mapping the complex key from the raw response
    menu_items_menu_items_menu_meal_idTomenu_meals: IMenuItem[];
}

export interface IMenuItem {
    id: number;
    menu_meal_id: number;
    exchange_group_id: number;
    food_id: number;
    serving_unit_id: number | null;
    quantity: number;
    recipe_id: number | null;
    foods: IFoodItem;
    exchange_groups: IExchangeGroup;
    equivalent_quantity: number;
}

export interface IMenuPoolMeal extends IMenuMeal {
    total_calories: number;
    total_glycemic_load: number;
    total_micronutrients: Array<{
        id: number;
        name: string;
        unit: string;
        category: string;
        amount: number;
    }>;
}

export interface IMenuPool extends Omit<IMenu, 'menu_meals'> {
    menu_meals: IMenuPoolMeal[];
}

export interface SaveMenuDraftDto {
    professional_id: number;
    client_id: number | null;
    json_data: any;
    is_ai_generated?: boolean;
}

export interface IMenuDraft {
    id: string; // UUID
    professional: number;
    client_id: string | number | null; // DB view says (Null), ID might be int or uuid? User screenshot shows client_id (Null).
    // Usually client_id is int. But let's allow string just in case.
    json_data: any;
    last_autosave: string; // datetime
    is_ai_generated: boolean;
    status: string;
    applied_at: string | null;
}



export interface GenerateAiMenuDto {
    client_id: number;
    extra_notes?: string;
    language?: string;
    data_system?: string;
    model?: string;
}
