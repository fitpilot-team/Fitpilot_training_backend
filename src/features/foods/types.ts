import { IExchangeGroup } from "../exchange-groups/types";
import { IMicronutrient } from "../micronutrients/types";

export interface IFoodCategory {
    id: number;
    name: string;
    icon: string | null;
}

export interface IDataSource {
    id: number;
    name: string;
}

export interface IFoodNutritionValue {
    id: number;
    food_id: number;
    data_source_id: number;
    calories_kcal: string | number;
    protein_g: string | number;
    carbs_g: string | number;
    fat_g: string | number;
    base_serving_size: string | number;
    base_unit: string;
    state: string;
    notes: string | null;
    deleted_at: string | null;
    created_at: string | null;
    fiber_g?: string | number | null;
    glycemic_index?: string | number | null;
    glycemic_load?: string | number | null;
    data_sources: IDataSource;
    food_micronutrient_values: IFoodMicronutrientValue[];
}

export interface IFoodMicronutrientValue {
    id: number;
    food_nutrition_value_id: number;
    micronutrient_id: number;
    amount: string | number;
    created_at: string;
    micronutrients: IMicronutrient;
}

export type IFoodItemMicronutrient = IMicronutrient & { amount: string | number };

export interface IServingUnit {
    id: number;
    food_id: number;
    unit_name: string;
    gram_equivalent: string | number;
    is_exchange_unit: boolean;
}

export interface IFoodItem {
    id: number;
    name: string;
    brand: string | null;
    category_id: number;
    exchange_group_id: number;
    image_url?: string;
    is_recipe: boolean;
    base_serving_size: string | number;
    base_unit: string;
    calories_kcal: string | number | null;
    protein_g: string | number | null;
    carbs_g: string | number | null;
    fat_g: string | number | null;
    fiber_g?: string | number | null;
    glycemic_index?: string | number | null;
    glycemic_load?: string | number | null;
    micronutrients: IFoodItemMicronutrient[];
    food_categories: IFoodCategory;
    exchange_groups: IExchangeGroup;
    food_nutrition_values: IFoodNutritionValue[];
    serving_units: IServingUnit[];
    updated_at?: string;
    deleted_at?: string | null;
}

