import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ExerciseCard, ExerciseFilters, ExerciseModal, FilterState } from '../components/exercises';
import { exercisesService } from '../services/exercises';
import { useAuthStore } from '@/store/newAuthStore';
import { Exercise } from '../types';
import { PlusIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const initialFilters: FilterState = {
  search: '',
  muscle_id: '',
  muscle_category: '',
  type: '',
  difficulty_level: '',
  exercise_class: '',
  cardio_subclass: '',
};

export function ExercisesPage() {
  const { t } = useTranslation(['exercises', 'common']);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Exercise | null>(null);

  // const { user } = useAuthStore();
  // const canModify = user?.role === 'trainer' || user?.role === 'admin';

  const fetchExercises = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await exercisesService.getAll({
        search: filters.search || undefined,
        muscle_id: filters.muscle_id || undefined,
        muscle_category: filters.muscle_category || undefined,
        type: filters.type || undefined,
        difficulty_level: filters.difficulty_level || undefined,
        exercise_class: filters.exercise_class || undefined,
        cardio_subclass: filters.cardio_subclass || undefined,
      });

      setExercises(response.exercises);
      setTotalCount(response.total);
    } catch (err: any) {
      setError(err.message || t('exercises:messages.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchExercises();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [fetchExercises]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters(initialFilters);
  };

  const handleAddExercise = () => {
    setSelectedExercise(null);
    setIsModalOpen(true);
  };

  const handleEditExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (exercise: Exercise) => {
    setDeleteConfirm(exercise);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    try {
      await exercisesService.delete(deleteConfirm.id);
      setExercises((prev) => prev.filter((e) => e.id !== deleteConfirm.id));
      setTotalCount((prev) => prev - 1);
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message || t('exercises:messages.deleteError'));
    }
  };

  const handleSaveExercise = (savedExercise: Exercise) => {
    if (selectedExercise) {
      // Update existing
      setExercises((prev) =>
        prev.map((e) => (e.id === savedExercise.id ? savedExercise : e))
      );
    } else {
      // Add new
      setExercises((prev) => [savedExercise, ...prev]);
      setTotalCount((prev) => prev + 1);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('exercises:title')}</h1>
            <p className="mt-1 text-gray-600">
              {t('exercises:subtitle', { count: totalCount })}
            </p>
          </div>

          {/* {canModify && (
            <Button onClick={handleAddExercise} variant="primary">
              <PlusIcon className="h-5 w-5 mr-2" />
              {t('exercises:newExercise')}
            </Button>
          )} */}
        </div>

        {/* Filters */}
        <ExerciseFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
        />

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : exercises.length === 0 ? (
          /* Empty State */
          <Card>
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExclamationTriangleIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('exercises:noExercisesFound')}
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {filters.search || filters.muscle_id || filters.muscle_category || filters.type || filters.difficulty_level
                  ? t('exercises:adjustFilters')
                  : t('exercises:addFirst')}
              </p>
              {/* {canModify && !filters.search && !filters.muscle_id && !filters.muscle_category && !filters.type && (
                <Button onClick={handleAddExercise} variant="primary" className="mt-4">
                  <PlusIcon className="h-5 w-5 mr-2" />
                  {t('exercises:addExercise')}
                </Button>
              )} */}
            </div>
          </Card>
        ) : (
          /* Exercise Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {/* {exercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                onEdit={canModify ? handleEditExercise : undefined}
                onDelete={canModify ? handleDeleteClick : undefined}
                canModify={canModify}
              />
            ))} */}
          </div>
        )}
      </div>

      {/* Exercise Modal */}
      <ExerciseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        exercise={selectedExercise}
        onSave={handleSaveExercise}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setDeleteConfirm(null)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t('exercises:deleteExercise')}
              </h3>
              <p className="text-gray-600 mb-4">
                {t('exercises:confirmDeleteMessage', { name: deleteConfirm.name_en })}
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => setDeleteConfirm(null)}
                >
                  {t('common:buttons.cancel')}
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteConfirm}
                >
                  {t('common:buttons.delete')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
