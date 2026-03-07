import { useQuery } from '@tanstack/react-query';
import { RecipeFoodsService } from './api';
import { IRecipeFood } from './types';

export const useGetRecipeFoods = (recipeId?: number) => {
    return useQuery<IRecipeFood[], Error>({
        queryKey: ['recipe-foods', recipeId],
        queryFn: () => RecipeFoodsService.getByRecipeId(recipeId!),
        enabled: !!recipeId,
    });
};

export const useGetRecipes = () => {
    return useQuery<import('./types').IRecipe[], Error>({
        queryKey: ['recipes'],
        queryFn: () => RecipeFoodsService.getRecipes(),
    });
};
