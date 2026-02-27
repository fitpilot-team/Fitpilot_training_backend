import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { TrashIcon, QuestionMarkCircleIcon, HeartIcon } from '@heroicons/react/24/outline';
import { TEMPO_OPTIONS, SET_TYPE_OPTIONS } from '../../constants/exerciseConfig';
import type { DayExercise, Exercise, SetType, ExercisePhase } from '../../types';
import { getExerciseName, getExerciseDescription, getExerciseImageUrl } from '../../utils/exerciseHelpers';

interface ExerciseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayExercise: DayExercise | null;
  exercise: Exercise | null;
  onSave: (config: ExerciseConfigData) => void;
  onDelete?: () => void;
  initialPhase?: ExercisePhase;
}

// Configuración unificada para todos los tipos de ejercicios
// Incluye campos de fuerza y cardio - los campos no utilizados se ignoran según el tipo
export interface ExerciseConfigData {
  // Campos para ejercicios de FUERZA (reps pueden ser null para cardio)
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  rest_seconds: number;
  tempo: string | null;
  set_type: SetType | null;
  effort_type: 'RIR' | 'RPE' | 'percentage';
  effort_value: number;
  notes: string;
  phase: ExercisePhase;

  // Campos para ejercicios de CARDIO (LISS/MISS/HIIT)
  duration_seconds?: number | null;
  intensity_zone?: number | null;
  distance_meters?: number | null;
  target_calories?: number | null;

  // Campos específicos para HIIT
  intervals?: number | null;
  work_seconds?: number | null;
  interval_rest_seconds?: number | null;
}

// Opciones de zona de intensidad
const INTENSITY_ZONE_OPTIONS = [
  { value: 1, label: 'Z1', description: 'recovery', hrRange: '50-60%' },
  { value: 2, label: 'Z2', description: 'endurance', hrRange: '60-70%' },
  { value: 3, label: 'Z3', description: 'aerobic', hrRange: '70-80%' },
  { value: 4, label: 'Z4', description: 'threshold', hrRange: '80-90%' },
  { value: 5, label: 'Z5', description: 'maximal', hrRange: '90-100%' },
];

// Estado unificado interno con todos los campos posibles
interface UnifiedConfig {
  // Strength fields
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
  tempo: string;
  set_type: SetType | null;
  effort_type: 'RIR' | 'RPE' | 'percentage';
  effort_value: number;
  phase: ExercisePhase;
  // Cardio fields
  duration_seconds: number;
  intensity_zone: number;
  distance_meters: number | null;
  target_calories: number | null;
  // HIIT fields
  intervals: number;
  work_seconds: number;
  interval_rest_seconds: number;
  // Common
  notes: string;
}

const DEFAULT_UNIFIED_CONFIG: UnifiedConfig = {
  // Strength
  sets: 3,
  reps_min: 8,
  reps_max: 12,
  rest_seconds: 60,
  tempo: 'standard',
  set_type: 'straight',
  effort_type: 'RIR',
  effort_value: 2,
  phase: 'main',
  // Cardio
  duration_seconds: 1800,
  intensity_zone: 2,
  distance_meters: null,
  target_calories: null,
  // HIIT
  intervals: 8,
  work_seconds: 30,
  interval_rest_seconds: 30,
  // Common
  notes: '',
};

export function ExerciseConfigModal({
  isOpen,
  onClose,
  dayExercise,
  exercise,
  onSave,
  onDelete,
  initialPhase = 'main',
}: ExerciseConfigModalProps) {
  const { t } = useTranslation(['training', 'exercises']);
  const [config, setConfig] = useState<UnifiedConfig>(DEFAULT_UNIFIED_CONFIG);

  // Track if we've initialized the modal to prevent unwanted resets
  const hasInitialized = useRef(false);

  // Determinar el tipo de configuración basado en el ejercicio
  const exerciseClass = exercise?.exercise_class || 'strength';
  const cardioSubclass = exercise?.cardio_subclass;
  const isCardio = exerciseClass === 'cardio';
  const isHiit = isCardio && cardioSubclass === 'hiit';
  const isSteadyState = isCardio && (cardioSubclass === 'liss' || cardioSubclass === 'miss');

  // Reset initialization flag when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      hasInitialized.current = false;
      console.log('[ExerciseConfigModal] Modal opened, reset initialization flag');
    }
  }, [isOpen]);

  // Initialize form with dayExercise data when it changes
  // Only initialize once when modal opens to prevent overwriting user changes
  useEffect(() => {
    console.log('[ExerciseConfigModal] useEffect triggered', {
      isOpen,
      hasInitialized: hasInitialized.current,
      dayExerciseId: dayExercise?.id,
      dayExerciseDuration: dayExercise?.duration_seconds,
      currentConfigDuration: config.duration_seconds,
      isHiit,
      isSteadyState,
      cardioSubclass,
    });

    // Only initialize if modal is open and we haven't initialized yet
    if (!isOpen || hasInitialized.current) {
      console.log('[ExerciseConfigModal] Skipping initialization - modal closed or already initialized');
      return;
    }

    if (dayExercise) {
      console.log('[ExerciseConfigModal] Initializing with existing dayExercise', {
        id: dayExercise.id,
        duration_seconds: dayExercise.duration_seconds,
      });
      setConfig({
        // Strength fields
        sets: dayExercise.sets || 3,
        reps_min: dayExercise.reps_min || 8,
        reps_max: dayExercise.reps_max || 12,
        rest_seconds: dayExercise.rest_seconds || 60,
        tempo: dayExercise.tempo || 'standard',
        set_type: dayExercise.set_type || 'straight',
        effort_type: (dayExercise.effort_type as 'RIR' | 'RPE' | 'percentage') || 'RIR',
        effort_value: dayExercise.effort_value || 2,
        phase: dayExercise.phase || 'main',
        // Cardio fields
        duration_seconds: dayExercise.duration_seconds || 1800,
        intensity_zone: dayExercise.intensity_zone || 2,
        distance_meters: dayExercise.distance_meters,
        target_calories: dayExercise.target_calories,
        // HIIT fields
        intervals: dayExercise.intervals || 8,
        work_seconds: dayExercise.work_seconds || 30,
        interval_rest_seconds: dayExercise.interval_rest_seconds || 30,
        // Common
        notes: dayExercise.notes || '',
      });
    } else {
      // Set defaults based on exercise type
      console.log('[ExerciseConfigModal] Initializing with defaults', {
        isHiit,
        isSteadyState,
        cardioSubclass,
      });
      if (isHiit) {
        setConfig({
          ...DEFAULT_UNIFIED_CONFIG,
          duration_seconds: 1200,
          intensity_zone: 4,
          intervals: 8,
          work_seconds: 30,
          interval_rest_seconds: 30,
        });
      } else if (isSteadyState) {
        const defaultDuration = cardioSubclass === 'liss' ? 2400 : 1800;
        console.log('[ExerciseConfigModal] Setting default steady-state duration:', defaultDuration);
        setConfig({
          ...DEFAULT_UNIFIED_CONFIG,
          duration_seconds: defaultDuration, // 40min LISS, 30min MISS
          intensity_zone: cardioSubclass === 'liss' ? 2 : 3,
        });
      } else {
        setConfig({
          ...DEFAULT_UNIFIED_CONFIG,
          phase: initialPhase,
        });
      }
    }

    hasInitialized.current = true;
    console.log('[ExerciseConfigModal] Initialization complete');
  }, [isOpen, dayExercise, isHiit, isSteadyState, cardioSubclass, initialPhase]);

  const handleSave = () => {
    console.log('[ExerciseConfigModal] Saving config', {
      duration_seconds: config.duration_seconds,
      duration_minutes: Math.floor(config.duration_seconds / 60),
      full_config: config,
    });
    onSave(config);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete && confirm(t('training:configModal.confirmDelete'))) {
      onDelete();
      onClose();
    }
  };

  // Get color based on muscle category
  const getMuscleCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      chest: 'bg-red-100 text-red-800',
      back: 'bg-blue-100 text-blue-800',
      shoulders: 'bg-yellow-100 text-yellow-800',
      arms: 'bg-purple-100 text-purple-800',
      legs: 'bg-green-100 text-green-800',
      core: 'bg-orange-100 text-orange-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  if (!exercise) return null;

  // Get translated exercise name and description
  const exerciseName = getExerciseName(exercise);
  const exerciseDescription = getExerciseDescription(exercise);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('training:configModal.title')} size="xl">
      <div className="space-y-6">
        {/* Exercise Info Header */}
        <div className="flex items-start gap-6 p-5 bg-gray-50 rounded-lg">
          {/* Anatomy image takes priority for program design context */}
          {exercise.anatomy_image_url ? (
            <img
              src={getExerciseImageUrl(exercise.anatomy_image_url, exercise.updated_at) ?? undefined}
              alt={t('training:configModal.anatomyOf', { name: exerciseName })}
              className="w-40 h-40 object-contain rounded-lg bg-white border border-gray-200 shadow-sm flex-shrink-0"
            />
          ) : exercise.thumbnail_url || exercise.image_url ? (
            <img
              src={getExerciseImageUrl(exercise.image_url || exercise.thumbnail_url, exercise.updated_at) ?? undefined}
              alt={exerciseName}
              className="w-36 h-36 object-cover rounded-lg flex-shrink-0"
            />
          ) : (
            <div className="w-36 h-36 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-4xl font-bold text-primary-600">
                {exerciseName.charAt(0)}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-xl">{exerciseName}</h3>
            <div className="flex flex-wrap gap-2 mt-3">
              {/* Badge de clase de ejercicio */}
              {isCardio ? (
                <span className="px-2.5 py-1 bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 rounded text-xs font-medium flex items-center gap-1">
                  <HeartIcon className="h-3 w-3" />
                  {cardioSubclass?.toUpperCase() || 'CARDIO'}
                </span>
              ) : (
                <>
                  {exercise.primary_muscles?.map((pm) => (
                    <span
                      key={pm.muscle_id}
                      className={`px-2.5 py-1 rounded text-xs font-medium capitalize ${getMuscleCategoryColor(pm.muscle_category)}`}
                    >
                      {t(`exercises:muscleGroups.${pm.muscle_name}`, { defaultValue: pm.muscle_name?.replace('_', ' ') })}
                    </span>
                  ))}
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                    {exercise.type}
                  </span>
                </>
              )}
              {exercise.equipment_needed && (
                <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                  {exercise.equipment_needed}
                </span>
              )}
            </div>
            {exerciseDescription && (
              <p className="text-sm text-gray-600 mt-3 line-clamp-3">{exerciseDescription}</p>
            )}
          </div>
        </div>

        {/* Configuration Form - Conditional based on exercise type */}
        {isCardio ? (
          /* ========== CARDIO CONFIGURATION ========== */
          <div className="space-y-6">
            {/* Cardio Type Badge */}
            <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
              <HeartIcon className="h-5 w-5 text-orange-500" />
              <span className="font-medium text-orange-700">
                {cardioSubclass === 'hiit'
                  ? t('training:configModal.cardio.hiitMode', { defaultValue: 'HIIT - High Intensity Interval Training' })
                  : cardioSubclass === 'liss'
                    ? t('training:configModal.cardio.lissMode', { defaultValue: 'LISS - Low Intensity Steady State' })
                    : t('training:configModal.cardio.missMode', { defaultValue: 'MISS - Moderate Intensity Steady State' })
                }
              </span>
            </div>

            {isHiit ? (
              /* HIIT Configuration */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Intervals */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      label={t('training:configModal.cardio.intervals', { defaultValue: 'Intervalos' })}
                      value={config.intervals}
                      onChange={(e) => setConfig({ ...config, intervals: parseInt(e.target.value) || 1 })}
                      min={1}
                      max={50}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('training:configModal.cardio.totalDuration', { defaultValue: 'Duración Total' })}
                      </label>
                      <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-600">
                        {Math.floor((config.intervals * (config.work_seconds + config.interval_rest_seconds)) / 60)} min
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      label={t('training:configModal.cardio.workSeconds', { defaultValue: 'Trabajo (seg)' })}
                      value={config.work_seconds}
                      onChange={(e) => setConfig({ ...config, work_seconds: parseInt(e.target.value) || 10 })}
                      min={5}
                      max={300}
                    />
                    <Input
                      type="number"
                      label={t('training:configModal.cardio.restSeconds', { defaultValue: 'Descanso (seg)' })}
                      value={config.interval_rest_seconds}
                      onChange={(e) => setConfig({ ...config, interval_rest_seconds: parseInt(e.target.value) || 10 })}
                      min={5}
                      max={300}
                    />
                  </div>

                  {/* Work/Rest Ratio Display */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">{t('training:configModal.cardio.workRestRatio', { defaultValue: 'Ratio Trabajo:Descanso' })}</p>
                    <p className="text-lg font-bold text-gray-800">
                      {config.work_seconds}:{config.interval_rest_seconds}
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        ({(config.work_seconds / config.interval_rest_seconds).toFixed(1)}:1)
                      </span>
                    </p>
                  </div>
                </div>

                {/* Right Column - Intensity */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        {t('training:configModal.cardio.intensityZone', { defaultValue: 'Zona de Intensidad' })}
                      </label>
                      <div className="relative group">
                        <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                        <div className="absolute hidden group-hover:block left-0 top-6 z-50 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                          {INTENSITY_ZONE_OPTIONS.map((zone) => (
                            <div key={zone.value} className="mb-1">
                              <span className="font-medium text-primary-300">{zone.label}</span>{' '}
                              <span className="text-gray-400">({zone.hrRange}):</span>{' '}
                              <span className="text-gray-300">{t(`training:configModal.cardio.zones.${zone.description}`, { defaultValue: zone.description })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {INTENSITY_ZONE_OPTIONS.map((zone) => (
                        <label
                          key={zone.value}
                          className={`flex flex-col items-center p-3 rounded-lg border cursor-pointer transition-colors ${config.intensity_zone === zone.value
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          <input
                            type="radio"
                            name="intensity_zone"
                            value={zone.value}
                            checked={config.intensity_zone === zone.value}
                            onChange={(e) => setConfig({ ...config, intensity_zone: parseInt(e.target.value) })}
                            className="sr-only"
                          />
                          <span className="text-lg font-bold">{zone.label}</span>
                          <span className="text-[10px] text-gray-500">{zone.hrRange}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('training:configModal.notes')}
                    </label>
                    <textarea
                      value={config.notes}
                      onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      rows={3}
                      placeholder={t('training:configModal.cardio.notesPlaceholderHiit', { defaultValue: 'Ej: Sprints en bicicleta, burpees...' })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* LISS/MISS Configuration */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Duration & Distance */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('training:configModal.cardio.duration', { defaultValue: 'Duración' })}
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={Math.floor(config.duration_seconds / 60)}
                        onChange={(e) => setConfig({ ...config, duration_seconds: (parseInt(e.target.value) || 0) * 60 })}
                        min={5}
                        max={120}
                        className="flex-1"
                      />
                      <span className="text-gray-500 font-medium">min</span>
                    </div>
                    {/* Quick duration buttons */}
                    <div className="flex gap-2 mt-2">
                      {[15, 20, 30, 45, 60].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            console.log('[ExerciseConfigModal] Quick duration button clicked:', mins, 'minutes');
                            setConfig({ ...config, duration_seconds: mins * 60 });
                          }}
                          className={`px-3 py-1 text-xs rounded-full transition-colors ${config.duration_seconds === mins * 60
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                          {mins} min
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('training:configModal.cardio.distance', { defaultValue: 'Distancia (km)' })}
                      </label>
                      <Input
                        type="number"
                        value={config.distance_meters ? config.distance_meters / 1000 : ''}
                        onChange={(e) => setConfig({
                          ...config,
                          distance_meters: e.target.value ? parseFloat(e.target.value) * 1000 : null
                        })}
                        min={0}
                        max={50}
                        step={0.5}
                        placeholder={t('training:configModal.cardio.optional', { defaultValue: 'Opcional' })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('training:configModal.cardio.calories', { defaultValue: 'Calorías' })}
                      </label>
                      <Input
                        type="number"
                        value={config.target_calories || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          target_calories: e.target.value ? parseInt(e.target.value) : null
                        })}
                        min={0}
                        max={2000}
                        placeholder={t('training:configModal.cardio.optional', { defaultValue: 'Opcional' })}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column - Intensity & Notes */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        {t('training:configModal.cardio.intensityZone', { defaultValue: 'Zona de Intensidad' })}
                      </label>
                      <div className="relative group">
                        <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                        <div className="absolute hidden group-hover:block left-0 top-6 z-50 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                          {INTENSITY_ZONE_OPTIONS.map((zone) => (
                            <div key={zone.value} className="mb-1">
                              <span className="font-medium text-primary-300">{zone.label}</span>{' '}
                              <span className="text-gray-400">({zone.hrRange}):</span>{' '}
                              <span className="text-gray-300">{t(`training:configModal.cardio.zones.${zone.description}`, { defaultValue: zone.description })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {INTENSITY_ZONE_OPTIONS.map((zone) => (
                        <label
                          key={zone.value}
                          className={`flex flex-col items-center p-3 rounded-lg border cursor-pointer transition-colors ${config.intensity_zone === zone.value
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          <input
                            type="radio"
                            name="intensity_zone"
                            value={zone.value}
                            checked={config.intensity_zone === zone.value}
                            onChange={(e) => setConfig({ ...config, intensity_zone: parseInt(e.target.value) })}
                            className="sr-only"
                          />
                          <span className="text-lg font-bold">{zone.label}</span>
                          <span className="text-[10px] text-gray-500">{zone.hrRange}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {cardioSubclass === 'liss'
                        ? t('training:configModal.cardio.lissRecommendation', { defaultValue: 'LISS recomendado: Zona 1-2' })
                        : t('training:configModal.cardio.missRecommendation', { defaultValue: 'MISS recomendado: Zona 2-3' })
                      }
                    </p>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('training:configModal.notes')}
                    </label>
                    <textarea
                      value={config.notes}
                      onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      rows={3}
                      placeholder={t('training:configModal.cardio.notesPlaceholderSteady', { defaultValue: 'Ej: Caminata en cinta, bicicleta estática...' })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ========== STRENGTH CONFIGURATION ========== */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Sets and Reps */}
              <div className="grid grid-cols-3 gap-3">
                <Input
                  type="number"
                  label={t('training:configModal.sets')}
                  value={config.sets}
                  onChange={(e) => setConfig({ ...config, sets: parseInt(e.target.value) || 0 })}
                  min={1}
                  max={20}
                />
                <Input
                  type="number"
                  label={t('training:configModal.minReps')}
                  value={config.reps_min}
                  onChange={(e) => setConfig({ ...config, reps_min: parseInt(e.target.value) || 0 })}
                  min={1}
                  max={100}
                />
                <Input
                  type="number"
                  label={t('training:configModal.maxReps')}
                  value={config.reps_max}
                  onChange={(e) => setConfig({ ...config, reps_max: parseInt(e.target.value) || 0 })}
                  min={1}
                  max={100}
                />
              </div>

              {/* Rest */}
              <Input
                type="number"
                label={t('training:configModal.restSeconds')}
                value={config.rest_seconds}
                onChange={(e) => setConfig({ ...config, rest_seconds: parseInt(e.target.value) || 0 })}
                min={0}
                max={600}
              />

              {/* Set Type with Tooltip */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium text-gray-700">{t('training:configModal.setType')}</label>
                  <div className="relative group">
                    <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                    <div className="absolute hidden group-hover:block left-0 top-6 z-50 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                      <p className="font-semibold mb-2">{t('training:configModal.availableSetTypes')}</p>
                      <div className="space-y-1.5">
                        {SET_TYPE_OPTIONS.map((opt) => (
                          <div key={opt.value}>
                            <span className="font-medium text-primary-300">{t(`training:setTypes.${opt.value}.label`)}:</span>{' '}
                            <span className="text-gray-300">{t(`training:setTypes.${opt.value}.description`)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SET_TYPE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${config.set_type === option.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      <input
                        type="radio"
                        name="set_type"
                        value={option.value}
                        checked={config.set_type === option.value}
                        onChange={(e) => setConfig({ ...config, set_type: e.target.value as SetType })}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">{t(`training:setTypes.${option.value}.label`)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Tempo with Tooltip */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium text-gray-700">{t('training:configModal.tempo')}</label>
                  <div className="relative group">
                    <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                    <div className="absolute hidden group-hover:block left-0 top-6 z-50 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                      <p className="font-semibold mb-1">{t('training:configModal.tempoFormat')}</p>
                      <p className="text-gray-400 mb-2 text-[10px]">{t('training:configModal.tempoHelp')}</p>
                      <div className="space-y-1.5">
                        {TEMPO_OPTIONS.map((opt) => (
                          <div key={opt.value}>
                            <span className="font-medium text-primary-300">{t(`training:tempo.${opt.value}.label`)}</span>{' '}
                            <span className="text-gray-400">({opt.tempo}):</span>{' '}
                            <span className="text-gray-300">{t(`training:tempo.${opt.value}.description`)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {TEMPO_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-colors ${config.tempo === option.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      <input
                        type="radio"
                        name="tempo"
                        value={option.value}
                        checked={config.tempo === option.value}
                        onChange={(e) => setConfig({ ...config, tempo: e.target.value })}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">{t(`training:tempo.${option.value}.label`)}</span>
                      <span className="text-xs text-gray-500">{option.tempo}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Effort Type and Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('training:configModal.effortType')}
                  </label>
                  <select
                    value={config.effort_type}
                    onChange={(e) => setConfig({ ...config, effort_type: e.target.value as 'RIR' | 'RPE' | 'percentage' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="RIR">RIR (Reps in Reserve)</option>
                    <option value="RPE">RPE (Rate of Perceived Exertion)</option>
                    <option value="percentage">% of 1RM</option>
                  </select>
                </div>
                <Input
                  type="number"
                  label={config.effort_type === 'percentage' ? '% 1RM' : config.effort_type}
                  value={config.effort_value}
                  onChange={(e) => setConfig({ ...config, effort_value: parseFloat(e.target.value) || 0 })}
                  min={0}
                  max={config.effort_type === 'percentage' ? 100 : 10}
                  step={config.effort_type === 'percentage' ? 5 : 0.5}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('training:configModal.notes')}
                </label>
                <textarea
                  value={config.notes}
                  onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                  placeholder={t('training:configModal.notesPlaceholder')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          {onDelete ? (
            <Button variant="danger" size="sm" onClick={handleDelete}>
              <TrashIcon className="h-4 w-4 mr-2" />
              {t('training:configModal.removeExercise')}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('training:configModal.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {t('training:configModal.saveChanges')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
