import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { MesocycleCard } from '../components/mesocycle/MesocycleCard';
import { ExerciseSelector, ExerciseConfig } from '../components/mesocycle/ExerciseSelector';
import { DndWrapper } from '../components/mesocycle/DndWrapper';
import { MicrocycleKanbanBoard } from '../components/mesocycle/MicrocycleKanbanBoard';
import { ExerciseConfigData } from '../components/mesocycle/ExerciseConfigModal';
import { useMesocycleStore } from '../store/mesocycleStore';
import { useAuthStore } from '../store/newAuthStore';
import { useProfessionalClients } from '../features/professional-clients/queries';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { resolveTrainingAIAccess } from '@/features/subscriptions/planAccess';
import {
  ArrowLeftIcon,
  PlusIcon,
  CheckIcon,
  SparklesIcon,
  XMarkIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import type { Exercise, Microcycle } from '../types';

// Extracted modal components
import { MesocycleModal, MicrocycleModal, TrainingDayModal } from './mesocycle-editor/modals';

const macrocycleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  objective: z.string().min(1, 'Objective is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  client_id: z.string().optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
});

type MacrocycleFormData = z.infer<typeof macrocycleSchema>;

const normalizeClientId = (value: unknown): string => String(value ?? '').trim();

export function MesocycleEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isNew = !id;
  const { t } = useTranslation(['training', 'ai']);

  const { user } = useAuthStore();
  const { userData, professional } = useProfessional();
  const accessUser = useMemo(() => {
    const baseUser = user ?? userData ?? null;
    if (!baseUser) {
      return null;
    }

    const baseAny = baseUser as unknown as {
      professional_role?: unknown;
      professional_roles?: unknown;
    };
    const professionalAny = professional as unknown as {
      professional_role?: unknown;
      professional_roles?: unknown;
    } | null;

    const mergedRoles = new Set<string>();
    const collectRoles = (raw: unknown) => {
      if (!raw) return;
      if (typeof raw === 'string') {
        raw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => mergedRoles.add(item.toUpperCase()));
        return;
      }
      if (Array.isArray(raw)) {
        raw
          .map((item) => String(item).trim().toUpperCase())
          .filter(Boolean)
          .forEach((item) => mergedRoles.add(item));
      }
    };

    collectRoles(baseAny.professional_role);
    collectRoles(baseAny.professional_roles);
    collectRoles(professionalAny?.professional_role);
    collectRoles(professionalAny?.professional_roles);

    if (!mergedRoles.size) {
      return baseUser;
    }

    return {
      ...baseUser,
      professional_role: Array.from(mergedRoles),
    };
  }, [user, userData, professional]);
  const aiAccess = resolveTrainingAIAccess(accessUser);
  const canUseAIGenerator = aiAccess.canAccess;
  const aiRestrictionMessage = aiAccess.reason === 'missing_plan'
    ? t('ai:page.trainingPlanRequired')
    : aiAccess.reason === 'missing_trainer_role'
      ? t('ai:page.trainerRoleRequired')
      : '';
  const professionalId = user?.id || '';
  const { data: nutritionClients = [] } = useProfessionalClients(professionalId);
  const {
    currentMacrocycle,
    mesocycles,
    microcycles,
    trainingDays,
    exercises,
    isLoadingMacrocycle,
    loadMacrocycle,
    createMacrocycle,
    updateMacrocycle,
    createMesocycle,
    createMicrocycle,
    updateMicrocycle,
    createTrainingDay,
    updateTrainingDay,
    createDayExercise,
    updateDayExercise,
    deleteDayExercise,
    deleteTrainingDay,
    reorderExercises,
    moveExerciseBetweenDays,
    loadExercises,
  } = useMesocycleStore();

  const [isSaving, setIsSaving] = useState(false);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [selectedContext, setSelectedContext] = useState<{
    macrocycleId: string;
    mesocycleId: string;
    microcycleId: string;
    dayId: string;
  } | null>(null);

  // Modals state
  const [showMesocycleModal, setShowMesocycleModal] = useState(false);
  const [showMicrocycleModal, setShowMicrocycleModal] = useState(false);
  const [selectedMesocycleId, setSelectedMesocycleId] = useState<string | null>(null);
  const [showTrainingDayModal, setShowTrainingDayModal] = useState(false);
  const [selectedMicrocycleId, setSelectedMicrocycleId] = useState<string | null>(null);

  // Kanban board modal state (legacy - keeping for backwards compatibility but can be removed)
  const [showKanbanBoard, setShowKanbanBoard] = useState(false);
  const [kanbanContext, setKanbanContext] = useState<{
    mesocycleId: string;
    microcycleId: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
    reset,
  } = useForm<MacrocycleFormData>({
    resolver: zodResolver(macrocycleSchema),
    defaultValues: {
      status: 'draft',
      client_id: '',
      objective: 'hypertrophy',
    },
  });

  useEffect(() => {
    if (!isNew && id) {
      loadMacrocycle(id);
      loadExercises();
    }
  }, [id, isNew, loadMacrocycle, loadExercises]);

  useEffect(() => {
    if (currentMacrocycle && !isNew) {
      reset({
        name: currentMacrocycle.name,
        description: currentMacrocycle.description || '',
        objective: currentMacrocycle.objective || 'hypertrophy',
        start_date: format(new Date(currentMacrocycle.start_date), 'yyyy-MM-dd'),
        end_date: format(new Date(currentMacrocycle.end_date), 'yyyy-MM-dd'),
        client_id: currentMacrocycle.client_id || '',
        status: currentMacrocycle.status,
      });
    }
  }, [currentMacrocycle, isNew, reset]);

  const onSubmit = async (data: MacrocycleFormData) => {
    setIsSaving(true);
    try {
      if (isNew) {
        const selectedNutritionClientId = normalizeClientId(data.client_id) || null;
        const createData = {
          name: data.name,
          description: data.description,
          objective: data.objective,
          start_date: data.start_date,
          end_date: data.end_date,
          client_id: selectedNutritionClientId,
        };
        const macrocycle = await createMacrocycle(createData);
        toast.success('Training program created successfully');
        navigate(`/training/programs/${macrocycle.id}`);
      } else if (id) {
        await updateMacrocycle(id, {
          name: data.name,
          description: data.description,
          objective: data.objective,
          start_date: data.start_date,
          end_date: data.end_date,
          status: data.status,
        });
        toast.success('Training program updated successfully');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save training program');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAIGenerator = () => {
    const selectedClientId = normalizeClientId(getValues('client_id'));
    const search = selectedClientId
      ? `?client_id=${encodeURIComponent(selectedClientId)}`
      : '';
    navigate(`/training/ai-generator${search}`);
  };

  const handleAddMesocycle = async (mesocycleData: any) => {
    if (!currentMacrocycle) return;

    try {
      await createMesocycle(currentMacrocycle.id, mesocycleData);
      toast.success('Mesocycle added successfully');
      setShowMesocycleModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add mesocycle');
    }
  };

  const handleAddMicrocycle = async (microcycleData: any) => {
    if (!currentMacrocycle || !selectedMesocycleId) return;

    try {
      const microcycle = await createMicrocycle(currentMacrocycle.id, selectedMesocycleId, microcycleData);

      // Auto-create 7 training days for the new microcycle
      const startDate = new Date(microcycleData.start_date);
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + i);

        await createTrainingDay(
          currentMacrocycle.id,
          selectedMesocycleId,
          microcycle.id,
          {
            day_number: i + 1,
            name: `Day ${i + 1} - ${dayNames[i]}`,
            date: dayDate.toISOString().split('T')[0],
            focus: '',
            notes: '',
          }
        );
      }

      toast.success('Microcycle added with 7 training days');
      setShowMicrocycleModal(false);
      setSelectedMesocycleId(null);

      // Reload to get updated data
      loadMacrocycle(currentMacrocycle.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add microcycle');
    }
  };

  const handleAddTrainingDay = async (dayData: any) => {
    if (!currentMacrocycle || !selectedMesocycleId || !selectedMicrocycleId) return;

    try {
      await createTrainingDay(
        currentMacrocycle.id,
        selectedMesocycleId,
        selectedMicrocycleId,
        dayData
      );
      toast.success('Training day added successfully');
      setShowTrainingDayModal(false);
      setSelectedMicrocycleId(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add training day');
    }
  };

  const handleAddExercise = async (exercise: Exercise, config: ExerciseConfig) => {
    if (!selectedContext) return;

    try {
      await createDayExercise(
        selectedContext.macrocycleId,
        selectedContext.mesocycleId,
        selectedContext.microcycleId,
        selectedContext.dayId,
        {
          exercise_id: exercise.id,
          sets: config.sets,
          reps_min: config.reps_min,
          reps_max: config.reps_max,
          rest_seconds: config.rest_seconds || 60,
          effort_type: config.effort_type,
          effort_value: config.effort_value,
          tempo: config.tempo,
          set_type: config.set_type,
          notes: config.notes,
          order_index: 0,
        }
      );
      toast.success('Exercise added successfully');
      setShowExerciseSelector(false);
      setSelectedContext(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add exercise');
    }
  };

  const openAddMicrocycle = (mesocycleId: string) => {
    setSelectedMesocycleId(mesocycleId);
    setShowMicrocycleModal(true);
  };

  const openAddDay = (mesocycleId: string, microcycleId: string) => {
    setSelectedMesocycleId(mesocycleId);
    setSelectedMicrocycleId(microcycleId);
    setShowTrainingDayModal(true);
  };

  const openAddExercise = (mesocycleId: string, microcycleId: string, trainingDayId: string) => {
    if (!currentMacrocycle) return;
    setSelectedContext({
      macrocycleId: currentMacrocycle.id,
      mesocycleId,
      microcycleId,
      dayId: trainingDayId,
    });
    setShowExerciseSelector(true);
  };

  // Kanban board handlers (legacy modal - can be removed in future)
  const closeKanbanBoard = () => {
    setShowKanbanBoard(false);
    setKanbanContext(null);
  };

  const handleKanbanAddDay = async () => {
    if (!currentMacrocycle || !kanbanContext) return;

    try {
      // Get existing days to calculate next day number
      const existingDays = trainingDays[kanbanContext.microcycleId] || [];
      const nextDayNumber = existingDays.length + 1;

      // Get microcycle to calculate date
      const microcycle = getKanbanMicrocycle();
      const startDate = microcycle ? new Date(microcycle.start_date) : new Date();
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + nextDayNumber - 1);

      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const dayName = dayNames[(nextDayNumber - 1) % 7];

      await createTrainingDay(
        currentMacrocycle.id,
        kanbanContext.mesocycleId,
        kanbanContext.microcycleId,
        {
          day_number: nextDayNumber,
          name: `Day ${nextDayNumber} - ${dayName}`,
          date: dayDate.toISOString().split('T')[0],
          focus: '',
          notes: '',
        }
      );

      toast.success('Training day added');
      loadMacrocycle(currentMacrocycle.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add training day');
    }
  };

  const handleKanbanEditDay = (_dayId: string) => {
    // Could implement day edit modal here
    toast.success('Day edit coming soon');
  };

  const handleKanbanDeleteDay = async (dayId: string) => {
    if (!currentMacrocycle || !kanbanContext) return;
    if (!confirm('Are you sure you want to delete this training day?')) return;

    try {
      await deleteTrainingDay(
        currentMacrocycle.id,
        kanbanContext.mesocycleId,
        kanbanContext.microcycleId,
        dayId
      );
      toast.success('Training day deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete training day');
    }
  };

  const handleKanbanCreateDayExercise = async (dayId: string, exerciseId: string, config: ExerciseConfigData) => {
    if (!currentMacrocycle || !kanbanContext) return;

    try {
      await createDayExercise(
        currentMacrocycle.id,
        kanbanContext.mesocycleId,
        kanbanContext.microcycleId,
        dayId,
        {
          exercise_id: exerciseId,
          phase: config.phase,
          sets: config.sets,
          reps_min: config.reps_min,
          reps_max: config.reps_max,
          rest_seconds: config.rest_seconds,
          effort_type: config.effort_type,
          effort_value: config.effort_value,
          tempo: config.tempo,
          set_type: config.set_type,
          notes: config.notes,
          order_index: 0,
        }
      );
      toast.success('Exercise added');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add exercise');
    }
  };

  const handleKanbanUpdateDayExercise = async (dayExerciseId: string, config: ExerciseConfigData) => {
    if (!currentMacrocycle || !kanbanContext) return;

    // Find which day this exercise belongs to
    const days = trainingDays[kanbanContext.microcycleId] || [];
    let targetDayId: string | null = null;
    for (const day of days) {
      if (day.exercises?.some(e => e.id === dayExerciseId)) {
        targetDayId = day.id;
        break;
      }
    }

    if (!targetDayId) {
      toast.error('Could not find exercise');
      return;
    }

    try {
      await updateDayExercise(
        currentMacrocycle.id,
        kanbanContext.mesocycleId,
        kanbanContext.microcycleId,
        targetDayId,
        dayExerciseId,
        {
          phase: config.phase,
          sets: config.sets,
          reps_min: config.reps_min,
          reps_max: config.reps_max,
          rest_seconds: config.rest_seconds,
          effort_type: config.effort_type,
          effort_value: config.effort_value,
          tempo: config.tempo,
          set_type: config.set_type,
          notes: config.notes,
        }
      );
      toast.success('Exercise updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update exercise');
    }
  };

  const handleKanbanDeleteDayExercise = async (dayExerciseId: string) => {
    if (!currentMacrocycle || !kanbanContext) return;

    // Find which day this exercise belongs to
    const days = trainingDays[kanbanContext.microcycleId] || [];
    let targetDayId: string | null = null;
    for (const day of days) {
      if (day.exercises?.some(e => e.id === dayExerciseId)) {
        targetDayId = day.id;
        break;
      }
    }

    if (!targetDayId) {
      toast.error('Could not find exercise');
      return;
    }

    try {
      await deleteDayExercise(
        currentMacrocycle.id,
        kanbanContext.mesocycleId,
        kanbanContext.microcycleId,
        targetDayId,
        dayExerciseId
      );
      toast.success('Exercise removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove exercise');
    }
  };

  const handleKanbanReorderExercises = async (dayId: string, exerciseIds: string[]) => {
    try {
      await reorderExercises(dayId, exerciseIds);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reorder exercises');
    }
  };

  const handleKanbanMoveExercise = async (exerciseId: string, fromDayId: string, toDayId: string, newIndex: number) => {
    try {
      await moveExerciseBetweenDays(exerciseId, fromDayId, toDayId, newIndex);
    } catch (error: any) {
      toast.error(error.message || 'Failed to move exercise');
    }
  };

  // Embedded Kanban handlers (receive mesocycleId/microcycleId directly)
  const handleEmbeddedKanbanEditDay = (_microcycleId: string, _dayId: string) => {
    toast.success('Day edit coming soon');
  };

  const handleEmbeddedKanbanDeleteDay = async (microcycleId: string, dayId: string) => {
    if (!currentMacrocycle) return;
    if (!confirm('Are you sure you want to delete this training day?')) return;

    // Find mesocycleId for this microcycle
    let foundMesocycleId: string | null = null;
    for (const [mesocycleId, mcs] of Object.entries(microcycles)) {
      if (mcs.some(mc => mc.id === microcycleId)) {
        foundMesocycleId = mesocycleId;
        break;
      }
    }
    if (!foundMesocycleId) return;

    try {
      await deleteTrainingDay(currentMacrocycle.id, foundMesocycleId, microcycleId, dayId);
      toast.success('Training day deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete training day');
    }
  };

  const handleEmbeddedKanbanCreateDayExercise = async (
    microcycleId: string,
    dayId: string,
    exerciseId: string,
    config: ExerciseConfigData
  ) => {
    if (!currentMacrocycle) return;

    // Find mesocycleId for this microcycle
    let foundMesocycleId: string | null = null;
    for (const [mesocycleId, mcs] of Object.entries(microcycles)) {
      if (mcs.some(mc => mc.id === microcycleId)) {
        foundMesocycleId = mesocycleId;
        break;
      }
    }
    if (!foundMesocycleId) return;

    try {
      await createDayExercise(currentMacrocycle.id, foundMesocycleId, microcycleId, dayId, {
        exercise_id: exerciseId,
        phase: config.phase,
        sets: config.sets,
        reps_min: config.reps_min,
        reps_max: config.reps_max,
        rest_seconds: config.rest_seconds,
        effort_type: config.effort_type,
        effort_value: config.effort_value,
        tempo: config.tempo,
        set_type: config.set_type,
        notes: config.notes,
        order_index: 0,
      });
      toast.success('Exercise added');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add exercise');
    }
  };

  const handleEmbeddedKanbanUpdateDayExercise = async (
    microcycleId: string,
    dayExerciseId: string,
    config: ExerciseConfigData
  ) => {
    if (!currentMacrocycle) return;

    // Find mesocycleId for this microcycle
    let foundMesocycleId: string | null = null;
    for (const [mesocycleId, mcs] of Object.entries(microcycles)) {
      if (mcs.some(mc => mc.id === microcycleId)) {
        foundMesocycleId = mesocycleId;
        break;
      }
    }
    if (!foundMesocycleId) return;

    // Find which day this exercise belongs to
    const days = trainingDays[microcycleId] || [];
    let targetDayId: string | null = null;
    for (const day of days) {
      if (day.exercises?.some(e => e.id === dayExerciseId)) {
        targetDayId = day.id;
        break;
      }
    }
    if (!targetDayId) {
      toast.error('Could not find exercise');
      return;
    }

    try {
      await updateDayExercise(currentMacrocycle.id, foundMesocycleId, microcycleId, targetDayId, dayExerciseId, {
        phase: config.phase,
        sets: config.sets,
        reps_min: config.reps_min,
        reps_max: config.reps_max,
        rest_seconds: config.rest_seconds,
        effort_type: config.effort_type,
        effort_value: config.effort_value,
        tempo: config.tempo,
        set_type: config.set_type,
        notes: config.notes,
      });
      toast.success('Exercise updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update exercise');
    }
  };

  const handleEmbeddedKanbanDeleteDayExercise = async (microcycleId: string, dayExerciseId: string) => {
    if (!currentMacrocycle) return;

    // Find mesocycleId for this microcycle
    let foundMesocycleId: string | null = null;
    for (const [mesocycleId, mcs] of Object.entries(microcycles)) {
      if (mcs.some(mc => mc.id === microcycleId)) {
        foundMesocycleId = mesocycleId;
        break;
      }
    }
    if (!foundMesocycleId) return;

    // Find which day this exercise belongs to
    const days = trainingDays[microcycleId] || [];
    let targetDayId: string | null = null;
    for (const day of days) {
      if (day.exercises?.some(e => e.id === dayExerciseId)) {
        targetDayId = day.id;
        break;
      }
    }
    if (!targetDayId) {
      toast.error('Could not find exercise');
      return;
    }

    try {
      await deleteDayExercise(currentMacrocycle.id, foundMesocycleId, microcycleId, targetDayId, dayExerciseId);
      toast.success('Exercise removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove exercise');
    }
  };

  const handleEmbeddedMicrocycleUpdate = async (microcycleId: string, name: string) => {
    if (!currentMacrocycle) return;

    // Find mesocycleId for this microcycle
    let foundMesocycleId: string | null = null;
    let foundMicrocycle: Microcycle | null = null;
    for (const [mesocycleId, mcs] of Object.entries(microcycles)) {
      const mc = mcs.find(mc => mc.id === microcycleId);
      if (mc) {
        foundMesocycleId = mesocycleId;
        foundMicrocycle = mc;
        break;
      }
    }
    if (!foundMesocycleId || !foundMicrocycle) return;

    try {
      await updateMicrocycle(currentMacrocycle.id, foundMesocycleId, microcycleId, {
        name,
        week_number: foundMicrocycle.week_number,
        intensity_level: foundMicrocycle.intensity_level,
        start_date: foundMicrocycle.start_date,
        end_date: foundMicrocycle.end_date,
        notes: foundMicrocycle.notes || undefined
      });
      toast.success('Microcycle name updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update microcycle name');
    }
  };

  const handleEmbeddedTrainingDayUpdateName = async (microcycleId: string, dayId: string, name: string) => {
    if (!currentMacrocycle) return;

    // Find mesocycleId for this microcycle
    let foundMesocycleId: string | null = null;
    for (const [mesocycleId, mcs] of Object.entries(microcycles)) {
      if (mcs.some(mc => mc.id === microcycleId)) {
        foundMesocycleId = mesocycleId;
        break;
      }
    }
    if (!foundMesocycleId) return;

    // Find current day data to preserve other fields
    const days = trainingDays[microcycleId] || [];
    const currentDay = days.find(d => d.id === dayId);
    if (!currentDay) return;

    try {
      await updateTrainingDay(
        currentMacrocycle.id,
        foundMesocycleId,
        microcycleId,
        dayId,
        {
          name,
          day_number: currentDay.day_number,
          date: undefined, // Don't update date when changing name to avoid validation errors
          focus: currentDay.focus || undefined,
          notes: currentDay.notes || undefined
        }
      );
      toast.success('Day name updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update day name');
    }
  };

  // Get the currently selected microcycle for Kanban board
  const getKanbanMicrocycle = (): Microcycle | null => {
    if (!kanbanContext) return null;
    const mesoMicrocycles = microcycles[kanbanContext.mesocycleId] || [];
    return mesoMicrocycles.find(m => m.id === kanbanContext.microcycleId) || null;
  };

  const getKanbanTrainingDays = () => {
    if (!kanbanContext) return [];
    return trainingDays[kanbanContext.microcycleId] || [];
  };

  // Get mesocycles for current macrocycle
  const currentMesocycles = currentMacrocycle
    ? mesocycles[currentMacrocycle.id] || []
    : [];

  if (isLoadingMacrocycle && !isNew) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/training/programs')}
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isNew ? 'New Training Program' : 'Edit Training Program'}
              </h1>
              <p className="mt-1 text-gray-600">
                {isNew
                  ? 'Create a new macrocycle'
                  : `Editing: ${currentMacrocycle?.name}`}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleOpenAIGenerator}
                disabled={!canUseAIGenerator}
              >
                <SparklesIcon className="h-5 w-5 mr-2" />
                {t('training:macrocycle.generateWithAi')}
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit(onSubmit)}
                isLoading={isSaving}
              >
                <CheckIcon className="h-5 w-5 mr-2" />
                {isNew ? 'Create Program' : 'Save Changes'}
              </Button>
            </div>
            {!canUseAIGenerator && aiRestrictionMessage ? (
              <p className="text-xs text-amber-700">{aiRestrictionMessage}</p>
            ) : null}
          </div>
        </div>

        {/* Compact Macrocycle Info Form */}
        <Card padding="none" className="overflow-hidden">
          {/* Header con gradiente */}
          <div className="bg-gradient-to-r from-emerald-200 via-emerald-100/60 to-emerald-50/30 backdrop-blur-sm border-b border-emerald-300/50 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <InformationCircleIcon className="h-5 w-5 text-emerald-600" />
              Información sobre el macrociclo
            </h2>
          </div>
          <form className="p-6 space-y-4">
            {/* Row 1: Name, Objective, Client */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4 border-b border-gray-100">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del programa</label>
                <input
                  {...register('name')}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Ej: Programa de hipertrofia 12 semanas"
                />
                {errors.name && <p className="mt-0.5 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Objetivo</label>
                <select
                  {...register('objective')}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="hypertrophy">Hipertrofia</option>
                  <option value="strength">Fuerza</option>
                  <option value="power">Potencia</option>
                  <option value="endurance">Resistencia</option>
                  <option value="fat_loss">Pérdida de grasa</option>
                  <option value="general_fitness">Fitness general</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
                <select
                  {...register('client_id')}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Plantilla (sin cliente)</option>
                  {nutritionClients.map((client) => (
                    <option key={client.id} value={String(client.id)}>
                      {`${client.name || ''} ${client.lastname || ''}`.trim() || client.email || `Cliente ${client.id}`}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Si seleccionas un cliente, el programa quedará asignado. Si no, se guarda como plantilla reusable.
                </p>
              </div>
            </div>

            {/* Row 2: Description */}
            <div className="pb-4 border-b border-gray-100">
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
              <textarea
                {...register('description')}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                rows={2}
                placeholder="Describe los objetivos y estructura del programa..."
              />
            </div>

            {/* Row 3: Dates and Status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de inicio</label>
                <input
                  type="date"
                  {...register('start_date')}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {errors.start_date && <p className="mt-0.5 text-xs text-red-600">{errors.start_date.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de finalización</label>
                <input
                  type="date"
                  {...register('end_date')}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {errors.end_date && <p className="mt-0.5 text-xs text-red-600">{errors.end_date.message}</p>}
              </div>

              {!isNew && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                  <select
                    {...register('status')}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="draft">Borrador</option>
                    <option value="active">Activo</option>
                    <option value="completed">Completado</option>
                    <option value="archived">Archivado</option>
                  </select>
                </div>
              )}
            </div>
          </form>
        </Card>

        {/* Mesocycles Section */}
        {!isNew && currentMacrocycle && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Mesocycles</h2>
                <p className="text-sm text-gray-600">Training blocks within this macrocycle (typically 3-6 weeks each)</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowMesocycleModal(true)}
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Mesocycle
              </Button>
            </div>

            {currentMesocycles.length === 0 ? (
              <Card>
                <div className="text-center py-12 text-gray-500">
                  <p className="mb-4">No mesocycles yet. Add training blocks to your program.</p>
                  <Button
                    variant="secondary"
                    onClick={() => setShowMesocycleModal(true)}
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add First Mesocycle
                  </Button>
                </div>
              </Card>
            ) : (
              <DndWrapper
                trainingDays={trainingDays}
                exercises={exercises}
                onReorderExercises={reorderExercises}
                onMoveExercise={moveExerciseBetweenDays}
              >
                <div className="space-y-4">
                  {currentMesocycles
                    .sort((a, b) => a.block_number - b.block_number)
                    .map((mesocycle) => (
                      <MesocycleCard
                        key={mesocycle.id}
                        macrocycleId={currentMacrocycle.id}
                        mesocycle={mesocycle}
                        microcycles={microcycles[mesocycle.id] || []}
                        trainingDays={trainingDays}
                        onAddMicrocycle={() => openAddMicrocycle(mesocycle.id)}
                        onAddDay={(microcycleId) => openAddDay(mesocycle.id, microcycleId)}
                        onAddExercise={(microcycleId, dayId) => openAddExercise(mesocycle.id, microcycleId, dayId)}
                        // Embedded Kanban handlers
                        onKanbanUpdateMicrocycle={handleEmbeddedMicrocycleUpdate}
                        onKanbanUpdateDayName={handleEmbeddedTrainingDayUpdateName}
                        onKanbanEditDay={handleEmbeddedKanbanEditDay}
                        onKanbanDeleteDay={handleEmbeddedKanbanDeleteDay}
                        onKanbanCreateDayExercise={handleEmbeddedKanbanCreateDayExercise}
                        onKanbanUpdateDayExercise={handleEmbeddedKanbanUpdateDayExercise}
                        onKanbanDeleteDayExercise={handleEmbeddedKanbanDeleteDayExercise}
                        onKanbanReorderExercises={handleKanbanReorderExercises}
                        onKanbanMoveExercise={handleKanbanMoveExercise}
                      />
                    ))}
                </div>
              </DndWrapper>
            )}
          </div>
        )}

        {/* Exercise Selector Modal */}
        {selectedContext && (
          <ExerciseSelector
            isOpen={showExerciseSelector}
            onClose={() => {
              setShowExerciseSelector(false);
              setSelectedContext(null);
            }}
            onSelect={handleAddExercise}
            trainingDayId={selectedContext.dayId}
          />
        )}

        {/* Mesocycle Modal */}
        <MesocycleModal
          isOpen={showMesocycleModal}
          onClose={() => setShowMesocycleModal(false)}
          onSubmit={handleAddMesocycle}
          nextBlockNumber={currentMesocycles.length + 1}
        />

        {/* Microcycle Modal */}
        <MicrocycleModal
          isOpen={showMicrocycleModal}
          onClose={() => {
            setShowMicrocycleModal(false);
            setSelectedMesocycleId(null);
          }}
          onSubmit={handleAddMicrocycle}
          nextWeekNumber={(selectedMesocycleId && microcycles[selectedMesocycleId]?.length || 0) + 1}
        />

        {/* Training Day Modal */}
        <TrainingDayModal
          isOpen={showTrainingDayModal}
          onClose={() => {
            setShowTrainingDayModal(false);
            setSelectedMicrocycleId(null);
          }}
          onSubmit={handleAddTrainingDay}
        />

        {/* Kanban Board Modal */}
        {showKanbanBoard && kanbanContext && getKanbanMicrocycle() && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-[95vw] h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-xl font-semibold text-gray-900">
                  Edit Microcycle - {getKanbanMicrocycle()?.name}
                </h2>
                <Button variant="ghost" onClick={closeKanbanBoard}>
                  <XMarkIcon className="h-6 w-6" />
                </Button>
              </div>

              {/* Kanban Board */}
              <div className="flex-1 overflow-hidden">
                <MicrocycleKanbanBoard
                  microcycle={getKanbanMicrocycle()!}
                  trainingDays={getKanbanTrainingDays()}
                  exercises={exercises}
                  onAddDay={handleKanbanAddDay}
                  onEditDay={handleKanbanEditDay}
                  onDeleteDay={handleKanbanDeleteDay}
                  onCreateDayExercise={handleKanbanCreateDayExercise}
                  onUpdateDayExercise={handleKanbanUpdateDayExercise}
                  onDeleteDayExercise={handleKanbanDeleteDayExercise}
                  onReorderExercises={handleKanbanReorderExercises}
                  onMoveExercise={handleKanbanMoveExercise}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
