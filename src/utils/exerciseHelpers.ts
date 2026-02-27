/**
 * Centralized exercise-related utilities
 * Previously duplicated across multiple components
 */

import type { DayExercise, Exercise } from '../types';
import i18n from '../i18n';

const getTrainingBaseUrl = (): string => {
  const configured = import.meta.env.VITE_TRAINING_API_URL as string | undefined;
  return configured ? configured.replace(/\/+$/, '') : '';
};

/**
 * Resolve exercise media URLs from either:
 * - absolute URLs (R2/CDN or external) -> unchanged
 * - legacy relative /static URLs -> prefixed with training API origin
 */
export function resolveExerciseMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  if (/^https?:\/\//i.test(url) || url.startsWith('//')) {
    return url;
  }

  if (url.startsWith('/static/')) {
    const base = getTrainingBaseUrl();
    return base ? `${base}${url}` : url;
  }

  return url;
}

/**
 * Get image URL with cache-busting timestamp
 * Used in KanbanExerciseCard, ExerciseCard, etc.
 */
export function getExerciseImageUrl(
  url: string | null | undefined,
  updatedAt?: string | Date | number
): string | null {
  const resolvedUrl = resolveExerciseMediaUrl(url);
  if (!resolvedUrl) return null;
  const timestamp = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  return `${resolvedUrl}${resolvedUrl.includes('?') ? '&' : '?'}t=${timestamp}`;
}

/**
 * Format exercise configuration string
 * e.g., "3x8-12 @ RIR 2"
 */
export function formatExerciseConfig(dayExercise: DayExercise): string {
  const { sets, reps_min, reps_max, effort_type, effort_value } = dayExercise;

  const repsDisplay =
    reps_min === reps_max ? `${reps_min}` : `${reps_min}-${reps_max}`;

  const effortDisplay = formatEffortType(effort_type, effort_value);

  return `${sets}x${repsDisplay} @ ${effortDisplay}`;
}

/**
 * Format effort type with value
 */
export function formatEffortType(
  effortType: string | undefined,
  effortValue: number | undefined
): string {
  if (!effortType || effortValue === undefined) return '';

  switch (effortType) {
    case 'RIR':
      return `RIR ${effortValue}`;
    case 'RPE':
      return `RPE ${effortValue}`;
    case 'percentage':
      return `${effortValue}%`;
    default:
      return `${effortType} ${effortValue}`;
  }
}

/**
 * Format rest time in human-readable format
 */
export function formatRestTime(seconds: number | undefined): string {
  if (!seconds) return '0s';

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes}min`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Parse tempo string and validate format
 * Tempo format: "eccentric-pause-concentric-pause" e.g., "3-1-1-0"
 */
export function parseTempo(
  tempo: string | null | undefined
): { eccentric: number; pauseBottom: number; concentric: number; pauseTop: number } | null {
  if (!tempo) return null;

  const parts = tempo.split('-').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;

  return {
    eccentric: parts[0],
    pauseBottom: parts[1],
    concentric: parts[2],
    pauseTop: parts[3],
  };
}

/**
 * Calculate total time under tension for a tempo
 */
export function calculateTUT(tempo: string | null | undefined): number {
  const parsed = parseTempo(tempo);
  if (!parsed) return 0;
  return parsed.eccentric + parsed.pauseBottom + parsed.concentric + parsed.pauseTop;
}

/**
 * Get display name for muscle group (translate key to display text)
 * This will be replaced with i18n in the next phase
 */
export const MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: 'Pecho',
  upper_back: 'Espalda Alta',
  lats: 'Dorsales',
  lower_back: 'Espalda Baja',
  anterior_deltoid: 'Deltoides Anterior',
  lateral_deltoid: 'Deltoides Lateral',
  posterior_deltoid: 'Deltoides Posterior',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  quadriceps: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos',
  calves: 'Pantorrillas',
  abs: 'Abdominales',
  obliques: 'Oblicuos',
  cardio: 'Cardio',
};

export function getMuscleGroupLabel(muscleGroup: string | undefined): string {
  if (!muscleGroup) return 'Desconocido';
  return MUSCLE_GROUP_LABELS[muscleGroup] || muscleGroup;
}

/**
 * Get display name for exercise type
 */
export const EXERCISE_TYPE_LABELS: Record<string, string> = {
  compound: 'Multiarticular',
  isolation: 'Monoarticular',
};

export function getExerciseTypeLabel(exerciseType: string | undefined): string {
  if (!exerciseType) return '';
  return EXERCISE_TYPE_LABELS[exerciseType] || exerciseType;
}

/**
 * Get display name for difficulty level
 */
export const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

export function getDifficultyLabel(difficulty: string | undefined): string {
  if (!difficulty) return '';
  return DIFFICULTY_LABELS[difficulty] || difficulty;
}

/**
 * Get display name for resistance profile
 */
export const RESISTANCE_PROFILE_LABELS: Record<string, string> = {
  ascending: 'Ascendente',
  descending: 'Descendente',
  flat: 'Plano',
  bell: 'Campana',
};

export function getResistanceProfileLabel(profile: string | undefined): string {
  if (!profile) return '';
  return RESISTANCE_PROFILE_LABELS[profile] || profile;
}

/**
 * Sort exercises by order_index
 */
export function sortExercisesByOrder(exercises: DayExercise[]): DayExercise[] {
  return [...exercises].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

/**
 * Calculate total volume for a training day (sets * avg reps)
 * Solo cuenta ejercicios con reps (ignora cardio/time-based)
 */
export function calculateDayVolume(exercises: DayExercise[]): number {
  return exercises.reduce((total, ex) => {
    // Ignorar ejercicios sin reps (cardio/time-based)
    if (ex.reps_min == null || ex.reps_max == null) return total;
    const avgReps = (ex.reps_min + ex.reps_max) / 2;
    return total + ex.sets * avgReps;
  }, 0);
}

/**
 * Calculate total sets for a training day
 */
export function calculateDaySets(exercises: DayExercise[]): number {
  return exercises.reduce((total, ex) => total + ex.sets, 0);
}

/**
 * Get current language from i18n
 * Returns 'es' or 'en'
 */
export function getCurrentLanguage(): 'es' | 'en' {
  const lang = i18n.language || 'es';
  // Handle cases like 'es-ES' or 'en-US'
  return lang.startsWith('en') ? 'en' : 'es';
}

/**
 * Get exercise name in the specified language (or current language if not specified)
 * Falls back to name_en (English) if translation is not available
 */
export function getExerciseName(
  exercise: Exercise | null | undefined,
  language?: 'es' | 'en'
): string {
  if (!exercise) return '';

  const lang = language || getCurrentLanguage();

  if (lang === 'es' && exercise.name_es) {
    return exercise.name_es;
  }

  // Fallback to English name (always available)
  return exercise.name_en || '';
}

/**
 * Get exercise description in the specified language (or current language if not specified)
 * Falls back to description_en (English) if translation is not available
 */
export function getExerciseDescription(
  exercise: Exercise | null | undefined,
  language?: 'es' | 'en'
): string {
  if (!exercise) return '';

  const lang = language || getCurrentLanguage();

  if (lang === 'es' && exercise.description_es) {
    return exercise.description_es;
  }

  // Fallback to English description
  return exercise.description_en || '';
}

/**
 * Check if an exercise has translation for the specified language
 */
export function hasTranslation(
  exercise: Exercise | null | undefined,
  language?: 'es' | 'en'
): boolean {
  if (!exercise) return false;

  const lang = language || getCurrentLanguage();

  if (lang === 'es') {
    return !!exercise.name_es;
  }
  return !!exercise.name_en;
}

export default {
  getExerciseImageUrl,
  formatExerciseConfig,
  formatEffortType,
  formatRestTime,
  parseTempo,
  calculateTUT,
  getMuscleGroupLabel,
  getExerciseTypeLabel,
  getDifficultyLabel,
  getResistanceProfileLabel,
  sortExercisesByOrder,
  calculateDayVolume,
  calculateDaySets,
  getCurrentLanguage,
  getExerciseName,
  getExerciseDescription,
  hasTranslation,
};
