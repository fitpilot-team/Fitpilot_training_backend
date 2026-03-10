import { nutritionApi } from "@/api/clients/nutrition.client";
import { IMealPlan } from "./types";
import { assertNutritionSubscriptionAccess } from '@/features/subscriptions/nutritionAccess';

/**
 * Fetches all meal plans.
 * Endpoint: /v1/meal-plans
 */
export const getMealPlans = async (): Promise<IMealPlan[]> => {
    assertNutritionSubscriptionAccess();
    const { data } = await nutritionApi.get<IMealPlan[]>("/v1/meal-plans");
    return data;
};

/**
 * Fetches a single meal plan by ID.
 * Endpoint: /v1/meal-plans/{id}
 */
export const getMealPlanById = async (id: number): Promise<IMealPlan> => {
    assertNutritionSubscriptionAccess();
    const { data } = await nutritionApi.get<IMealPlan>(`/v1/meal-plans/${id}`);
    return data;
};

/**
 * Creates a new meal plan.
 * Endpoint: /v1/meal-plans
 */
export const createMealPlan = async (mealPlanData: IMealPlan): Promise<IMealPlan> => {
    assertNutritionSubscriptionAccess();
    const { data } = await nutritionApi.post<IMealPlan>("/v1/meal-plans", mealPlanData);
    return data;
};

/**
 * Updates an existing meal plan.
 * Endpoint: /v1/meal-plans/{id}
 */
export const updateMealPlan = async (id: number, mealPlanData: IMealPlan): Promise<IMealPlan> => {
    assertNutritionSubscriptionAccess();
    const { data } = await nutritionApi.patch<IMealPlan>(`/v1/meal-plans/${id}`, mealPlanData);
    return data;
};

/**
 * Deletes a meal plan.
 * Endpoint: /v1/meal-plans/{id}
 */
export const deleteMealPlan = async (id: number): Promise<void> => {
    assertNutritionSubscriptionAccess();
    await nutritionApi.delete(`/v1/meal-plans/${id}`);
};
