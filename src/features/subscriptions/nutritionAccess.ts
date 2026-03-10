import { useAuthStore } from '@/store/newAuthStore';
import {
  assertNutritionSubscriptionAccess as assertNutritionAccessForUser,
  assertTrainingSubscriptionAccess as assertTrainingAccessForUser,
  hasNutritionSubscriptionAccess as hasNutritionAccessForUser,
  hasTrainingSubscriptionAccess as hasTrainingAccessForUser,
} from './planAccess';

const NUTRITION_ERROR_MESSAGE =
  'Necesitas un plan con acceso a nutricion para usar funciones de nutricion.';
const TRAINING_ERROR_MESSAGE =
  'Necesitas un plan con acceso a entrenamiento para usar funciones de entrenamiento.';

const getCurrentUser = () => useAuthStore.getState().user ?? null;

export const NUTRITION_SUBSCRIPTION_ERROR_MESSAGE = NUTRITION_ERROR_MESSAGE;
export const TRAINING_SUBSCRIPTION_ERROR_MESSAGE = TRAINING_ERROR_MESSAGE;

export const hasNutritionSubscriptionAccess = (): boolean =>
  hasNutritionAccessForUser(getCurrentUser());

export const hasTrainingSubscriptionAccess = (): boolean =>
  hasTrainingAccessForUser(getCurrentUser());

export const assertNutritionSubscriptionAccess = () => {
  try {
    assertNutritionAccessForUser(getCurrentUser());
  } catch {
    throw new Error(NUTRITION_ERROR_MESSAGE);
  }
};

export const assertTrainingSubscriptionAccess = () => {
  try {
    assertTrainingAccessForUser(getCurrentUser());
  } catch {
    throw new Error(TRAINING_ERROR_MESSAGE);
  }
};
