import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { arrayMove } from '@dnd-kit/sortable';
import { PencilIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { Button } from '../common/Button';
import { generateMicrocyclePDF } from '../../utils/pdfGenerator';
import { ExerciseLibraryPanel } from './ExerciseLibraryPanel';
import { DayColumn, AddDayColumn } from './DayColumn';
import { ExerciseConfigModal, ExerciseConfigData } from './ExerciseConfigModal';
import { KanbanExerciseCardOverlay, LibraryExerciseCardOverlay } from './KanbanExerciseCard';
import { useClientStore } from '../../store/clientStore';
import type { Microcycle, TrainingDay, Exercise, DayExercise, ExercisePhase } from '../../types';

interface MicrocycleKanbanBoardProps {
  microcycle: Microcycle;
  trainingDays: TrainingDay[];
  exercises: Exercise[];
  onAddDay: () => void;
  onEditDay: (dayId: string) => void;
  onDeleteDay: (dayId: string) => void;
  onCreateDayExercise: (dayId: string, exerciseId: string, config: ExerciseConfigData) => Promise<void>;
  onUpdateDayExercise: (dayExerciseId: string, config: ExerciseConfigData) => Promise<void>;
  onDeleteDayExercise: (dayExerciseId: string) => Promise<void>;
  onReorderExercises: (dayId: string, exerciseIds: string[]) => Promise<void>;
  onMoveExercise: (exerciseId: string, fromDayId: string, toDayId: string, newIndex: number) => Promise<void>;
  onEditMicrocycle?: () => void;
  onUpdateMicrocycle?: (name: string) => Promise<void>;
  onUpdateDayName?: (dayId: string, name: string) => Promise<void>;
  hideHeader?: boolean; // Hide header when embedded in MicrocycleCard
}

interface ActiveDragItem {
  type: 'library-exercise' | 'day-exercise';
  exercise?: Exercise;
  dayExercise?: DayExercise;
}

export function MicrocycleKanbanBoard({
  microcycle,
  trainingDays,
  exercises,
  onAddDay,
  onEditDay,
  onDeleteDay,
  onCreateDayExercise,
  onUpdateDayExercise,
  onDeleteDayExercise,
  onReorderExercises,
  onMoveExercise,
  onEditMicrocycle,
  onUpdateMicrocycle,
  onUpdateDayName,
  hideHeader = false,
}: MicrocycleKanbanBoardProps) {
  const { t } = useTranslation(['training', 'common']);
  const { selectedClient } = useClientStore();
  const [activeItem, setActiveItem] = useState<ActiveDragItem | null>(null);
  const [overDayId, setOverDayId] = useState<string | null>(null);
  const [overSection, setOverSection] = useState<'warmup' | 'main' | 'cooldown' | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedDayExercise, setSelectedDayExercise] = useState<DayExercise | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [microcycleName, setMicrocycleName] = useState(microcycle.name);

  // Update local state when prop changes
  useEffect(() => {
    setMicrocycleName(microcycle.name);
  }, [microcycle.name]);

  const handleNameBlur = async () => {
    setIsEditingName(false);
    if (microcycleName !== microcycle.name && onUpdateMicrocycle) {
      await onUpdateMicrocycle(microcycleName);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setMicrocycleName(microcycle.name);
      setIsEditingName(false);
    }
  };
  const [pendingNewExercise, setPendingNewExercise] = useState<{
    exercise: Exercise;
    dayId: string;
    phase?: ExercisePhase;
  } | null>(null);

  // Sort training days by day_number
  const sortedDays = [...trainingDays].sort((a, b) => a.day_number - b.day_number);

  // Configure sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Find exercise info by ID
  const findExerciseById = (exerciseId: string): Exercise | undefined => {
    return exercises.find((e) => e.id === exerciseId);
  };

  // Find day exercise and its day
  const findDayExerciseById = (id: string): { dayExercise: DayExercise; day: TrainingDay } | null => {
    for (const day of trainingDays) {
      const dayExercise = day.exercises?.find((e) => e.id === id);
      if (dayExercise) {
        return { dayExercise, day };
      }
    }
    return null;
  };

  // Get exercises for a day
  const getExercisesForDay = useCallback((dayId: string): DayExercise[] => {
    const day = trainingDays.find((d) => d.id === dayId);
    return day?.exercises ? [...day.exercises].sort((a, b) => a.order_index - b.order_index) : [];
  }, [trainingDays]);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const id = active.id as string;

    if (id.startsWith('library-')) {
      // Dragging from library
      const exerciseId = id.replace('library-', '');
      const exercise = findExerciseById(exerciseId);
      if (exercise) {
        setActiveItem({ type: 'library-exercise', exercise });
      }
    } else {
      // Dragging existing day exercise
      const result = findDayExerciseById(id);
      if (result) {
        const exercise = result.dayExercise.exercise || findExerciseById(result.dayExercise.exercise_id);
        setActiveItem({ type: 'day-exercise', dayExercise: result.dayExercise, exercise });
      }
    }
  }, [exercises, trainingDays]);

  // Handle drag over (for visual feedback)
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverDayId(null);
      setOverSection(null);
      return;
    }

    const overId = over.id as string;
    if (overId.startsWith('day-')) {
      setOverDayId(overId.replace('day-', ''));
      setOverSection('main'); // Default to main when dropping on column header
    } else if (overId.startsWith('warmup-')) {
      setOverDayId(overId.replace('warmup-', ''));
      setOverSection('warmup');
    } else if (overId.startsWith('main-')) {
      setOverDayId(overId.replace('main-', ''));
      setOverSection('main');
    } else if (overId.startsWith('cooldown-')) {
      setOverDayId(overId.replace('cooldown-', ''));
      setOverSection('cooldown');
    } else {
      // Si está sobre un ejercicio, encontrar su día y fase
      const result = findDayExerciseById(overId);
      setOverDayId(result?.day.id || null);
      setOverSection(result?.dayExercise.phase || null);
    }
  }, [trainingDays]);

  // Handle drag end
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    setOverDayId(null);
    setOverSection(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Determine target day and section
    let targetDayId: string | null = null;
    let targetPhase: ExercisePhase = 'main';

    if (overId.startsWith('day-')) {
      targetDayId = overId.replace('day-', '');
      targetPhase = 'main'; // Default to main if dropped on header
    } else if (overId.startsWith('warmup-')) {
      targetDayId = overId.replace('warmup-', '');
      targetPhase = 'warmup';
    } else if (overId.startsWith('main-')) {
      targetDayId = overId.replace('main-', '');
      targetPhase = 'main';
    } else if (overId.startsWith('cooldown-')) {
      targetDayId = overId.replace('cooldown-', '');
      targetPhase = 'cooldown';
    } else {
      // Dropping on an exercise - find its day and use its phase
      const result = findDayExerciseById(overId);
      if (result) {
        targetDayId = result.day.id;
        targetPhase = result.dayExercise.phase;
      }
    }

    if (!targetDayId) return;

    if (activeId.startsWith('library-')) {
      // Dropping from library - create new day exercise
      const exerciseId = activeId.replace('library-', '');
      const exercise = findExerciseById(exerciseId);
      if (exercise) {
        // Open config modal for new exercise
        setPendingNewExercise({ exercise, dayId: targetDayId, phase: targetPhase });
        setConfigModalOpen(true);
      }
    } else {
      // Moving existing exercise
      const sourceResult = findDayExerciseById(activeId);
      if (!sourceResult) return;

      const sourceDayId = sourceResult.day.id;
      const exercise = sourceResult.dayExercise;

      // Check if we need to update phase
      if (exercise.phase !== targetPhase) {
        await onUpdateDayExercise(exercise.id, {
          ...exercise,
          tempo: exercise.tempo || '',
          notes: exercise.notes || '',
          phase: targetPhase
        });
      }

      if (sourceDayId === targetDayId) {
        // Same day reorder
        const dayExercises = getExercisesForDay(sourceDayId);

        // Filter by section to get correct index relative to the whole list if needed, 
        // but arrayMove works on the whole list.
        // However, if we change phase, the visual position changes "virtually" before the data update?
        // Actually, if we change phase, we are effectively moving it to another list in the UI (SortableContext).

        const oldIndex = dayExercises.findIndex((e) => e.id === activeId);
        let newIndex = dayExercises.findIndex((e) => e.id === overId);

        if (overId.startsWith('day-') || overId.startsWith('warmup-') || overId.startsWith('main-') || overId.startsWith('cooldown-')) {
          // Dropped on empty area - move to end of that section

          // If we changed sections, we just put it at the end of the new section.
          // We already updated the phase above.

          // If same section, move to end
          newIndex = dayExercises.length - 1;
        }

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const newOrder = arrayMove(dayExercises, oldIndex, newIndex);
          await onReorderExercises(sourceDayId, newOrder.map((e) => e.id));
        }
      } else {
        // Cross-day move
        const targetExercises = getExercisesForDay(targetDayId);
        let newIndex = targetExercises.length; // Default to end

        if (!overId.startsWith('day-') && !overId.startsWith('warmup-') && !overId.startsWith('main-') && !overId.startsWith('cooldown-')) {
          const overIndex = targetExercises.findIndex((e) => e.id === overId);
          if (overIndex !== -1) {
            newIndex = overIndex;
          }
        }

        await onMoveExercise(activeId, sourceDayId, targetDayId, newIndex);

        // Ensure phase is correct after move
        if (exercise.phase !== targetPhase) {
          // We need to wait for the move to finish, then update.
          // But we don't have the new ID if it changes (it shouldn't).
          await onUpdateDayExercise(activeId, {
            ...exercise,
            tempo: exercise.tempo || '',
            notes: exercise.notes || '',
            phase: targetPhase
          });
        }
      }
    }
  }, [trainingDays, exercises, getExercisesForDay, onReorderExercises, onMoveExercise, onUpdateDayExercise]);

  // Handle exercise card click
  const handleExerciseClick = (dayExercise: DayExercise) => {
    setSelectedDayExercise(dayExercise);
    setPendingNewExercise(null);
    setConfigModalOpen(true);
  };

  // Handle config modal save
  const handleConfigSave = async (config: ExerciseConfigData) => {
    if (pendingNewExercise) {
      // Creating new exercise
      await onCreateDayExercise(pendingNewExercise.dayId, pendingNewExercise.exercise.id, config);
      setPendingNewExercise(null);
    } else if (selectedDayExercise) {
      // Updating existing
      await onUpdateDayExercise(selectedDayExercise.id, config);
      setSelectedDayExercise(null);
    }
    setConfigModalOpen(false);
  };

  // Handle config modal delete
  const handleConfigDelete = async () => {
    if (selectedDayExercise) {
      await onDeleteDayExercise(selectedDayExercise.id);
      setSelectedDayExercise(null);
      setConfigModalOpen(false);
    }
  };

  // Handle PDF generation with confirmation
  const handlePrintPDF = async () => {
    console.log('Print PDF button clicked - showing confirmation');

    const confirmMessage = [
      t('training:microcycle.printConfirm.title', { name: microcycle.name }),
      '',
      `${t('training:microcycle.printConfirm.week')}: ${microcycle.week_number}`,
      `${t('training:microcycle.printConfirm.intensity')}: ${t(`training:intensity.${microcycle.intensity_level}`)}`,
      `${t('training:microcycle.printConfirm.days')}: ${sortedDays.length}`,
      selectedClient?.full_name ? `${t('training:microcycle.printConfirm.client')}: ${selectedClient.full_name}` : ''
    ].filter(Boolean).join('\n');

    const userConfirmed = window.confirm(confirmMessage);
    console.log('User confirmation result:', userConfirmed);

    if (userConfirmed) {
      console.log('Generating PDF...');
      await generateMicrocyclePDF(
        microcycle,
        trainingDays,
        exercises,
        t,
        selectedClient?.full_name,
        undefined // TODO: Add selectedClient?.profile_photo_url when field is added to User model
      );
      console.log('PDF generation complete');
    } else {
      console.log('PDF generation cancelled by user');
    }
  };

  // Get exercise for modal
  const getModalExercise = (): Exercise | null => {
    if (pendingNewExercise) {
      return pendingNewExercise.exercise;
    }
    if (selectedDayExercise) {
      return selectedDayExercise.exercise || findExerciseById(selectedDayExercise.exercise_id) || null;
    }
    return null;
  };

  // Intensity badge color
  const getIntensityColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      case 'deload': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 rounded-2xl overflow-hidden shadow-inner">
        {/* Header - Hidden when embedded in MicrocycleCard */}
        {!hideHeader && (
          <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div>
                <div>
                  {isEditingName ? (
                    <input
                      type="text"
                      value={microcycleName}
                      onChange={(e) => setMicrocycleName(e.target.value)}
                      onBlur={handleNameBlur}
                      onKeyDown={handleNameKeyDown}
                      autoFocus
                      className="font-semibold text-gray-900 border-b border-primary-500 outline-none bg-transparent"
                    />
                  ) : (
                    <h2
                      className="font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 px-1 rounded -ml-1 transition-colors"
                      onClick={() => setIsEditingName(true)}
                      title={t('common:clickToEdit')}
                    >
                      {t('training:microcycle.header', { number: microcycle.week_number, name: microcycle.name })}
                    </h2>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 text-xs rounded font-medium ${getIntensityColor(microcycle.intensity_level)}`}>
                      {t(`training:intensity.${microcycle.intensity_level}`)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {t('training:microcycle.dayCount', { count: sortedDays.length })}
                    </span>
                  </div>
                </div>
              </div>
              {onEditMicrocycle && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handlePrintPDF}>
                    <PrinterIcon className="h-4 w-4 mr-1" />
                    {t('training:microcycle.printPdf')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onEditMicrocycle}>
                    <PencilIcon className="h-4 w-4 mr-1" />
                    {t('training:microcycle.edit')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Exercise Library Panel */}
          <ExerciseLibraryPanel />

          {/* Day Columns */}
          <div className="flex-1 overflow-x-auto p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/50 via-transparent to-transparent">
            <div className="flex gap-4 min-h-full">
              {sortedDays.map((day) => (
                <DayColumn
                  key={day.id}
                  trainingDay={day}
                  exercises={exercises}
                  onExerciseClick={handleExerciseClick}
                  onEditDay={() => onEditDay(day.id)}
                  onDeleteDay={() => onDeleteDay(day.id)}
                  onUpdateDayName={(name) => onUpdateDayName?.(day.id, name)}
                  isBeingDraggedOver={overDayId === day.id && activeItem !== null}
                  isWarmupDraggedOver={overDayId === day.id && overSection === 'warmup' && activeItem !== null}
                  isMainDraggedOver={overDayId === day.id && overSection === 'main' && activeItem !== null}
                  isCooldownDraggedOver={overDayId === day.id && overSection === 'cooldown' && activeItem !== null}
                />
              ))}
              <AddDayColumn onClick={onAddDay} />
            </div>
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={null}>
        {activeItem?.type === 'library-exercise' && activeItem.exercise && (
          <LibraryExerciseCardOverlay exercise={activeItem.exercise} />
        )}
        {activeItem?.type === 'day-exercise' && activeItem.dayExercise && (
          <KanbanExerciseCardOverlay
            dayExercise={activeItem.dayExercise}
            exercise={activeItem.exercise}
          />
        )}
      </DragOverlay>

      {/* Configuration Modal */}
      <ExerciseConfigModal
        isOpen={configModalOpen}
        onClose={() => {
          setConfigModalOpen(false);
          setSelectedDayExercise(null);
          setPendingNewExercise(null);
        }}
        dayExercise={selectedDayExercise}
        exercise={getModalExercise()}
        initialPhase={pendingNewExercise?.phase}
        onSave={handleConfigSave}
        onDelete={selectedDayExercise ? handleConfigDelete : undefined}
      />
    </DndContext>
  );
}
