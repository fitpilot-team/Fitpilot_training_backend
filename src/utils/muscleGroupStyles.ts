/**
 * Centralized muscle styling utilities
 * Supports 15 muscles matching the database schema
 */

import type { MuscleName } from '../types';

export interface MuscleStyle {
  gradient: string;
  glow: string;
  badge: string;
}

export const MUSCLE_STYLES: Record<MuscleName, MuscleStyle> = {
  // Pecho
  chest: {
    gradient: 'from-rose-500 via-red-500 to-orange-500',
    glow: 'shadow-rose-500/25',
    badge: 'bg-rose-500/90',
  },
  // Espalda
  upper_back: {
    gradient: 'from-blue-500 via-indigo-500 to-violet-500',
    glow: 'shadow-blue-500/25',
    badge: 'bg-blue-500/90',
  },
  lats: {
    gradient: 'from-cyan-500 via-teal-500 to-emerald-500',
    glow: 'shadow-cyan-500/25',
    badge: 'bg-cyan-500/90',
  },
  lower_back: {
    gradient: 'from-indigo-500 via-purple-500 to-pink-500',
    glow: 'shadow-indigo-500/25',
    badge: 'bg-indigo-500/90',
  },
  // Hombros
  anterior_deltoid: {
    gradient: 'from-orange-500 via-amber-500 to-yellow-500',
    glow: 'shadow-orange-500/25',
    badge: 'bg-orange-500/90',
  },
  posterior_deltoid: {
    gradient: 'from-yellow-500 via-amber-500 to-orange-500',
    glow: 'shadow-yellow-500/25',
    badge: 'bg-yellow-500/90',
  },
  // Brazos
  biceps: {
    gradient: 'from-purple-500 via-violet-500 to-indigo-500',
    glow: 'shadow-purple-500/25',
    badge: 'bg-purple-500/90',
  },
  triceps: {
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    glow: 'shadow-violet-500/25',
    badge: 'bg-violet-500/90',
  },
  forearms: {
    gradient: 'from-pink-500 via-rose-500 to-red-500',
    glow: 'shadow-pink-500/25',
    badge: 'bg-pink-500/90',
  },
  // Piernas
  quadriceps: {
    gradient: 'from-green-500 via-emerald-500 to-teal-500',
    glow: 'shadow-green-500/25',
    badge: 'bg-green-500/90',
  },
  hamstrings: {
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    glow: 'shadow-emerald-500/25',
    badge: 'bg-emerald-500/90',
  },
  glutes: {
    gradient: 'from-fuchsia-500 via-pink-500 to-rose-500',
    glow: 'shadow-fuchsia-500/25',
    badge: 'bg-fuchsia-500/90',
  },
  calves: {
    gradient: 'from-teal-500 via-cyan-500 to-sky-500',
    glow: 'shadow-teal-500/25',
    badge: 'bg-teal-500/90',
  },
  adductors: {
    gradient: 'from-lime-500 via-green-500 to-emerald-500',
    glow: 'shadow-lime-500/25',
    badge: 'bg-lime-500/90',
  },
  tibialis: {
    gradient: 'from-sky-500 via-blue-500 to-indigo-500',
    glow: 'shadow-sky-500/25',
    badge: 'bg-sky-500/90',
  },
  // Core
  abs: {
    gradient: 'from-yellow-500 via-orange-500 to-red-500',
    glow: 'shadow-yellow-500/25',
    badge: 'bg-yellow-500/90',
  },
  obliques: {
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    glow: 'shadow-amber-500/25',
    badge: 'bg-amber-500/90',
  },
};

// Backwards compatibility alias
export const MUSCLE_GROUP_STYLES = MUSCLE_STYLES;
export type MuscleGroupStyle = MuscleStyle;

const DEFAULT_STYLE: MuscleGroupStyle = {
  gradient: 'from-gray-500 via-slate-500 to-zinc-500',
  glow: 'shadow-gray-500/25',
  badge: 'bg-gray-500/90',
};

/**
 * Get the style for a muscle
 * @param muscleName - The muscle name key (e.g., 'chest', 'biceps')
 * @returns The style object with gradient, glow, and badge classes
 */
export function getMuscleStyle(muscleName: MuscleName | string | undefined | null): MuscleStyle {
  if (!muscleName) return DEFAULT_STYLE;
  return MUSCLE_STYLES[muscleName as MuscleName] || DEFAULT_STYLE;
}

// Backwards compatibility
export const getMuscleGroupStyle = getMuscleStyle;

/**
 * Get just the badge color class for a muscle
 */
export function getMuscleBadgeColor(muscleName: MuscleName | string | undefined | null): string {
  return getMuscleStyle(muscleName).badge;
}

// Backwards compatibility
export const getMuscleGroupBadgeColor = getMuscleBadgeColor;

/**
 * Get just the gradient class for a muscle
 */
export function getMuscleGradient(muscleName: MuscleName | string | undefined | null): string {
  return getMuscleStyle(muscleName).gradient;
}

// Backwards compatibility
export const getMuscleGroupGradient = getMuscleGradient;

/**
 * Get all muscle name keys
 */
export function getAllMuscles(): MuscleName[] {
  return Object.keys(MUSCLE_STYLES) as MuscleName[];
}

// Backwards compatibility
export const getAllMuscleGroups = getAllMuscles;

export default getMuscleStyle;
