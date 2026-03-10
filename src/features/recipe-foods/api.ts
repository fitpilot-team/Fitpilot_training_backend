import { nutritionApi } from '@/api/clients/nutrition.client';
import { IRecipeFood } from './types';

export class RecipeFoodsService {
    static async getByRecipeId(recipeId: number): Promise<IRecipeFood[]> {
        const response = await nutritionApi.get<IRecipeFood[]>(`/v1/recipe-foods/recipe/${recipeId}`);
        return response.data;
    }

    static async getRecipes(): Promise<import('./types').IRecipe[]> {
        const response = await nutritionApi.get<import('./types').IRecipe[]>('/v1/recipes');
        return response.data;
    }
}
