import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '../common/Button';
import { PencilIcon, TrashIcon, Bars3Icon } from '@heroicons/react/24/outline';
import type { DayExercise, Exercise } from '../../types';
import { getExerciseName } from '../../utils/exerciseHelpers';

interface SortableExerciseItemProps {
  dayExercise: DayExercise;
  index: number;
  exercises: Exercise[];
  onEdit?: () => void;
  onDelete?: () => void;
}

export function SortableExerciseItem({
  dayExercise,
  index,
  exercises,
  onEdit,
  onDelete,
}: SortableExerciseItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dayExercise.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  // Use embedded exercise from API response, fallback to exercises list
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
      parts.push(`Tempo: ${dayExercise.tempo}`);
    }
    if (dayExercise.effort_type && dayExercise.effort_value) {
      parts.push(`${dayExercise.effort_type}: ${dayExercise.effort_value}`);
    }

    return parts.join(' • ');
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 bg-white border rounded-lg transition-all duration-200 ${
        isDragging
          ? 'border-primary-500 shadow-lg scale-[1.02]'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none p-1 rounded hover:bg-gray-100"
      >
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

// Drag Overlay Component for the preview while dragging
export function ExerciseDragOverlay({
  dayExercise,
  exercise,
}: {
  dayExercise: DayExercise;
  exercise?: Exercise;
}) {
  const formatDetails = () => {
    const parts: string[] = [];
    if (dayExercise.sets) parts.push(`${dayExercise.sets} sets`);
    if (dayExercise.reps_min && dayExercise.reps_max) {
      parts.push(`${dayExercise.reps_min}-${dayExercise.reps_max} reps`);
    }
    return parts.join(' • ');
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-white border-2 border-primary-500 rounded-lg shadow-xl cursor-grabbing">
      <div className="text-primary-500 p-1">
        <Bars3Icon className="h-4 w-4" />
      </div>
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold">
        •
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {getExerciseName(exercise) || getExerciseName(dayExercise.exercise) || 'Exercise'}
        </p>
        <p className="text-xs text-gray-600">{formatDetails()}</p>
      </div>
    </div>
  );
}
