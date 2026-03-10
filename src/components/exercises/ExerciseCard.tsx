import { Exercise, MuscleName } from '../../types';
import {
  PencilIcon,
  TrashIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import { getExerciseImageUrl, getExerciseName } from '../../utils/exerciseHelpers';

interface ExerciseCardProps {
  exercise: Exercise;
  onEdit?: (exercise: Exercise) => void;
  onDelete?: (exercise: Exercise) => void;
  canModify?: boolean;
}

const muscleColors: Record<MuscleName, string> = {
  chest: 'bg-red-100 text-red-800',
  upper_back: 'bg-blue-100 text-blue-800',
  lats: 'bg-cyan-100 text-cyan-800',
  lower_back: 'bg-indigo-100 text-indigo-800',
  anterior_deltoid: 'bg-orange-100 text-orange-800',
  posterior_deltoid: 'bg-yellow-100 text-yellow-800',
  biceps: 'bg-purple-100 text-purple-800',
  triceps: 'bg-violet-100 text-violet-800',
  forearms: 'bg-pink-100 text-pink-800',
  quadriceps: 'bg-green-100 text-green-800',
  hamstrings: 'bg-emerald-100 text-emerald-800',
  glutes: 'bg-fuchsia-100 text-fuchsia-800',
  calves: 'bg-teal-100 text-teal-800',
  adductors: 'bg-lime-100 text-lime-800',
  abs: 'bg-yellow-100 text-yellow-800',
  obliques: 'bg-amber-100 text-amber-800',
  tibialis: 'bg-sky-100 text-sky-800',
};

const difficultyLabels: Record<string, { label: string; color: string }> = {
  beginner: { label: 'Principiante', color: 'bg-green-100 text-green-800' },
  intermediate: { label: 'Intermedio', color: 'bg-yellow-100 text-yellow-800' },
  advanced: { label: 'Avanzado', color: 'bg-red-100 text-red-800' },
};

export function ExerciseCard({ exercise, onEdit, onDelete, canModify = false }: ExerciseCardProps) {
  // Priority: custom image > thumbnail from ExerciseDB > placeholder
  const baseImageSrc = exercise.image_url || exercise.thumbnail_url || null;

  // Add cache-busting parameter to force image reload when updated
  const imageSrc = getExerciseImageUrl(baseImageSrc, exercise.updated_at);

  // Get translated exercise name
  const exerciseName = getExerciseName(exercise);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Image Section */}
      <div className="relative aspect-square w-full bg-gray-100">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={exerciseName}
            className="w-full h-full object-contain"
            onError={(e) => {
              // Fallback to placeholder on error
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center ${imageSrc ? 'hidden' : ''}`}>
          <PhotoIcon className="h-16 w-16 text-gray-300" />
        </div>

        {/* Action Buttons */}
        {canModify && (
          <div className="absolute top-2 right-2 flex space-x-1">
            {onEdit && (
              <button
                onClick={() => onEdit(exercise)}
                className="p-1.5 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-colors"
                title="Editar"
              >
                <PencilIcon className="h-4 w-4 text-gray-600" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(exercise)}
                className="p-1.5 bg-white rounded-full shadow-sm hover:bg-red-50 transition-colors"
                title="Eliminar"
              >
                <TrashIcon className="h-4 w-4 text-red-600" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate" title={exerciseName}>
          {exerciseName}
        </h3>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {/* Primary Muscles */}
          {exercise.primary_muscles.map((pm) => (
            <span
              key={pm.muscle_id}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${muscleColors[pm.muscle_name] || 'bg-gray-100 text-gray-800'}`}
            >
              {pm.muscle_display_name}
            </span>
          ))}

          {/* Secondary Muscles (smaller, lighter) */}
          {exercise.secondary_muscles.map((sm) => (
            <span
              key={sm.muscle_id}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200"
              title="Músculo secundario"
            >
              {sm.muscle_display_name}
            </span>
          ))}

          {exercise.difficulty_level && difficultyLabels[exercise.difficulty_level] && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${difficultyLabels[exercise.difficulty_level].color}`}>
              {difficultyLabels[exercise.difficulty_level].label}
            </span>
          )}
        </div>

        <div className="mt-2 text-sm text-gray-500">
          <span className="capitalize">{exercise.type === 'multiarticular' ? 'Multiarticular' : 'Monoarticular'}</span>
          {exercise.category && (
            <>
              <span className="mx-1">·</span>
              <span>{exercise.category}</span>
            </>
          )}
        </div>

        {exercise.equipment_needed && (
          <p className="mt-1 text-xs text-gray-400 truncate" title={exercise.equipment_needed}>
            {exercise.equipment_needed}
          </p>
        )}
      </div>
    </div>
  );
}
