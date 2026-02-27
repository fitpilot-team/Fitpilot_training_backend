import { useSortable } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Bars3Icon, ClockIcon } from '@heroicons/react/24/outline';
import type { DayExercise, Exercise } from '../../types';
import { getMuscleStyle } from '../../utils/muscleGroupStyles';
import { getExerciseImageUrl, getExerciseName } from '../../utils/exerciseHelpers';

interface KanbanExerciseCardProps {
  dayExercise: DayExercise;
  exercise?: Exercise;
  onClick?: () => void;
  isDraggingOverlay?: boolean;
  orderIndex?: number;
  isOverlay?: boolean;
}

/**
 * Helper to get the primary muscle name from an exercise
 */
function getPrimaryMuscleName(exercise: Exercise | undefined): string | undefined {
  return exercise?.primary_muscles?.[0]?.muscle_name;
}

/**
 * Helper to get a display label for the exercise (muscle or category fallback)
 */
function getExerciseLabel(exercise: Exercise | undefined): { label: string; isMuscle: boolean } {
  const primaryMuscle = exercise?.primary_muscles?.[0]?.muscle_name;
  if (primaryMuscle) {
    return { label: primaryMuscle, isMuscle: true };
  }
  // Fallback to exercise class or category
  const fallback = exercise?.exercise_class || exercise?.category || 'other';
  return { label: fallback, isMuscle: false };
}

export function KanbanExerciseCard({
  dayExercise,
  exercise,
  onClick,
  isDraggingOverlay = false,
  orderIndex,
}: KanbanExerciseCardProps) {
  const { t } = useTranslation(['exercises', 'common']);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: dayExercise.id,
    data: {
      type: 'day-exercise',
      dayExercise,
      exercise,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const exerciseData = dayExercise.exercise || exercise;
  const primaryMuscle = getPrimaryMuscleName(exerciseData);
  const muscleStyle = getMuscleStyle(primaryMuscle);

  const getImageSrc = (url: string | null | undefined) => {
    return getExerciseImageUrl(url, exerciseData?.updated_at);
  };

  const formatConfig = () => {
    // Check if this is a cardio exercise
    if (exerciseData?.exercise_class === 'cardio') {
      // Display duration for cardio
      if (dayExercise.duration_seconds) {
        const minutes = Math.floor(dayExercise.duration_seconds / 60);
        const seconds = dayExercise.duration_seconds % 60;
        if (minutes > 0) {
          return seconds > 0 ? `${minutes}m${seconds}s` : `${minutes}min`;
        }
        return `${seconds}s`;
      }
      return ''; // No config to display
    }

    // Original logic for strength exercises
    const parts: string[] = [];
    if (dayExercise.sets) parts.push(`${dayExercise.sets}x`);
    if (dayExercise.reps_min && dayExercise.reps_max) {
      parts.push(`${dayExercise.reps_min}-${dayExercise.reps_max}`);
    }
    return parts.join('');
  };

  return (
    <>
      {/* Indicador de inserción ARRIBA - aparece cuando se arrastra sobre este elemento */}
      {isOver && !isDragging && (
        <div className="h-1 bg-primary-500 rounded-full mb-1 animate-pulse shadow-sm shadow-primary-300" />
      )}

      {/* Contenedor sortable - div normal para no interferir con dnd-kit transforms */}
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={onClick}
        className={`
          group relative bg-white rounded-xl overflow-hidden
          cursor-grab active:cursor-grabbing touch-none
          border border-gray-100
          shadow-sm hover:shadow-lg hover:shadow-gray-200/50
          transition-all duration-200
          ${isDragging ? `opacity-50 ring-2 ring-primary-400 ${muscleStyle.glow} shadow-lg` : ''}
          ${isDraggingOverlay ? `shadow-2xl ring-2 ring-primary-500 ${muscleStyle.glow}` : ''}
        `}
      >
        {/* Image Container */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
          {(exerciseData?.image_url || exerciseData?.thumbnail_url) ? (
            <motion.img
              src={getImageSrc(exerciseData.image_url || exerciseData.thumbnail_url) ?? undefined}
              alt={getExerciseName(exerciseData)}
              className="w-full h-full object-contain"
              initial={{ scale: 1 }}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${muscleStyle.gradient}`}>
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.span
                  className="text-white text-3xl font-black opacity-30"
                  initial={{ scale: 1 }}
                  whileHover={{ scale: 1.1 }}
                >
                  {getExerciseName(exerciseData)?.charAt(0) || '?'}
                </motion.span>
              </div>
              {/* Decorative elements */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
            </div>
          )}

          {/* Order Badge */}
          {orderIndex && (
            <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full
                          bg-white/90 backdrop-blur-sm border border-gray-200
                          flex items-center justify-center
                          text-[10px] font-bold text-gray-700 shadow-sm z-10">
              {orderIndex}
            </div>
          )}

          {/* Drag Handle Indicator - Visual only */}
          <div
            className="absolute top-1.5 right-1.5 p-1 bg-white/80 backdrop-blur-md rounded-lg
                     text-gray-600 opacity-0 group-hover:opacity-100
                     transition-all duration-200
                     shadow-sm border border-white/50"
          >
            <Bars3Icon className="h-3.5 w-3.5" />
          </div>

          {/* Config Badge - Modern pill style */}
          <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5
                        bg-black/60 backdrop-blur-md rounded-full
                        text-white text-[10px] font-bold tracking-wide
                        border border-white/10 shadow-lg">
            {formatConfig()}
          </div>

          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent
                        opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Content */}
        <div className="px-2.5 py-2 bg-gradient-to-b from-white to-gray-50/50">
          <p className="text-xs font-semibold text-gray-800 truncate leading-tight">
            {getExerciseName(exerciseData) || t('common:unknown')}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`inline-block w-2 h-2 rounded-full bg-gradient-to-r ${muscleStyle.gradient} shadow-sm`} />
            <span className="text-[10px] text-gray-500 truncate capitalize">
              {(() => {
                // For cardio, always show exercise class (never muscle group)
                if (exerciseData?.exercise_class === 'cardio') {
                  const subclass = exerciseData?.cardio_subclass;
                  const label = subclass || 'cardio';
                  return t(`exercises:exerciseClasses.${label}`, {
                    defaultValue: label.replace('_', ' ')
                  });
                }

                // For strength exercises, show muscle or exercise class
                const labelInfo = getExerciseLabel(exerciseData);
                return labelInfo.isMuscle
                  ? t(`exercises:muscleGroups.${labelInfo.label}`, { defaultValue: labelInfo.label.replace('_', ' ') })
                  : t(`exercises:exerciseClasses.${labelInfo.label}`, { defaultValue: labelInfo.label.replace('_', ' ') });
              })()}
            </span>
            {dayExercise.rest_seconds > 0 && (
              <div className="flex items-center gap-0.5 text-gray-400 ml-auto">
                <ClockIcon className="h-2.5 w-2.5" />
                <span className="text-[10px]">{dayExercise.rest_seconds}s</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Drag Overlay version
export function KanbanExerciseCardOverlay({
  dayExercise,
  exercise,
}: {
  dayExercise: DayExercise;
  exercise?: Exercise;
}) {
  return (
    <KanbanExerciseCard
      dayExercise={dayExercise}
      exercise={exercise}
      isDraggingOverlay={true}
    />
  );
}

// Library card (for the exercise library panel)
interface LibraryExerciseCardProps {
  exercise: Exercise;
}

export function LibraryExerciseCard({ exercise }: LibraryExerciseCardProps) {
  const { t } = useTranslation(['exercises', 'common']);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `library-${exercise.id}`,
    data: {
      type: 'library-exercise',
      exercise,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const primaryMuscle = getPrimaryMuscleName(exercise);
  const muscleStyle = getMuscleStyle(primaryMuscle);

  const getImageSrc = (url: string | null | undefined) => {
    return getExerciseImageUrl(url, exercise.updated_at);
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: isDragging ? 0.5 : 1,
        scale: isDragging ? 1.05 : 1,
      }}
      whileHover={{
        scale: 1.03,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
      className={`
        bg-white rounded-xl overflow-hidden cursor-grab active:cursor-grabbing
        border border-gray-100 shadow-sm
        hover:shadow-md hover:border-gray-200
        transition-all duration-200
        ${isDragging ? `ring-2 ring-primary-400 ${muscleStyle.glow} shadow-lg` : ''}
      `}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        {(exercise.image_url || exercise.thumbnail_url) ? (
          <img
            src={getImageSrc(exercise.image_url || exercise.thumbnail_url) ?? undefined}
            alt={getExerciseName(exercise)}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${muscleStyle.gradient}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white text-lg font-black opacity-30">
                {getExerciseName(exercise).charAt(0)}
              </span>
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-1.5 bg-gradient-to-b from-white to-gray-50/50">
        <p className="text-[10px] font-semibold text-gray-800 truncate leading-tight">
          {getExerciseName(exercise)}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full bg-gradient-to-r ${muscleStyle.gradient}`} />
          <span className="text-[9px] text-gray-500 truncate capitalize">
            {(() => {
              const labelInfo = getExerciseLabel(exercise);
              return labelInfo.isMuscle
                ? t(`exercises:muscleGroups.${labelInfo.label}`, { defaultValue: labelInfo.label.replace('_', ' ') })
                : t(`exercises:exerciseClasses.${labelInfo.label}`, { defaultValue: labelInfo.label.replace('_', ' ') });
            })()}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// Overlay for library card being dragged
export function LibraryExerciseCardOverlay({ exercise }: { exercise: Exercise }) {
  const primaryMuscle = getPrimaryMuscleName(exercise);
  const muscleStyle = getMuscleStyle(primaryMuscle);

  const getImageSrc = (url: string | null | undefined) => {
    return getExerciseImageUrl(url, exercise.updated_at);
  };

  return (
    <motion.div
      initial={{ scale: 1, rotate: 0 }}
      animate={{ scale: 1.1, rotate: 2 }}
      className={`bg-white rounded-xl overflow-hidden w-28
                  shadow-2xl ring-2 ring-primary-500 ${muscleStyle.glow}`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        {(exercise.image_url || exercise.thumbnail_url) ? (
          <img
            src={getImageSrc(exercise.image_url || exercise.thumbnail_url) ?? undefined}
            alt={getExerciseName(exercise)}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${muscleStyle.gradient}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white text-lg font-black opacity-30">
                {getExerciseName(exercise).charAt(0)}
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="p-1.5">
        <p className="text-[10px] font-semibold text-gray-800 truncate">
          {getExerciseName(exercise)}
        </p>
      </div>
    </motion.div>
  );
}
