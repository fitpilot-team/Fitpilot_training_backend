import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronDownIcon,
  LanguageIcon
} from '@heroicons/react/24/outline';
import { Dumbbell } from 'lucide-react';
import { LibraryExerciseCard } from './KanbanExerciseCard';
import type { Exercise } from '../../types';

import { translationService } from '../../services/translation';
import { useMesocycleStore } from '../../store/mesocycleStore';

export function ExerciseLibraryPanel() {
  const { t } = useTranslation(['exercises', 'training', 'common']);
  const { exercises, loadExercises } = useMesocycleStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslateAll = async () => {
    try {
      setIsTranslating(true);
      await translationService.translateAllExercises();
      alert(t('common:translationStarted', { defaultValue: 'Translation started in background. Please reload in a few minutes.' }));
    } catch (err) {
      console.error('Failed to start translation:', err);
      alert(t('common:error', { defaultValue: 'Error starting translation' }));
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const muscleGroups = useMemo(() => [
    { value: '', label: t('training:library.allMuscles'), emoji: '💪' },
    { value: 'cardio', label: t('exercises:muscleGroups.cardio', { defaultValue: 'Cardio' }), emoji: '🏃' },
    { value: 'chest', label: t('exercises:muscleGroups.chest'), emoji: '🫁' },
    { value: 'upper_back', label: t('exercises:muscleGroups.upper_back'), emoji: '🔙' },
    { value: 'lats', label: t('exercises:muscleGroups.lats'), emoji: '🦇' },
    { value: 'lower_back', label: t('exercises:muscleGroups.lower_back'), emoji: '⬇️' },
    { value: 'anterior_deltoid', label: t('exercises:muscleGroups.anterior_deltoid'), emoji: '🎯' },
    { value: 'posterior_deltoid', label: t('exercises:muscleGroups.posterior_deltoid'), emoji: '⬅️' },
    { value: 'biceps', label: t('exercises:muscleGroups.biceps'), emoji: '💪' },
    { value: 'triceps', label: t('exercises:muscleGroups.triceps'), emoji: '🦾' },
    { value: 'quadriceps', label: t('exercises:muscleGroups.quadriceps'), emoji: '🦵' },
    { value: 'hamstrings', label: t('exercises:muscleGroups.hamstrings'), emoji: '🦿' },
    { value: 'glutes', label: t('exercises:muscleGroups.glutes'), emoji: '🍑' },
    { value: 'calves', label: t('exercises:muscleGroups.calves'), emoji: '🦶' },
    { value: 'adductors', label: t('exercises:muscleGroups.adductors'), emoji: '🦵' },
    { value: 'tibialis', label: t('exercises:muscleGroups.tibialis'), emoji: '🦶' },
    { value: 'abs', label: t('exercises:muscleGroups.abs'), emoji: '🎯' },
    { value: 'obliques', label: t('exercises:muscleGroups.obliques'), emoji: '↩️' },
  ], [t]);

  const filteredExercises = useMemo(() => {
    return exercises.filter((exercise) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = exercise.name_en.toLowerCase().includes(query) ||
          exercise.name_es?.toLowerCase().includes(query);
        const matchesDescription = exercise.description_en?.toLowerCase().includes(query) ||
          exercise.description_es?.toLowerCase().includes(query);
        if (!matchesName && !matchesDescription) return false;
      }

      // Filter by exercise class (cardio uses exercise_class field)
      if (selectedMuscle === 'cardio') {
        return exercise.exercise_class === 'cardio';
      }

      // Filter by primary muscle name
      const primaryMuscleName = exercise.primary_muscles?.[0]?.muscle_name;
      if (selectedMuscle && primaryMuscleName !== selectedMuscle) {
        return false;
      }

      return true;
    });
  }, [exercises, searchQuery, selectedMuscle]);

  // Group exercises by primary muscle for better organization
  const groupedExercises = useMemo(() => {
    const groups: Record<string, Exercise[]> = {};
    filteredExercises.forEach((exercise) => {
      let group: string = exercise.primary_muscles?.[0]?.muscle_name || 'other';

      // Special grouping for cardio (using exercise_class field)
      if (exercise.exercise_class === 'cardio') {
        group = 'cardio';
      }

      if (!groups[group]) groups[group] = [];
      groups[group].push(exercise);
    });
    return groups;
  }, [filteredExercises]);

  const hasActiveFilters = selectedMuscle !== '';

  const clearFilters = () => {
    setSelectedMuscle('');
    setSearchQuery('');
  };

  const exerciseIds = filteredExercises.map((e) => `library-${e.id}`);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col h-full bg-gradient-to-b from-white to-gray-50/50
                 border-r border-gray-100 w-72 shadow-sm"
    >
      {/* Header */}
      <div className="p-4 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/25">
            <Dumbbell className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">{t('training:library.title')}</h2>
            <p className="text-xs text-gray-500">{t('training:library.dragSubtitle')}</p>
          </div>
        </div>

        {/* Search - Modern style */}
        <div className="relative group">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400
                                          group-focus-within:text-primary-500 transition-colors" />
          <input
            type="text"
            placeholder={t('training:library.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl
                       focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 focus:bg-white
                       transition-all duration-200 placeholder:text-gray-400"
          />
          {searchQuery && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400
                         hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </div>

        {/* Filter Toggle and Translate Button */}
        <div className="flex gap-2 mt-3">
          <motion.button
            onClick={() => setShowFilters(!showFilters)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-xl
              font-medium transition-all duration-200
              ${showFilters || hasActiveFilters
                ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/25'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
            `}
          >
            <FunnelIcon className="h-4 w-4" />
            <span>{t('training:library.filters')}</span>
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-white/20 rounded-full">
                1
              </span>
            )}
            <motion.div
              animate={{ rotate: showFilters ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDownIcon className="h-4 w-4" />
            </motion.div>
          </motion.button>

          <motion.button
            onClick={handleTranslateAll}
            disabled={isTranslating}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={t('common:translateMissing', { defaultValue: 'Translate Missing' })}
          >
            <LanguageIcon className={`h-4 w-4 ${isTranslating ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>

        {/* Filters Panel - Animated */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {t('training:library.muscleGroup')}
                </label>
                <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {muscleGroups.map((option) => (
                    <motion.button
                      key={option.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedMuscle(option.value)}
                      className={`
                        px-2 py-1.5 text-[10px] font-medium rounded-lg transition-all duration-200
                        ${selectedMuscle === option.value
                          ? 'bg-primary-500 text-white shadow-sm'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }
                      `}
                    >
                      {option.label}
                    </motion.button>
                  ))}
                </div>

                {hasActiveFilters && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500
                               transition-colors mt-2 mx-auto"
                  >
                    <XMarkIcon className="h-3 w-3" />
                    {t('training:library.clearFilters')}
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Exercise Count - Modern badge */}
      <div className="px-4 py-2 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500">
            {t('training:library.exerciseCount', { count: filteredExercises.length })}
          </span>
          {hasActiveFilters && (
            <span className="text-[10px] px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full font-medium">
              {t('training:library.filtered')}
            </span>
          )}
        </div>
      </div>

      {/* Exercises Grid */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
        <SortableContext items={exerciseIds} strategy={rectSortingStrategy}>
          {filteredExercises.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-40 text-gray-400"
            >
              <div className="p-4 rounded-full bg-gray-100 mb-3">
                <MagnifyingGlassIcon className="h-8 w-8" />
              </div>
              <span className="text-sm font-medium">{t('training:library.noExercisesFound')}</span>
              {hasActiveFilters && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={clearFilters}
                  className="mt-3 px-4 py-1.5 text-xs font-medium text-primary-600
                             bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  {t('training:library.clearFilters')}
                </motion.button>
              )}
            </motion.div>
          ) : selectedMuscle ? (
            // Flat list when filtered by muscle
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 gap-2"
            >
              {filteredExercises.map((exercise, index) => (
                <motion.div
                  key={exercise.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <LibraryExerciseCard exercise={exercise} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            // Grouped by muscle when no muscle filter
            <div className="space-y-4">
              {Object.entries(groupedExercises).map(([muscleGroup, groupExercises]) => (
                <motion.div
                  key={muscleGroup}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {t(`exercises:muscleGroups.${muscleGroup}`, { defaultValue: muscleGroup.replace('_', ' ') })}
                    </h3>
                    <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {groupExercises.map((exercise) => (
                      <LibraryExerciseCard key={exercise.id} exercise={exercise} />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </SortableContext>
      </div>

      {/* Hint - Modern style */}
      <div className="p-3 bg-gradient-to-r from-primary-50 to-primary-100/50 border-t border-primary-100">
        <p className="text-[11px] text-primary-700 text-center font-medium flex items-center justify-center gap-1.5">
          <motion.span
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            →
          </motion.span>
          {t('training:library.dragToColumns')}
        </p>
      </div>
    </motion.div>
  );
}
