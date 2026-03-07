import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  Squares2X2Icon,
  ListBulletIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import type { Microcycle, TrainingDay, Exercise } from '../../types';
import { TrainingDayCard } from './TrainingDayCard';
import { MicrocycleKanbanBoard } from './MicrocycleKanbanBoard';
import { generateMicrocyclePDF } from '../../utils/pdfGenerator';
import { useClientStore } from '../../store/clientStore';
import type { ExerciseConfigData } from './ExerciseConfigModal';

type ViewMode = 'list' | 'kanban';

interface MicrocycleCardProps {
  microcycle: Microcycle;
  trainingDays: TrainingDay[];
  exercises: Exercise[];
  onEdit?: () => void;
  onDelete?: () => void;
  onAddDay?: () => void;
  onAddExercise?: (trainingDayId: string) => void;
  onEditExercise?: (trainingDayId: string, exerciseId: string) => void;
  onDeleteExercise?: (trainingDayId: string, exerciseId: string) => void;
  // Kanban-specific props
  onEditDay?: (dayId: string) => void;
  onDeleteDay?: (dayId: string) => void;
  onCreateDayExercise?: (dayId: string, exerciseId: string, config: ExerciseConfigData) => Promise<void>;
  onUpdateDayExercise?: (dayExerciseId: string, config: ExerciseConfigData) => Promise<void>;
  onDeleteDayExercise?: (dayExerciseId: string) => Promise<void>;
  onReorderExercises?: (dayId: string, exerciseIds: string[]) => Promise<void>;
  onMoveExercise?: (exerciseId: string, fromDayId: string, toDayId: string, newIndex: number) => Promise<void>;
  hideHeader?: boolean; // Hide header when embedded in tabs
  onUpdateMicrocycle?: (name: string) => Promise<void>;
  onUpdateDayName?: (dayId: string, name: string) => Promise<void>;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export function MicrocycleCard({
  microcycle,
  trainingDays,
  exercises,
  onEdit,
  onDelete,
  onAddDay,
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
  // Kanban props
  onEditDay,
  onDeleteDay,
  onCreateDayExercise,
  onUpdateDayExercise,
  onDeleteDayExercise,
  onReorderExercises,
  onMoveExercise,
  hideHeader = false,
  // Controlled view mode
  viewMode: controlledViewMode,
  onViewModeChange,
  onUpdateMicrocycle,
  onUpdateDayName,
}: MicrocycleCardProps) {
  const { t } = useTranslation();
  const { selectedClient } = useClientStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('list');

  // Use controlled mode if props are provided, otherwise use internal state
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = (mode: ViewMode) => {
    if (onViewModeChange) {
      onViewModeChange(mode);
    } else {
      setInternalViewMode(mode);
    }
  };

  // Check if kanban props are available
  const kanbanEnabled = !!(onEditDay && onDeleteDay && onCreateDayExercise && onUpdateDayExercise && onDeleteDayExercise && onReorderExercises && onMoveExercise);

  const getIntensityColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'deload':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={hideHeader ? '' : 'border-l-4 border-primary-500 bg-white rounded-lg shadow-sm'}>
      {/* Header - Hidden when embedded in tabs */}
      {!hideHeader ? (
        <div className="p-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <ChevronUpIcon className="h-5 w-5" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5" />
                  )}
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {t('training:microcycle.header', { number: microcycle.week_number, name: microcycle.name })}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getIntensityColor(microcycle.intensity_level)}`}>
                      {t(`training:intensity.${microcycle.intensity_level}`)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {format(new Date(microcycle.start_date), 'MMM d')} -{' '}
                    {format(new Date(microcycle.end_date), 'MMM d, yyyy')} •{' '}
                    {t('training:microcycle.dayCount', { count: trainingDays.length })}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              {kanbanEnabled && (
                <div className="inline-flex rounded-lg bg-gray-200 p-1">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    <ListBulletIcon className="h-4 w-4" />
                    {t('training:microcycle.viewMode.list')}
                  </button>
                  <button
                    onClick={() => setViewMode('kanban')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'kanban'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    <Squares2X2Icon className="h-4 w-4" />
                    {t('training:microcycle.viewMode.kanban')}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    generateMicrocyclePDF(
                      microcycle,
                      trainingDays,
                      exercises,
                      t,
                      selectedClient?.full_name,
                      undefined // TODO: Add client photo URL when available
                    );
                  }}
                >
                  <PrinterIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <PencilIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={onDelete}>
                  <TrashIcon className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          </div>

          {microcycle.notes && (
            <p className="mt-2 text-sm text-gray-600 ml-12">{microcycle.notes}</p>
          )}
        </div>
      ) : (
        /* Simplified header when embedded in tabs - just the view toggle */
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">{microcycle.name}</span>
            {microcycle.notes && (
              <span className="text-gray-400">• {microcycle.notes}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Print PDF Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                generateMicrocyclePDF(
                  microcycle,
                  trainingDays,
                  exercises,
                  t,
                  selectedClient?.full_name,
                  undefined // TODO: Add client photo URL when available
                );
              }}
            >
              <PrinterIcon className="h-4 w-4" />
            </Button>
            {/* View Mode Toggle */}
            {kanbanEnabled && (
              <div className="inline-flex rounded-lg bg-gray-200 p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <ListBulletIcon className="h-4 w-4" />
                  {t('training:microcycle.viewMode.list')}
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'kanban'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <Squares2X2Icon className="h-4 w-4" />
                  {t('training:microcycle.viewMode.kanban')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content - List or Kanban View */}
      {(hideHeader || isExpanded) && (
        <>
          {viewMode === 'list' ? (
            /* List View */
            <div className="p-4 space-y-4">
              {trainingDays.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-4">{t('training:microcycle.noDays')}</p>
                  <Button variant="secondary" size="sm" onClick={onAddDay}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    {t('training:microcycle.addDay')}
                  </Button>
                </div>
              ) : (
                <>
                  {trainingDays
                    .sort((a, b) => a.day_number - b.day_number)
                    .map((day) => (
                      <TrainingDayCard
                        key={day.id}
                        trainingDay={day}
                        exercises={exercises}
                        onAddExercise={() => onAddExercise?.(day.id)}
                        onEditExercise={(exerciseId) => onEditExercise?.(day.id, exerciseId)}
                        onDeleteExercise={(exerciseId) => onDeleteExercise?.(day.id, exerciseId)}
                      />
                    ))}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onAddDay}
                    className="w-full"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    {t('training:microcycle.addDay')}
                  </Button>
                </>
              )}
            </div>
          ) : (
            /* Kanban View */
            kanbanEnabled && (
              <div className="h-[700px] overflow-hidden rounded-xl">
                <MicrocycleKanbanBoard
                  microcycle={microcycle}
                  trainingDays={trainingDays}
                  exercises={exercises}
                  onAddDay={onAddDay!}
                  onEditDay={onEditDay!}
                  onDeleteDay={onDeleteDay!}
                  onCreateDayExercise={onCreateDayExercise!}
                  onUpdateDayExercise={onUpdateDayExercise!}
                  onDeleteDayExercise={onDeleteDayExercise!}
                  onReorderExercises={onReorderExercises!}
                  onMoveExercise={onMoveExercise!}
                  onUpdateMicrocycle={onUpdateMicrocycle}
                  onUpdateDayName={onUpdateDayName}
                  hideHeader
                />
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}