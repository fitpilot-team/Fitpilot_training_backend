import { Button } from '../common/Button';
import { PencilIcon, TrashIcon, Bars3Icon } from '@heroicons/react/24/outline';
import type { DayExercise } from '../../types';
import { useMesocycleStore } from '../../store/mesocycleStore';
import { TEMPO_OPTIONS, SET_TYPE_OPTIONS } from '../../constants/exerciseConfig';
import { getExerciseName } from '../../utils/exerciseHelpers';

interface DayExerciseItemProps {
  dayExercise: DayExercise;
  index: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function DayExerciseItem({ dayExercise, index, onEdit, onDelete }: DayExerciseItemProps) {
  const { exercises } = useMesocycleStore();

  // Use embedded exercise from API response, fallback to exercises list in store
  const exercise = dayExercise.exercise || exercises.find((e) => e.id === dayExercise.exercise_id);

  const formatDetails = () => {
    const parts: string[] = [];

    if (dayExercise.sets) {
      parts.push(`${dayExercise.sets} sets`);
    }
    if (dayExercise.reps_min && dayExercise.reps_max) {
      parts.push(`${dayExercise.reps_min}-${dayExercise.reps_max} reps`);
    }
    if (dayExercise.rest_seconds) {
      parts.push(`${dayExercise.rest_seconds}s rest`);
    }
    if (dayExercise.tempo) {
      // Convert tempo type to notation string if it's a predefined type
      const tempoOption = TEMPO_OPTIONS.find(opt => opt.value === dayExercise.tempo);
      const tempoDisplay = tempoOption ? tempoOption.tempo : dayExercise.tempo;
      parts.push(`Tempo: ${tempoDisplay}`);
    }
    if (dayExercise.set_type && dayExercise.set_type !== 'straight') {
      // Only show set type if it's not the default "straight" type
      const setTypeOption = SET_TYPE_OPTIONS.find(opt => opt.value === dayExercise.set_type);
      if (setTypeOption) {
        parts.push(setTypeOption.label);
      }
    }
    if (dayExercise.effort_type && dayExercise.effort_value) {
      parts.push(`${dayExercise.effort_type}: ${dayExercise.effort_value}`);
    }

    return parts.join(' • ');
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
      {/* Drag Handle */}
      <button className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
        <Bars3Icon className="h-4 w-4" />
      </button>

      {/* Order */}
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold">
        {index + 1}
      </div>

      {/* Exercise Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {getExerciseName(exercise) || 'Unknown Exercise'}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
            {exercise?.type}
          </span>
          <span>{formatDetails()}</span>
        </div>
        {dayExercise.notes && (
          <p className="text-xs text-gray-500 mt-1 truncate">{dayExercise.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <PencilIcon className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <TrashIcon className="h-3.5 w-3.5 text-red-600" />
        </Button>
      </div>
    </div>
  );
}
