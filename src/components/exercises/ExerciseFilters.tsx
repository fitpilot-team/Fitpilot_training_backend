import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ExerciseType, ExerciseClass, CardioSubclass, Muscle, MuscleCategory } from '../../types';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { musclesService } from '../../services/muscles';

export interface FilterState {
  search: string;
  muscle_id: string;
  muscle_category: MuscleCategory | '';
  type: string;
  difficulty_level: string;
  exercise_class: ExerciseClass | '';
  cardio_subclass: CardioSubclass | '';
}

interface ExerciseFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClear: () => void;
}

const exerciseTypeValues: (ExerciseType | '')[] = ['', 'multiarticular', 'monoarticular'];

const difficultyValues: string[] = ['', 'beginner', 'intermediate', 'advanced'];

const muscleCategories: { value: MuscleCategory | ''; label: string }[] = [
  { value: '', label: 'Todas las categorías' },
  { value: 'chest', label: 'Pecho' },
  { value: 'back', label: 'Espalda' },
  { value: 'shoulders', label: 'Hombros' },
  { value: 'arms', label: 'Brazos' },
  { value: 'legs', label: 'Piernas' },
  { value: 'core', label: 'Core' },
];

// Clasificaciones de ejercicio
const exerciseClasses: { value: ExerciseClass | ''; labelKey: string }[] = [
  { value: '', labelKey: 'allClasses' },
  { value: 'strength', labelKey: 'strength' },
  { value: 'cardio', labelKey: 'cardio' },
  { value: 'plyometric', labelKey: 'plyometric' },
  { value: 'flexibility', labelKey: 'flexibility' },
  { value: 'mobility', labelKey: 'mobility' },
  { value: 'warmup', labelKey: 'warmup' },
  { value: 'conditioning', labelKey: 'conditioning' },
  { value: 'balance', labelKey: 'balance' },
];

// Sub-clasificaciones de cardio
const cardioSubclasses: { value: CardioSubclass | ''; labelKey: string }[] = [
  { value: '', labelKey: 'allSubclasses' },
  { value: 'liss', labelKey: 'liss' },
  { value: 'hiit', labelKey: 'hiit' },
  { value: 'miss', labelKey: 'miss' },
];

export function ExerciseFilters({ filters, onFilterChange, onClear }: ExerciseFiltersProps) {
  const { t } = useTranslation(['exercises', 'common']);
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [isLoadingMuscles, setIsLoadingMuscles] = useState(true);

  const hasActiveFilters = filters.search || filters.muscle_id || filters.muscle_category || filters.type || filters.difficulty_level || filters.exercise_class || filters.cardio_subclass;

  // Load muscles from API
  useEffect(() => {
    const loadMuscles = async () => {
      try {
        const response = await musclesService.getMuscles();
        setMuscles(response.muscles);
      } catch (error) {
        console.error('Error loading muscles:', error);
      } finally {
        setIsLoadingMuscles(false);
      }
    };
    loadMuscles();
  }, []);

  // Filter muscles by selected category
  const filteredMuscles = filters.muscle_category
    ? muscles.filter((m) => m.muscle_category === filters.muscle_category)
    : muscles;

  const handleChange = (key: keyof FilterState, value: string) => {
    // If changing category, reset muscle_id
    if (key === 'muscle_category') {
      onFilterChange({ ...filters, muscle_category: value as MuscleCategory | '', muscle_id: '' });
    } else if (key === 'exercise_class') {
      // If changing exercise_class, reset cardio_subclass when not cardio
      const newClass = value as ExerciseClass | '';
      if (newClass !== 'cardio') {
        onFilterChange({ ...filters, exercise_class: newClass, cardio_subclass: '' });
      } else {
        onFilterChange({ ...filters, exercise_class: newClass });
      }
    } else {
      onFilterChange({ ...filters, [key]: value });
    }
  };

  const getExerciseTypeLabel = (value: string) => {
    if (!value) return t('exercises:filters.allTypes');
    return t(`exercises:exerciseTypes.${value}`);
  };

  const getDifficultyLabel = (value: string) => {
    if (!value) return t('exercises:filters.allDifficulties');
    return t(`exercises:difficulties.${value}`);
  };

  const getExerciseClassLabel = (labelKey: string) => {
    if (labelKey === 'allClasses') return t('exercises:filters.allClasses');
    return t(`exercises:exerciseClasses.${labelKey}`);
  };

  const getCardioSubclassLabel = (labelKey: string) => {
    if (labelKey === 'allSubclasses') return t('exercises:filters.allSubclasses');
    return t(`exercises:cardioSubclasses.${labelKey}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search Input */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('common:buttons.search')}
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('exercises:searchPlaceholder')}
              value={filters.search}
              onChange={(e) => handleChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Muscle Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Categoría
          </label>
          <select
            value={filters.muscle_category}
            onChange={(e) => handleChange('muscle_category', e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {muscleCategories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Specific Muscle Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Músculo
          </label>
          <select
            value={filters.muscle_id}
            onChange={(e) => handleChange('muscle_id', e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={isLoadingMuscles}
          >
            <option value="">Todos los músculos</option>
            {filteredMuscles.map((muscle) => (
              <option key={muscle.id} value={muscle.id}>
                {muscle.display_name_es}
              </option>
            ))}
          </select>
        </div>

        {/* Exercise Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('exercises:fields.exerciseType')}
          </label>
          <select
            value={filters.type}
            onChange={(e) => handleChange('type', e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {exerciseTypeValues.map((value) => (
              <option key={value} value={value}>
                {getExerciseTypeLabel(value)}
              </option>
            ))}
          </select>
        </div>

        {/* Difficulty Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('exercises:fields.difficulty')}
          </label>
          <select
            value={filters.difficulty_level}
            onChange={(e) => handleChange('difficulty_level', e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {difficultyValues.map((value) => (
              <option key={value} value={value}>
                {getDifficultyLabel(value)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Second row: Exercise Class and Cardio Subclass filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {/* Exercise Class Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('exercises:fields.exerciseClass')}
          </label>
          <select
            value={filters.exercise_class}
            onChange={(e) => handleChange('exercise_class', e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {exerciseClasses.map((cls) => (
              <option key={cls.value} value={cls.value}>
                {getExerciseClassLabel(cls.labelKey)}
              </option>
            ))}
          </select>
        </div>

        {/* Cardio Subclass Filter - Only visible when exercise_class is 'cardio' */}
        {filters.exercise_class === 'cardio' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('exercises:fields.cardioSubclass')}
            </label>
            <select
              value={filters.cardio_subclass}
              onChange={(e) => handleChange('cardio_subclass', e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {cardioSubclasses.map((sub) => (
                <option key={sub.value} value={sub.value}>
                  {getCardioSubclassLabel(sub.labelKey)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={onClear}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <XMarkIcon className="h-4 w-4 mr-1" />
            {t('common:buttons.clearFilters')}
          </button>
        </div>
      )}
    </div>
  );
}
