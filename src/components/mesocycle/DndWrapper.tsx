import { useState, useCallback } from 'react';
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
import { arrayMove } from '@dnd-kit/sortable';
import { ExerciseDragOverlay } from './SortableExerciseItem';
import type { DayExercise, Exercise, TrainingDay } from '../../types';

interface DndWrapperProps {
  children: React.ReactNode;
  trainingDays: Record<string, TrainingDay[]>;
  exercises: Exercise[];
  onReorderExercises: (
    dayId: string,
    exerciseIds: string[]
  ) => Promise<void>;
  onMoveExercise: (
    exerciseId: string,
    fromDayId: string,
    toDayId: string,
    newIndex: number
  ) => Promise<void>;
}

export function DndWrapper({
  children,
  trainingDays,
  exercises,
  onReorderExercises,
  onMoveExercise,
}: DndWrapperProps) {
  const [activeExercise, setActiveExercise] = useState<DayExercise | null>(null);

  // Configure sensors for different input types
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // Long press delay for touch
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Find exercise by ID across all days
  const findExerciseById = useCallback((id: string): { exercise: DayExercise; dayId: string } | null => {
    for (const days of Object.values(trainingDays)) {
      for (const day of days) {
        const exercise = day.exercises?.find((e) => e.id === id);
        if (exercise) {
          return { exercise, dayId: day.id };
        }
      }
    }
    return null;
  }, [trainingDays]);


  // Get exercises for a specific day
  const getExercisesForDay = useCallback((dayId: string): DayExercise[] => {
    for (const days of Object.values(trainingDays)) {
      const day = days.find((d) => d.id === dayId);
      if (day) {
        return [...(day.exercises || [])].sort((a, b) => a.order_index - b.order_index);
      }
    }
    return [];
  }, [trainingDays]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const found = findExerciseById(active.id as string);
    if (found) {
      setActiveExercise(found.exercise);
    }
  }, [findExerciseById]);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Could add visual feedback here for cross-day drags
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveExercise(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find source info
    const sourceInfo = findExerciseById(activeId);
    if (!sourceInfo) return;

    const sourceDayId = sourceInfo.dayId;

    // Determine target day
    let targetDayId: string | null = null;

    // Check if dropping on a day (empty day)
    if (overId.startsWith('day-')) {
      targetDayId = overId.replace('day-', '');
    } else {
      // Dropping on another exercise
      const targetInfo = findExerciseById(overId);
      if (targetInfo) {
        targetDayId = targetInfo.dayId;
      }
    }

    if (!targetDayId) return;

    // Same day reorder
    if (sourceDayId === targetDayId) {
      const dayExercises = getExercisesForDay(sourceDayId);
      const oldIndex = dayExercises.findIndex((e) => e.id === activeId);
      const newIndex = dayExercises.findIndex((e) => e.id === overId);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newOrder = arrayMove(dayExercises, oldIndex, newIndex);
        const exerciseIds = newOrder.map((e) => e.id);
        await onReorderExercises(sourceDayId, exerciseIds);
      }
    } else {
      // Cross-day move
      const targetExercises = getExercisesForDay(targetDayId);
      let newIndex = targetExercises.length; // Default to end

      // If dropping on an exercise, insert at that position
      if (!overId.startsWith('day-')) {
        const overIndex = targetExercises.findIndex((e) => e.id === overId);
        if (overIndex !== -1) {
          newIndex = overIndex;
        }
      }

      await onMoveExercise(activeId, sourceDayId, targetDayId, newIndex);
    }
  }, [findExerciseById, getExercisesForDay, onReorderExercises, onMoveExercise]);

  // Find the Exercise object for display in overlay
  const activeExerciseData = activeExercise
    ? exercises.find((e) => e.id === activeExercise.exercise_id) || activeExercise.exercise
    : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeExercise ? (
          <ExerciseDragOverlay
            dayExercise={activeExercise}
            exercise={activeExerciseData}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
