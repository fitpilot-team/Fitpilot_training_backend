import type { DayExercise, TrainingDay, MuscleName, Exercise, ExerciseType } from '../types';

// ============================================================================
// TUCHSCHERER STRESS INDEX CONSTANTS
// Based on Mike Tuchscherer's stress index methodology
// ============================================================================

/**
 * Stress points per set for MULTIARTICULAR exercises by RIR
 * Higher values for multi-joint exercises due to greater systemic stress
 */
export const STRESS_POINTS_MULTI: Record<number, number> = {
  0: 1.4,
  1: 1.2,
  2: 1.0,
  3: 0.8,
  4: 0.6,
  5: 0.4,
};

/**
 * Stress points per set for MONOARTICULAR exercises by RIR
 * Slightly lower values than multiarticular
 */
export const STRESS_POINTS_MONO: Record<number, number> = {
  0: 1.3,
  1: 1.1,
  2: 0.9,
  3: 0.7,
  4: 0.5,
  5: 0.3,
};

/**
 * Converts effort type and value to equivalent RIR
 * RPE 10 = RIR 0, RPE 9 = RIR 1, etc.
 * %1RM: 95%+ = RIR 0, 90-94% = RIR 1, etc.
 */
export function convertToRIR(effortType: string, effortValue: number): number {
  switch (effortType) {
    case 'RIR':
      return Math.min(Math.max(0, Math.round(effortValue)), 6);
    case 'RPE':
      // RPE 10 = RIR 0, RPE 9 = RIR 1, etc.
      return Math.min(Math.max(0, Math.round(10 - effortValue)), 6);
    case 'percentage':
      // Convert percentage to approximate RIR
      if (effortValue >= 95) return 0;
      if (effortValue >= 90) return 1;
      if (effortValue >= 85) return 2;
      if (effortValue >= 80) return 3;
      if (effortValue >= 75) return 4;
      if (effortValue >= 70) return 5;
      return 6;
    default:
      return 2; // Default to RIR 2 (moderate intensity)
  }
}

/**
 * Gets stress points per set based on RIR and exercise type (Tuchscherer method)
 * @param rir - Reps in Reserve (0-5+)
 * @param exerciseType - 'multiarticular' or 'monoarticular'
 * @returns Stress points for one set
 */
export function getStressPointsPerSet(rir: number, exerciseType: ExerciseType): number {
  const clampedRIR = Math.min(Math.max(0, Math.round(rir)), 5);
  const table = exerciseType === 'multiarticular' ? STRESS_POINTS_MULTI : STRESS_POINTS_MONO;
  return table[clampedRIR] ?? table[5]; // Default to RIR 5 if out of range
}

/**
 * Calculates total stress index for an exercise based on sets, RIR, and exercise type
 * @param dayExercise - The day exercise with sets and effort data
 * @param exerciseType - The type of exercise ('multiarticular' or 'monoarticular')
 * @returns Total stress index for this exercise
 */
export function calculateExerciseStressIndex(
  dayExercise: DayExercise,
  exerciseType: ExerciseType = 'multiarticular'
): number {
  const rir = convertToRIR(dayExercise.effort_type, dayExercise.effort_value);
  const pointsPerSet = getStressPointsPerSet(rir, exerciseType);
  return dayExercise.sets * pointsPerSet;
}

export interface DayMetrics {
  dayNumber: number;
  dayName: string;
  effectiveReps: number;
  totalSets: number;
  totalReps: number;
  averageEffort: number;
  stressIndex: number;
  exerciseCount: number;
  isRestDay: boolean;
}

export interface VolumeByMuscleGroup {
  muscleGroup: MuscleName;
  effectiveReps: number;   // Beardsley stimulating reps
  effectiveSets: number;   // Traditional effective sets (primary: 1x, secondary: 0.5x)
  totalSets: number;       // Total sets (primary: 1x, secondary: 0.5x)
  stressIndex: number;     // Tuchscherer stress index (primary: 1x, secondary: 0.5x)
  label: string;
}

export interface MicrocycleMetrics {
  weekNumber: number;
  totalEffectiveReps: number;
  totalSets: number;
  averageStressIndex: number;
  trainingDays: number;
  restDays: number;
  dailyMetrics: DayMetrics[];
  volumeByMuscleGroup: VolumeByMuscleGroup[];
}

// ============================================================================
// RP VOLUME LANDMARKS (Renaissance Periodization)
// Based on Dr. Mike Israetel's research on hypertrophy training volume
// ============================================================================

/**
 * Volume landmarks for a muscle group (sets per week)
 * - mv: Maintenance Volume - minimum to maintain muscle
 * - mev: Minimum Effective Volume - minimum to grow
 * - mav: Maximum Adaptive Volume - optimal range for growth
 * - mrv: Maximum Recoverable Volume - upper limit before overtraining
 */
export interface VolumeLandmarks {
  mv: number;
  mev: number;
  mav: [number, number];
  mrv: number;
}

/**
 * RP Volume Landmarks by muscle group
 * Source: Renaissance Periodization (2023-2024)
 * Note: Values are for DIRECT sets per week
 */
export const RP_VOLUME_LANDMARKS: Record<MuscleName, VolumeLandmarks> = {
  // Pecho
  chest: { mv: 4, mev: 6, mav: [12, 20], mrv: 22 },

  // Espalda
  upper_back: { mv: 0, mev: 0, mav: [12, 20], mrv: 26 },  // Traps
  lats: { mv: 8, mev: 10, mav: [14, 22], mrv: 25 },       // Back
  lower_back: { mv: 0, mev: 0, mav: [6, 10], mrv: 12 },   // Grouped with glutes/core

  // Hombros
  anterior_deltoid: { mv: 0, mev: 0, mav: [6, 8], mrv: 12 },    // Front Delts (indirect from pressing)
  posterior_deltoid: { mv: 0, mev: 8, mav: [16, 22], mrv: 26 }, // Rear/Side Delts

  // Brazos
  biceps: { mv: 5, mev: 8, mav: [14, 20], mrv: 26 },
  triceps: { mv: 4, mev: 6, mav: [10, 14], mrv: 18 },
  forearms: { mv: 0, mev: 0, mav: [6, 10], mrv: 14 },  // Estimated (similar to small muscles)

  // Piernas
  quadriceps: { mv: 6, mev: 8, mav: [12, 18], mrv: 20 },
  hamstrings: { mv: 4, mev: 6, mav: [10, 16], mrv: 20 },
  glutes: { mv: 0, mev: 0, mav: [4, 12], mrv: 16 },
  calves: { mv: 6, mev: 8, mav: [12, 16], mrv: 20 },
  adductors: { mv: 0, mev: 0, mav: [4, 12], mrv: 16 },  // Grouped with glutes
  tibialis: { mv: 0, mev: 0, mav: [6, 10], mrv: 14 },   // Grouped with calves

  // Core
  abs: { mv: 0, mev: 0, mav: [16, 20], mrv: 25 },
  obliques: { mv: 0, mev: 0, mav: [16, 20], mrv: 25 },  // Grouped with abs
};

/**
 * Volume level based on RP landmarks (5 levels)
 */
export type VolumeLevelRP = 'maintenance' | 'suboptimal' | 'optimal' | 'overreaching' | 'excessive';

/**
 * Determines volume level for a muscle based on RP Volume Landmarks
 * @param muscleName - The muscle group
 * @param sets - Total sets per week for that muscle
 * @returns Volume level classification
 */
export function getVolumeLevelRP(muscleName: MuscleName, sets: number): VolumeLevelRP {
  const landmarks = RP_VOLUME_LANDMARKS[muscleName];
  if (!landmarks) return 'optimal';

  if (sets < landmarks.mev) return 'maintenance';    // Below MEV - maintaining only
  if (sets < landmarks.mav[0]) return 'suboptimal';  // Growing but not optimal
  if (sets <= landmarks.mav[1]) return 'optimal';    // Optimal growth zone
  if (sets <= landmarks.mrv) return 'overreaching';  // Approaching limit
  return 'excessive';                                 // Over MRV - overtraining risk
}

/**
 * Gets the color for RP volume level
 */
export function getVolumeLevelColorRP(level: VolumeLevelRP): string {
  switch (level) {
    case 'maintenance': return '#f59e0b'; // Amber - just maintaining
    case 'suboptimal': return '#84cc16';  // Lime - growing but not optimal
    case 'optimal': return '#22c55e';     // Green - optimal growth
    case 'overreaching': return '#f97316'; // Orange - approaching limit
    case 'excessive': return '#ef4444';   // Red - overtraining risk
  }
}

/**
 * Gets the label for RP volume level
 */
export function getVolumeLevelLabelRP(level: VolumeLevelRP): string {
  switch (level) {
    case 'maintenance': return 'Maintenance';
    case 'suboptimal': return 'Suboptimal';
    case 'optimal': return 'Optimal';
    case 'overreaching': return 'Near MRV';
    case 'excessive': return 'Excessive';
  }
}

// ============================================================================
// MUSCLE GROUP LABELS
// ============================================================================

// Labels for 16 muscles (matching database)
export const MUSCLE_GROUP_LABELS: Record<MuscleName, string> = {
  // Pecho
  chest: 'Pecho',

  // Espalda
  upper_back: 'Trapecio',
  lats: 'Dorsales',
  lower_back: 'Espalda Baja',

  // Hombros
  anterior_deltoid: 'Deltoides Anterior',
  posterior_deltoid: 'Deltoides Posterior',

  // Brazos
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',

  // Piernas
  quadriceps: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos',
  calves: 'Pantorrillas',
  adductors: 'Aductores',
  tibialis: 'Tibial Anterior',

  // Core
  abs: 'Abdominales',
  obliques: 'Oblicuos',
};

/**
 * Determina si un ejercicio tiene la intensidad suficiente para ser "efectivo"
 * Series efectivas: aquellas con RIR ≤ 3 o RPE ≥ 7 o %1RM ≥ 65%
 * Estas son las series que generan estímulo suficiente para hipertrofia
 */
export function isEffectiveIntensity(effortType: string, effortValue: number): boolean {
  switch (effortType) {
    case 'RIR':
      return effortValue <= 3; // RIR 0, 1, 2, 3 son efectivos
    case 'RPE':
      return effortValue >= 7; // RPE 7, 8, 9, 10 son efectivos
    case 'percentage':
      return effortValue >= 65; // ≥65% 1RM es efectivo
    default:
      return true; // Por defecto asumimos que es efectivo
  }
}

/**
 * Calcula las repeticiones efectivas por set según la teoría de Chris Beardsley.
 * Solo las últimas repeticiones cerca del fallo muscular generan estímulo
 * suficiente para hipertrofia (alto reclutamiento motor + alta tensión mecánica).
 *
 * @returns Número de reps efectivas por set (0-5)
 */
export function getStimulatingRepsPerSet(effortType: string, effortValue: number): number {
  switch (effortType) {
    case 'RIR':
      if (effortValue <= 1) return 5;  // RIR 0-1: máximo estímulo
      if (effortValue === 2) return 4; // RIR 2: alto estímulo
      if (effortValue === 3) return 3; // RIR 3: estímulo moderado
      return 0; // RIR 4+ no genera suficiente estímulo
    case 'RPE':
      if (effortValue >= 9) return 5;  // RPE 9-10: máximo estímulo
      if (effortValue === 8) return 4; // RPE 8: alto estímulo
      if (effortValue === 7) return 3; // RPE 7: estímulo moderado
      return 0; // RPE < 7 no genera suficiente estímulo
    case 'percentage':
      if (effortValue >= 85) return 5;  // ≥85% 1RM: máximo estímulo
      if (effortValue >= 75) return 4;  // 75-84%: alto estímulo
      if (effortValue >= 65) return 3;  // 65-74%: estímulo moderado
      return 0; // <65% no genera suficiente estímulo
    default:
      return 3; // valor conservador por defecto
  }
}

/**
 * Calcula el total de repeticiones efectivas de un ejercicio según Beardsley.
 * Las reps efectivas son el mínimo entre las reps realizadas y las reps estimulantes
 * por la proximidad al fallo.
 *
 * Ejemplo: 3 sets × 10 reps con RIR 2 = 3 × min(10, 4) = 3 × 4 = 12 reps efectivas
 */
export function getStimulatingReps(exercise: DayExercise): number {
  // Ejercicios sin reps (cardio/time-based) no tienen reps estimulantes
  if (exercise.reps_min == null || exercise.reps_max == null) return 0;

  const stimRepsPerSet = getStimulatingRepsPerSet(exercise.effort_type, exercise.effort_value);
  if (stimRepsPerSet === 0) return 0;

  const avgReps = (exercise.reps_min + exercise.reps_max) / 2;
  // Las reps efectivas son el mínimo entre las reps del set y las reps estimulantes
  const effectiveRepsPerSet = Math.min(avgReps, stimRepsPerSet);

  return Math.round(exercise.sets * effectiveRepsPerSet);
}

/**
 * Calcula el volumen total de un ejercicio (sets × reps promedio)
 * Se mantiene para el cálculo del stress index
 * Retorna 0 para ejercicios sin reps (cardio/time-based)
 */
export function calculateExerciseVolume(exercise: DayExercise): number {
  if (exercise.reps_min == null || exercise.reps_max == null) return 0;
  const avgReps = (exercise.reps_min + exercise.reps_max) / 2;
  return exercise.sets * avgReps;
}

/**
 * Normaliza el effort value a una escala 0-10
 * RIR: 0 = máximo esfuerzo, 4+ = bajo esfuerzo → invertir
 * RPE: 10 = máximo esfuerzo, 1 = bajo esfuerzo → ya normalizado
 * Percentage: 100% = máximo, 50% = medio → dividir por 10
 */
export function normalizeEffort(effortType: string, effortValue: number): number {
  switch (effortType) {
    case 'RIR':
      // RIR 0 = 10, RIR 4 = 6, RIR 5+ = 5
      return Math.max(0, 10 - effortValue);
    case 'RPE':
      // RPE ya está en escala 1-10
      return effortValue;
    case 'percentage':
      // Convertir % a escala 0-10
      return effortValue / 10;
    default:
      return 5; // Valor medio por defecto
  }
}

/**
 * Calcula el stress index de un día de entrenamiento
 * Fórmula: (volumen_total × esfuerzo_promedio) / 100
 * Escala resultante: 0-100
 */
export function calculateDayStressIndex(exercises: DayExercise[]): number {
  if (exercises.length === 0) return 0;

  let totalVolume = 0;
  let totalEffort = 0;

  exercises.forEach((ex) => {
    const volume = calculateExerciseVolume(ex);
    const normalizedEffort = normalizeEffort(ex.effort_type, ex.effort_value);
    totalVolume += volume;
    totalEffort += normalizedEffort * volume; // Weighted by volume
  });

  // Weighted average effort
  const avgEffort = totalVolume > 0 ? totalEffort / totalVolume : 0;

  // Stress index: volumen × esfuerzo normalizado
  // Normalizado para que valores típicos estén en rango 0-100
  const stressIndex = (totalVolume * avgEffort) / 50;

  return Math.min(100, Math.round(stressIndex));
}

/**
 * Calcula las métricas de un día de entrenamiento
 */
export function calculateDayMetrics(day: TrainingDay): DayMetrics {
  const allExercises = day.exercises || [];
  // Filter out warm-up exercises for metrics (only count main and cooldown)
  const exercises = allExercises.filter(ex => ex.phase !== 'warmup');

  if (day.rest_day || exercises.length === 0) {
    return {
      dayNumber: day.day_number,
      dayName: day.name || `Día ${day.day_number}`,
      effectiveReps: 0,
      totalSets: 0,
      totalReps: 0,
      averageEffort: 0,
      stressIndex: 0,
      exerciseCount: 0,
      isRestDay: day.rest_day,
    };
  }

  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets, 0);
  const effectiveReps = exercises.reduce((sum, ex) => sum + getStimulatingReps(ex), 0);
  const totalReps = exercises.reduce((sum, ex) => {
    // Ignorar ejercicios sin reps (cardio/time-based)
    if (ex.reps_min == null || ex.reps_max == null) return sum;
    const avgReps = (ex.reps_min + ex.reps_max) / 2;
    return sum + ex.sets * avgReps;
  }, 0);

  const avgEffort = exercises.reduce((sum, ex) => {
    return sum + normalizeEffort(ex.effort_type, ex.effort_value);
  }, 0) / exercises.length;

  return {
    dayNumber: day.day_number,
    dayName: day.name || `Día ${day.day_number}`,
    effectiveReps,
    totalSets,
    totalReps: Math.round(totalReps),
    averageEffort: Math.round(avgEffort * 10) / 10,
    stressIndex: calculateDayStressIndex(exercises),
    exerciseCount: exercises.length,
    isRestDay: false,
  };
}

/**
 * Options for volume calculation
 */
export interface VolumeCalculationOptions {
  /** Whether to count secondary muscles (with 0.5x multiplier). Default: true */
  countSecondaryMuscles: boolean;
}

/**
 * Calculates effective reps and sets by muscle
 * - effectiveReps: Beardsley stimulating reps (last 5 reps near failure)
 * - effectiveSets: Sets with effective intensity (RIR ≤ 3, RPE ≥ 7, %1RM ≥ 65%)
 *   - Primary muscles: 1x sets
 *   - Secondary muscles: 0.5x sets (if enabled) or 0x (if disabled)
 * @param days - Training days with exercises (each DayExercise should have exercise.primary_muscles and exercise.secondary_muscles)
 * @param exerciseCatalog - Optional exercise catalog for muscle lookup when exercise data is not populated
 * @param options - Calculation options (countSecondaryMuscles toggle)
 */
export function calculateVolumeByMuscleGroup(
  days: TrainingDay[],
  exerciseCatalog?: Exercise[],
  options: VolumeCalculationOptions = { countSecondaryMuscles: true }
): VolumeByMuscleGroup[] {
  const volumeMap: Record<string, { effectiveReps: number; effectiveSets: number; totalSets: number; stressIndex: number }> = {};

  // Create exercise map for quick lookup
  const exerciseMap = new Map<string, Exercise>();
  exerciseCatalog?.forEach((ex) => {
    exerciseMap.set(ex.id, ex);
  });

  // Secondary muscle multiplier based on options
  const secondaryMultiplier = options.countSecondaryMuscles ? 0.5 : 0;

  days.forEach((day) => {
    if (day.rest_day) return;

    (day.exercises || []).forEach((dayEx) => {
      // Skip warm-up exercises for volume calculation
      if (dayEx.phase === 'warmup') return;

      // Get the full exercise data (from populated field or catalog)
      const exercise = dayEx.exercise || exerciseMap.get(dayEx.exercise_id);
      if (!exercise) return;

      const effectiveReps = getStimulatingReps(dayEx);
      // Calculate effective sets: all sets if intensity is effective, 0 otherwise
      const effectiveSets = isEffectiveIntensity(dayEx.effort_type, dayEx.effort_value) ? dayEx.sets : 0;

      // Calculate stress index using Tuchscherer method
      const exerciseType: ExerciseType = exercise.type || 'multiarticular';
      const stressIndex = calculateExerciseStressIndex(dayEx, exerciseType);

      // Process primary muscles (full contribution: 1x)
      exercise.primary_muscles.forEach((pm) => {
        const muscleName = pm.muscle_name;
        if (!volumeMap[muscleName]) {
          volumeMap[muscleName] = { effectiveReps: 0, effectiveSets: 0, totalSets: 0, stressIndex: 0 };
        }
        volumeMap[muscleName].effectiveReps += effectiveReps;
        volumeMap[muscleName].effectiveSets += effectiveSets;
        volumeMap[muscleName].totalSets += dayEx.sets;
        volumeMap[muscleName].stressIndex += stressIndex;
      });

      // Process secondary muscles (contribution based on options)
      if (secondaryMultiplier > 0) {
        exercise.secondary_muscles.forEach((sm) => {
          const muscleName = sm.muscle_name;
          if (!volumeMap[muscleName]) {
            volumeMap[muscleName] = { effectiveReps: 0, effectiveSets: 0, totalSets: 0, stressIndex: 0 };
          }
          volumeMap[muscleName].effectiveReps += Math.round(effectiveReps * secondaryMultiplier);
          volumeMap[muscleName].effectiveSets += effectiveSets * secondaryMultiplier;
          volumeMap[muscleName].totalSets += dayEx.sets * secondaryMultiplier;
          volumeMap[muscleName].stressIndex += stressIndex * secondaryMultiplier;
        });
      }
    });
  });

  return Object.entries(volumeMap).map(([muscle, data]) => ({
    muscleGroup: muscle as MuscleName,
    effectiveReps: data.effectiveReps,
    effectiveSets: Math.round(data.effectiveSets * 10) / 10, // Round to 1 decimal
    totalSets: Math.round(data.totalSets * 10) / 10,
    stressIndex: Math.round(data.stressIndex * 10) / 10, // Round to 1 decimal
    label: MUSCLE_GROUP_LABELS[muscle as MuscleName] || muscle,
  }));
}

/**
 * Calcula todas las métricas de un microciclo
 * @param weekNumber - Número de semana
 * @param trainingDays - Días de entrenamiento con ejercicios
 * @param exerciseCatalog - Lista de ejercicios del catálogo para lookup de músculos
 * @param options - Opciones de cálculo de volumen
 */
export function calculateMicrocycleMetrics(
  weekNumber: number,
  trainingDays: TrainingDay[],
  exerciseCatalog?: Exercise[],
  options: VolumeCalculationOptions = { countSecondaryMuscles: true }
): MicrocycleMetrics {
  const sortedDays = [...trainingDays].sort((a, b) => a.day_number - b.day_number);
  const dailyMetrics = sortedDays.map(calculateDayMetrics);

  const activeDays = dailyMetrics.filter((d) => !d.isRestDay);
  const restDays = dailyMetrics.filter((d) => d.isRestDay).length;

  const totalEffectiveReps = activeDays.reduce((sum, d) => sum + d.effectiveReps, 0);
  const totalSets = activeDays.reduce((sum, d) => sum + d.totalSets, 0);
  const averageStressIndex = activeDays.length > 0
    ? Math.round(activeDays.reduce((sum, d) => sum + d.stressIndex, 0) / activeDays.length)
    : 0;

  return {
    weekNumber,
    totalEffectiveReps,
    totalSets,
    averageStressIndex,
    trainingDays: activeDays.length,
    restDays,
    dailyMetrics,
    volumeByMuscleGroup: calculateVolumeByMuscleGroup(trainingDays, exerciseCatalog, options),
  };
}

/**
 * Obtiene el color del stress index basado en el valor
 */
export function getStressIndexColor(stressIndex: number): string {
  if (stressIndex < 30) return '#22c55e'; // Verde - bajo
  if (stressIndex < 60) return '#eab308'; // Amarillo - moderado
  if (stressIndex < 80) return '#f97316'; // Naranja - alto
  return '#ef4444'; // Rojo - muy alto
}

/**
 * Gets the stress index label
 */
export function getStressIndexLabel(stressIndex: number): string {
  if (stressIndex < 30) return 'Low';
  if (stressIndex < 60) return 'Moderate';
  if (stressIndex < 80) return 'High';
  return 'Very High';
}

/**
 * Weekly effective reps thresholds by muscle (Beardsley theory)
 * Based on scientific literature for hypertrophy
 *
 * Rationale:
 * - Músculos grandes (quads, lats, chest) pueden tolerar más volumen (100-120 reps/semana)
 * - Músculos pequeños (obliques, lower_back) necesitan menos volumen directo
 * - Deltoides anterior recibe trabajo de press de pecho, necesita menos volumen directo
 * - Lower back es propenso a fatiga, rango conservador
 */
export const VOLUME_THRESHOLDS: Record<MuscleName, { low: number; high: number }> = {
  // Pecho
  chest: { low: 50, high: 100 },

  // Espalda (dividido en 3 zonas)
  upper_back: { low: 40, high: 80 },      // Trapecio, romboides, redondo, infraespinoso
  lats: { low: 50, high: 100 },           // Dorsales (más volumen que upper back)
  lower_back: { low: 20, high: 40 },      // Lumbares (menos volumen, más fatiga)

  // Hombros (dividido en 2 cabezas visibles en SVG)
  anterior_deltoid: { low: 30, high: 60 },   // Ya recibe trabajo de press de pecho
  posterior_deltoid: { low: 40, high: 80 },  // Necesita trabajo directo

  // Brazos
  biceps: { low: 40, high: 80 },
  triceps: { low: 40, high: 80 },
  forearms: { low: 30, high: 60 },        // Antebrazos (trabajo indirecto en jalones)

  // Piernas
  quadriceps: { low: 60, high: 120 },     // Músculos grandes, alto volumen
  hamstrings: { low: 50, high: 100 },
  glutes: { low: 50, high: 100 },         // Glúteos (similar a hamstrings)
  calves: { low: 40, high: 80 },
  adductors: { low: 30, high: 60 },       // Trabajo indirecto en sentadillas
  tibialis: { low: 20, high: 40 },        // Músculo pequeño

  // Core
  abs: { low: 30, high: 60 },
  obliques: { low: 20, high: 40 },
};

/**
 * Weekly effective sets thresholds by muscle (Traditional method)
 * Based on scientific literature (10-20 sets/week optimal for most muscle groups)
 */
export const SETS_THRESHOLDS: Record<MuscleName, { low: number; high: number }> = {
  // Pecho
  chest: { low: 10, high: 20 },

  // Espalda
  upper_back: { low: 8, high: 16 },
  lats: { low: 10, high: 20 },
  lower_back: { low: 4, high: 8 },

  // Hombros
  anterior_deltoid: { low: 6, high: 12 },
  posterior_deltoid: { low: 8, high: 16 },

  // Brazos
  biceps: { low: 8, high: 16 },
  triceps: { low: 8, high: 16 },
  forearms: { low: 6, high: 12 },

  // Piernas
  quadriceps: { low: 12, high: 24 },
  hamstrings: { low: 10, high: 20 },
  glutes: { low: 10, high: 20 },   // Glúteos (similar a hamstrings)
  calves: { low: 8, high: 16 },
  adductors: { low: 6, high: 12 },
  tibialis: { low: 4, high: 8 },

  // Core
  abs: { low: 6, high: 12 },
  obliques: { low: 4, high: 8 },
};

/**
 * Weekly stress index thresholds by muscle (Tuchscherer method)
 * Based on optimal training volume converted to stress units
 * Assuming average RIR of 2 (1.0 pts for multi, 0.9 for mono)
 */
export const STRESS_THRESHOLDS: Record<MuscleName, { low: number; high: number }> = {
  // Pecho
  chest: { low: 8, high: 16 },

  // Espalda
  upper_back: { low: 6, high: 12 },
  lats: { low: 8, high: 16 },
  lower_back: { low: 3, high: 6 },

  // Hombros
  anterior_deltoid: { low: 5, high: 10 },
  posterior_deltoid: { low: 6, high: 12 },

  // Brazos
  biceps: { low: 6, high: 12 },
  triceps: { low: 6, high: 12 },
  forearms: { low: 5, high: 10 },

  // Piernas
  quadriceps: { low: 10, high: 20 },
  hamstrings: { low: 8, high: 16 },
  glutes: { low: 8, high: 16 },
  calves: { low: 6, high: 12 },
  adductors: { low: 5, high: 10 },
  tibialis: { low: 3, high: 6 },

  // Core
  abs: { low: 5, high: 10 },
  obliques: { low: 3, high: 6 },
};

export type VolumeLevel = 'low' | 'moderate' | 'high';
export type StressLevel = 'low' | 'moderate' | 'high';

/**
 * Determines volume level for a muscle based on effective reps (Beardsley)
 */
export function getVolumeLevel(muscleName: MuscleName, effectiveReps: number): VolumeLevel {
  const thresholds = VOLUME_THRESHOLDS[muscleName];
  if (!thresholds) return 'moderate';

  if (effectiveReps < thresholds.low) return 'low';
  if (effectiveReps > thresholds.high) return 'high';
  return 'moderate';
}

/**
 * Determines volume level for a muscle based on effective sets (Traditional)
 */
export function getSetsVolumeLevel(muscleName: MuscleName, effectiveSets: number): VolumeLevel {
  const thresholds = SETS_THRESHOLDS[muscleName];
  if (!thresholds) return 'moderate';

  if (effectiveSets < thresholds.low) return 'low';
  if (effectiveSets > thresholds.high) return 'high';
  return 'moderate';
}

/**
 * Obtiene el color basado en el nivel de volumen
 * Verde = bajo (puede necesitar más), Amarillo = óptimo, Rojo = alto (riesgo de sobreentrenamiento)
 */
export function getVolumeLevelColor(level: VolumeLevel): string {
  switch (level) {
    case 'low':
      return '#22c55e'; // Verde - volumen bajo
    case 'moderate':
      return '#eab308'; // Amarillo - volumen óptimo
    case 'high':
      return '#ef4444'; // Rojo - volumen alto
  }
}

/**
 * Gets the volume level label
 */
export function getVolumeLevelLabel(level: VolumeLevel): string {
  switch (level) {
    case 'low':
      return 'Low';
    case 'moderate':
      return 'Optimal';
    case 'high':
      return 'High';
  }
}

/**
 * Determines stress level for a muscle based on Tuchscherer stress index
 */
export function getStressLevel(muscleName: MuscleName, stressIndex: number): StressLevel {
  const thresholds = STRESS_THRESHOLDS[muscleName];
  if (!thresholds) return 'moderate';

  if (stressIndex < thresholds.low) return 'low';
  if (stressIndex > thresholds.high) return 'high';
  return 'moderate';
}

/**
 * Gets the color based on stress level (same as volume for consistency)
 */
export function getStressLevelColor(level: StressLevel): string {
  switch (level) {
    case 'low':
      return '#22c55e'; // Verde - estrés bajo
    case 'moderate':
      return '#eab308'; // Amarillo - estrés óptimo
    case 'high':
      return '#ef4444'; // Rojo - estrés alto
  }
}

/**
 * Gets the stress level label
 */
export function getStressLevelLabel(level: StressLevel): string {
  switch (level) {
    case 'low':
      return 'Low';
    case 'moderate':
      return 'Optimal';
    case 'high':
      return 'High';
  }
}

// ============================================================================
// CARDIO METRICS
// ============================================================================

export interface CardioZoneData {
  zone: number;
  minutes: number;
}

export interface DayCardioMetrics {
  dayNumber: number;
  dayName: string;
  totalMinutes: number;
  caloriesEstimated: number;
  byZone: CardioZoneData[];
}

/**
 * Calculates cardio metrics from exercises in a training day
 * Only considers exercises with duration_seconds (cardio exercises)
 */
export function calculateDayCardioMetrics(day: TrainingDay): DayCardioMetrics {
  const exercises = day.exercises || [];

  // Filter cardio exercises (those with duration_seconds)
  const cardioExercises = exercises.filter(
    (ex) => ex.duration_seconds != null && ex.duration_seconds > 0
  );

  if (cardioExercises.length === 0) {
    return {
      dayNumber: day.day_number,
      dayName: day.name || `Día ${day.day_number}`,
      totalMinutes: 0,
      caloriesEstimated: 0,
      byZone: [],
    };
  }

  // Group by intensity zone
  const zoneMap: Record<number, number> = {};
  let totalMinutes = 0;
  let totalCalories = 0;

  cardioExercises.forEach((ex) => {
    const minutes = Math.round((ex.duration_seconds || 0) / 60);
    const zone = ex.intensity_zone || 2; // Default to zone 2 if not specified

    totalMinutes += minutes;
    totalCalories += ex.target_calories || 0;

    if (!zoneMap[zone]) {
      zoneMap[zone] = 0;
    }
    zoneMap[zone] += minutes;
  });

  // Convert zone map to array
  const byZone: CardioZoneData[] = Object.entries(zoneMap)
    .map(([zone, minutes]) => ({
      zone: parseInt(zone),
      minutes,
    }))
    .sort((a, b) => a.zone - b.zone);

  return {
    dayNumber: day.day_number,
    dayName: day.name || `Día ${day.day_number}`,
    totalMinutes,
    caloriesEstimated: totalCalories,
    byZone,
  };
}

/**
 * Calculates cardio metrics for all days in a microcycle
 */
export function calculateMicrocycleCardioMetrics(days: TrainingDay[]): DayCardioMetrics[] {
  return days
    .sort((a, b) => a.day_number - b.day_number)
    .map(calculateDayCardioMetrics);
}

/**
 * Gets color for cardio intensity zone
 */
export function getCardioZoneColor(zone: number): string {
  if (zone <= 2) return '#22c55e'; // Verde - baja intensidad (Zone 1-2)
  if (zone === 3) return '#eab308'; // Amarillo - moderada (Zone 3)
  return '#ef4444'; // Rojo - alta intensidad (Zone 4-5)
}

/**
 * Gets label for cardio intensity zone
 */
export function getCardioZoneLabel(zone: number): string {
  switch (zone) {
    case 1:
      return 'Recovery';
    case 2:
      return 'Fat Burn';
    case 3:
      return 'Aerobic';
    case 4:
      return 'Threshold';
    case 5:
      return 'VO2 Max';
    default:
      return `Zone ${zone}`;
  }
}
