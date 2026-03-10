import { IFoodItem, IServingUnit } from '../foods/types';

export interface IRecipe {
    id: number;
    name: string;
    description: string | null;
    created_by: number;
    is_template: boolean;
    created_at: string | null;
    deleted_at: string | null;
}

export interface IRecipeFood {
    id: number;
    recipe_id: number;
    food_id: number;
    serving_unit_id: number;
    quantity: string | number;
    recipes: IRecipe;
    foods: IFoodItem;
    serving_units: IServingUnit;
}
