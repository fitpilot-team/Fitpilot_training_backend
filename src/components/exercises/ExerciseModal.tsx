import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { ImageUpload } from '../common/ImageUpload';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { Exercise, ExerciseType, ExerciseClass, CardioSubclass, ResistanceProfile, Muscle, MuscleCategory } from '../../types';
import { exercisesService, ExerciseCreateData } from '../../services/exercises';
import { musclesService } from '../../services/muscles';
import { getCurrentLanguage } from '../../utils/exerciseHelpers';

// Clases de ejercicio que requieren músculos primarios
const CLASSES_REQUIRING_MUSCLES: ExerciseClass[] = ['strength', 'plyometric'];

interface ExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  exercise?: Exercise | null;
  onSave: (exercise: Exercise) => void;
}

const exerciseTypeValues: ExerciseType[] = ['multiarticular', 'monoarticular'];

const resistanceProfileValues: ResistanceProfile[] = ['ascending', 'descending', 'flat', 'bell_shaped'];

const difficultyValues: string[] = ['beginner', 'intermediate', 'advanced'];

const muscleCategories: { value: MuscleCategory; label: string }[] = [
  { value: 'chest', label: 'Pecho' },
  { value: 'back', label: 'Espalda' },
  { value: 'shoulders', label: 'Hombros' },
  { value: 'arms', label: 'Brazos' },
  { value: 'legs', label: 'Piernas' },
  { value: 'core', label: 'Core' },
];

// Clasificaciones de ejercicio
const exerciseClassValues: ExerciseClass[] = [
  'strength', 'cardio', 'plyometric', 'flexibility',
  'mobility', 'warmup', 'conditioning', 'balance'
];

// Sub-clasificaciones de cardio
const cardioSubclassValues: CardioSubclass[] = ['liss', 'hiit', 'miss'];

const initialFormData: ExerciseCreateData = {
  name_en: '',
  name_es: '',
  type: 'multiarticular',
  resistance_profile: 'flat',
  category: '',
  description_en: '',
  description_es: '',
  equipment_needed: '',
  difficulty_level: 'beginner',
  primary_muscle_ids: [],
  secondary_muscle_ids: [],
  exercise_class: 'strength',
  cardio_subclass: undefined,
  intensity_zone: undefined,
  target_heart_rate_min: undefined,
  target_heart_rate_max: undefined,
  calories_per_minute: undefined,
};

export function ExerciseModal({ isOpen, onClose, exercise, onSave }: ExerciseModalProps) {
  const { t } = useTranslation(['exercises', 'common']);
  const currentLang = getCurrentLanguage(); // 'es' | 'en'
  const [formData, setFormData] = useState<ExerciseCreateData>(initialFormData);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMovementImage, setIsFetchingMovementImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentThumbnail, setCurrentThumbnail] = useState<string | null>(null);

  // Muscles state
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [isLoadingMuscles, setIsLoadingMuscles] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<MuscleCategory | ''>('');

  const isEditing = !!exercise;

  // Load muscles from API
  useEffect(() => {
    const loadMuscles = async () => {
      try {
        const response = await musclesService.getMuscles();
        setMuscles(response.muscles);
      } catch (err) {
        console.error('Error loading muscles:', err);
      } finally {
        setIsLoadingMuscles(false);
      }
    };
    loadMuscles();
  }, []);

  // Filter muscles by selected category
  const filteredMuscles = selectedCategory
    ? muscles.filter((m) => m.muscle_category === selectedCategory)
    : muscles;

  useEffect(() => {
    if (exercise) {
      setFormData({
        name_en: exercise.name_en,
        name_es: exercise.name_es || '',
        type: exercise.type,
        resistance_profile: exercise.resistance_profile,
        category: exercise.category,
        description_en: exercise.description_en || '',
        description_es: exercise.description_es || '',
        equipment_needed: exercise.equipment_needed || '',
        difficulty_level: exercise.difficulty_level || 'beginner',
        video_url: exercise.video_url || '',
        thumbnail_url: exercise.thumbnail_url || '',
        image_url: exercise.image_url || '',
        primary_muscle_ids: exercise.primary_muscles.map((m) => m.muscle_id),
        secondary_muscle_ids: exercise.secondary_muscles.map((m) => m.muscle_id),
        // Clasificación de ejercicio
        exercise_class: exercise.exercise_class || 'strength',
        cardio_subclass: exercise.cardio_subclass || undefined,
        intensity_zone: exercise.intensity_zone || undefined,
        target_heart_rate_min: exercise.target_heart_rate_min || undefined,
        target_heart_rate_max: exercise.target_heart_rate_max || undefined,
        calories_per_minute: exercise.calories_per_minute || undefined,
      });
      // Movement image (for exercise card)
      setCurrentThumbnail(exercise.image_url || exercise.thumbnail_url || null);
    } else {
      setFormData(initialFormData);
      setCurrentThumbnail(null);
    }
    setSelectedImage(null);
    setError(null);
  }, [exercise, isOpen]);

  const handleChange = (field: keyof ExerciseCreateData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleExerciseClassChange = (newClass: ExerciseClass) => {
    setFormData((prev) => {
      const updated: ExerciseCreateData = { ...prev, exercise_class: newClass };
      // Reset cardio fields when changing away from cardio
      if (newClass !== 'cardio') {
        updated.cardio_subclass = undefined;
        updated.intensity_zone = undefined;
        updated.target_heart_rate_min = undefined;
        updated.target_heart_rate_max = undefined;
        updated.calories_per_minute = undefined;
      }
      // Reset muscles when changing to non-muscle-requiring class
      if (!CLASSES_REQUIRING_MUSCLES.includes(newClass)) {
        updated.primary_muscle_ids = [];
        updated.secondary_muscle_ids = [];
      }
      return updated;
    });
  };

  const handleNumericChange = (field: keyof ExerciseCreateData, value: string) => {
    const numValue = value ? parseFloat(value) : undefined;
    setFormData((prev) => ({ ...prev, [field]: numValue }));
  };

  // Verificar si la clase actual requiere músculos
  const requiresMuscles = CLASSES_REQUIRING_MUSCLES.includes(formData.exercise_class || 'strength');
  const isCardio = formData.exercise_class === 'cardio';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Asegurar que name_en tenga valor (requerido por el backend)
      const dataToSend = { ...formData };
      if (!dataToSend.name_en && dataToSend.name_es) {
        dataToSend.name_en = dataToSend.name_es;
      }

      let savedExercise: Exercise;

      if (isEditing && exercise) {
        savedExercise = await exercisesService.update(exercise.id, dataToSend);
      } else {
        savedExercise = await exercisesService.create(dataToSend as ExerciseCreateData);
      }

      // Upload image if selected
      if (selectedImage) {
        try {
          savedExercise = await exercisesService.uploadImage(savedExercise.id, selectedImage);
        } catch (uploadError: any) {
          if (uploadError.response?.status === 413) {
            setError(t('exercises:messages.imageTooLarge'));
          } else {
            setError(uploadError.message || t('exercises:messages.uploadError'));
          }
          setIsLoading(false);
          return;
        }
      }

      onSave(savedExercise);
      onClose();
    } catch (err: any) {
      setError(err.message || t('exercises:messages.saveError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
  };

  const handleImageRemove = async () => {
    setSelectedImage(null);
    if (isEditing && exercise?.image_url) {
      try {
        await exercisesService.deleteImage(exercise.id);
      } catch (err) {
        console.error('Error removing image:', err);
      }
    }
  };

  const handleFetchMovementImage = async () => {
    if (!exercise) return;

    setIsFetchingMovementImage(true);
    setError(null);

    try {
      const updatedExercise = await exercisesService.fetchMovementImage(exercise.id);
      setCurrentThumbnail(updatedExercise.thumbnail_url || null);
      // Update formData to prevent overwriting when user saves
      setFormData((prev) => ({
        ...prev,
        thumbnail_url: updatedExercise.thumbnail_url || '',
      }));
      onSave(updatedExercise);
    } catch (err: any) {
      setError(err.message || t('exercises:messages.fetchImageError'));
    } finally {
      setIsFetchingMovementImage(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('exercises:editExercise') : t('exercises:newExercise')}
      size="full"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Layout principal: Formulario a la izquierda, Imagen a la derecha */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Columna izquierda: Campos del formulario */}
          <div className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Nombre según idioma actual */}
              <div>
                <Input
                  label={`${t('exercises:fields.name')} *`}
                  value={currentLang === 'es' ? (formData.name_es || formData.name_en) : formData.name_en}
                  onChange={(e) => handleChange(currentLang === 'es' ? 'name_es' : 'name_en', e.target.value)}
                  placeholder={currentLang === 'es' ? 'Ej: Press de Banca' : 'e.g., Bench Press'}
                  required
                />
              </div>

              {/* Category (text field for exercise category like "Press", "Pull", etc.) */}
              <div>
                <Input
                  label={`${t('exercises:fields.category')} *`}
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  placeholder={t('exercises:placeholders.category')}
                  required
                />
              </div>

              {/* Exercise Class */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('exercises:fields.exerciseClass')} *
                </label>
                <select
                  value={formData.exercise_class}
                  onChange={(e) => handleExerciseClassChange(e.target.value as ExerciseClass)}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  {exerciseClassValues.map((value) => (
                    <option key={value} value={value}>
                      {t(`exercises:exerciseClasses.${value}`)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cardio Subclass - Only visible when exercise_class is 'cardio' */}
              {isCardio && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('exercises:fields.cardioSubclass')}
                  </label>
                  <select
                    value={formData.cardio_subclass || ''}
                    onChange={(e) => handleChange('cardio_subclass', e.target.value)}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">{t('exercises:filters.selectSubclass')}</option>
                    {cardioSubclassValues.map((value) => (
                      <option key={value} value={value}>
                        {t(`exercises:cardioSubclasses.${value}`)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Cardio-specific fields */}
              {isCardio && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('exercises:fields.intensityZone')}
                    </label>
                    <select
                      value={formData.intensity_zone || ''}
                      onChange={(e) => handleNumericChange('intensity_zone', e.target.value)}
                      className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">{t('exercises:filters.selectZone')}</option>
                      {[1, 2, 3, 4, 5].map((zone) => (
                        <option key={zone} value={zone}>
                          {t(`exercises:intensityZones.zone${zone}`)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Input
                      label={t('exercises:fields.targetHeartRateMin')}
                      type="number"
                      value={formData.target_heart_rate_min?.toString() || ''}
                      onChange={(e) => handleNumericChange('target_heart_rate_min', e.target.value)}
                      placeholder="60"
                      min={40}
                      max={220}
                    />
                  </div>

                  <div>
                    <Input
                      label={t('exercises:fields.targetHeartRateMax')}
                      type="number"
                      value={formData.target_heart_rate_max?.toString() || ''}
                      onChange={(e) => handleNumericChange('target_heart_rate_max', e.target.value)}
                      placeholder="120"
                      min={40}
                      max={220}
                    />
                  </div>

                  <div>
                    <Input
                      label={t('exercises:fields.caloriesPerMinute')}
                      type="number"
                      value={formData.calories_per_minute?.toString() || ''}
                      onChange={(e) => handleNumericChange('calories_per_minute', e.target.value)}
                      placeholder="8"
                      min={0}
                      max={50}
                      step={0.1}
                    />
                  </div>
                </>
              )}

              {/* Muscle sections - Only visible for strength and plyometric exercises */}
              {requiresMuscles && (
                <>
                  {/* Muscle Category Filter */}
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('exercises:fields.filterMusclesByCategory')}
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value as MuscleCategory | '')}
                      className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">{t('exercises:filters.allCategories')}</option>
                      {muscleCategories.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Primary Muscles */}
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('exercises:fields.primaryMuscles')} *
                    </label>
                    <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {isLoadingMuscles ? (
                        <p className="text-gray-500 text-sm">{t('exercises:messages.loadingMuscles')}</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {filteredMuscles.map((muscle) => (
                            <label key={muscle.id} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.primary_muscle_ids.includes(muscle.id)}
                                onChange={(e) => {
                                  const newIds = e.target.checked
                                    ? [...formData.primary_muscle_ids, muscle.id]
                                    : formData.primary_muscle_ids.filter((id) => id !== muscle.id);
                                  // Remove from secondary if added to primary
                                  const newSecondary = formData.secondary_muscle_ids?.filter((id) => id !== muscle.id) || [];
                                  setFormData((prev) => ({
                                    ...prev,
                                    primary_muscle_ids: newIds,
                                    secondary_muscle_ids: newSecondary,
                                  }));
                                }}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                              <span className="text-sm text-gray-700">{muscle.display_name_es}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    {formData.primary_muscle_ids.length === 0 && (
                      <p className="text-red-500 text-xs mt-1">{t('exercises:validation.selectPrimaryMuscle')}</p>
                    )}
                  </div>

                  {/* Secondary Muscles */}
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('exercises:fields.secondaryMuscles')}
                    </label>
                    <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {isLoadingMuscles ? (
                        <p className="text-gray-500 text-sm">{t('exercises:messages.loadingMuscles')}</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {filteredMuscles
                            .filter((m) => !formData.primary_muscle_ids.includes(m.id))
                            .map((muscle) => (
                              <label key={muscle.id} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.secondary_muscle_ids?.includes(muscle.id) || false}
                                  onChange={(e) => {
                                    const currentSecondary = formData.secondary_muscle_ids || [];
                                    const newIds = e.target.checked
                                      ? [...currentSecondary, muscle.id]
                                      : currentSecondary.filter((id) => id !== muscle.id);
                                    setFormData((prev) => ({
                                      ...prev,
                                      secondary_muscle_ids: newIds,
                                    }));
                                  }}
                                  className="rounded border-gray-300 text-gray-600 focus:ring-gray-500"
                                />
                                <span className="text-sm text-gray-600">{muscle.display_name_es}</span>
                              </label>
                            ))}
                        </div>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      {t('exercises:fields.secondaryMusclesHelp')}
                    </p>
                  </div>
                </>
              )}

              {/* Info message for non-muscle exercises */}
              {!requiresMuscles && (
                <div className="md:col-span-2 lg:col-span-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    {t('exercises:messages.noMusclesRequired')}
                  </p>
                </div>
              )}

              {/* Exercise Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('exercises:fields.exerciseType')} *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  {exerciseTypeValues.map((value) => (
                    <option key={value} value={value}>
                      {t(`exercises:exerciseTypes.${value}`)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resistance Profile */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('exercises:fields.resistanceProfile')} *
                </label>
                <select
                  value={formData.resistance_profile}
                  onChange={(e) => handleChange('resistance_profile', e.target.value)}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  {resistanceProfileValues.map((value) => (
                    <option key={value} value={value}>
                      {t(`exercises:resistanceProfiles.${value === 'bell_shaped' ? 'bell' : value}`)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Difficulty Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('exercises:fields.difficulty')}
                </label>
                <select
                  value={formData.difficulty_level || ''}
                  onChange={(e) => handleChange('difficulty_level', e.target.value)}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {difficultyValues.map((value) => (
                    <option key={value} value={value}>
                      {t(`exercises:difficulties.${value}`)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Equipment Needed */}
              <div>
                <Input
                  label={t('exercises:fields.equipment')}
                  value={formData.equipment_needed || ''}
                  onChange={(e) => handleChange('equipment_needed', e.target.value)}
                  placeholder={t('exercises:placeholders.equipment')}
                />
              </div>

              {/* Descripción según idioma actual */}
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('exercises:fields.description')}
                </label>
                <textarea
                  value={currentLang === 'es' ? (formData.description_es || formData.description_en || '') : (formData.description_en || '')}
                  onChange={(e) => handleChange(currentLang === 'es' ? 'description_es' : 'description_en', e.target.value)}
                  rows={3}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder={currentLang === 'es' ? 'Descripción del ejercicio' : 'Exercise description'}
                />
              </div>
            </div>
          </div>

          {/* Columna derecha: Imagen */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="sticky top-4">
              {/* Image Upload - Movement Image for Exercise Card */}
              <ImageUpload
                currentImageUrl={currentThumbnail}
                onImageSelect={handleImageSelect}
                onImageRemove={handleImageRemove}
                disabled={isLoading || isFetchingMovementImage}
                label={t('exercises:fields.image')}
              />

              {/* Fetch Movement Image Button */}
              {isEditing && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleFetchMovementImage}
                    disabled={isLoading || isFetchingMovementImage}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isFetchingMovementImage ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('exercises:messages.fetchingImage')}
                      </>
                    ) : (
                      <>
                        <ArrowPathIcon className="-ml-1 mr-2 h-4 w-4" />
                        {t('exercises:fetchMovementImage')}
                      </>
                    )}
                  </button>
                  <p className="mt-1 text-xs text-gray-500">
                    {t('exercises:fetchMovementImageHelp')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {t('common:buttons.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
          >
            {isEditing ? t('common:buttons.save') : t('exercises:newExercise')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
