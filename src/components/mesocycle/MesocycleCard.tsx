import { useState, useEffect, Fragment } from 'react';
import { motion } from 'framer-motion';
import { Dialog, Transition } from '@headlessui/react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import {
  ChevronDownIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  ChartBarIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import type { Mesocycle, Microcycle, TrainingDay } from '../../types';
import { MicrocycleCard } from './MicrocycleCard';
import { MicrocycleCharts } from '../charts/MicrocycleCharts';
import type { ExerciseConfigData } from './ExerciseConfigModal';
import { useMesocycleStore } from '../../store/mesocycleStore';
import toast from 'react-hot-toast';

interface MesocycleCardProps {
  macrocycleId: string;
  mesocycle: Mesocycle;
  microcycles: Microcycle[];
  trainingDays: Record<string, TrainingDay[]>;
  onEdit?: () => void;
  onAddMicrocycle?: () => void;
  onAddDay?: (microcycleId: string) => void;
  onAddExercise?: (microcycleId: string, trainingDayId: string) => void;
  onEditExercise?: (microcycleId: string, trainingDayId: string, exerciseId: string) => void;
  onDeleteExercise?: (microcycleId: string, trainingDayId: string, exerciseId: string) => void;
  // Kanban props - functions receive microcycleId for context
  onKanbanEditDay?: (microcycleId: string, dayId: string) => void;
  onKanbanDeleteDay?: (microcycleId: string, dayId: string) => void;
  onKanbanCreateDayExercise?: (microcycleId: string, dayId: string, exerciseId: string, config: ExerciseConfigData) => Promise<void>;
  onKanbanUpdateDayExercise?: (microcycleId: string, dayExerciseId: string, config: ExerciseConfigData) => Promise<void>;
  onKanbanDeleteDayExercise?: (microcycleId: string, dayExerciseId: string) => Promise<void>;
  onKanbanReorderExercises?: (dayId: string, exerciseIds: string[]) => Promise<void>;
  onKanbanMoveExercise?: (exerciseId: string, fromDayId: string, toDayId: string, newIndex: number) => Promise<void>;
  onKanbanUpdateMicrocycle?: (microcycleId: string, name: string) => Promise<void>;
  onKanbanUpdateDayName?: (microcycleId: string, dayId: string, name: string) => Promise<void>;
}

export function MesocycleCard({
  macrocycleId,
  mesocycle,
  microcycles,
  trainingDays,
  onEdit,
  onAddMicrocycle,
  onAddDay,
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
  // Kanban props
  onKanbanEditDay,
  onKanbanDeleteDay,
  onKanbanCreateDayExercise,
  onKanbanUpdateDayExercise,
  onKanbanDeleteDayExercise,
  onKanbanReorderExercises,
  onKanbanMoveExercise,
  onKanbanUpdateMicrocycle,
  onKanbanUpdateDayName,
}: MesocycleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [showCharts, setShowCharts] = useState(false);
  const { deleteMesocycle, exercises } = useMesocycleStore();

  // Sort microcycles by week number
  const sortedMicrocycles = [...microcycles].sort((a, b) => a.week_number - b.week_number);

  // Initialize active tab to first microcycle
  useEffect(() => {
    if (sortedMicrocycles.length > 0 && !activeTabId) {
      setActiveTabId(sortedMicrocycles[0].id);
    }
    // Update active tab if current one is deleted
    if (activeTabId && !sortedMicrocycles.find(m => m.id === activeTabId)) {
      setActiveTabId(sortedMicrocycles[0]?.id || null);
    }
  }, [sortedMicrocycles, activeTabId]);

  const activeMicrocycle = sortedMicrocycles.find(m => m.id === activeTabId);

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${mesocycle.name}"? This will also delete all microcycles and training days within it.`)) {
      return;
    }

    try {
      await deleteMesocycle(macrocycleId, mesocycle.id);
      toast.success('Mesocycle deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete mesocycle');
    }
  };

  const getFocusColor = (focus: string | null) => {
    switch (focus?.toLowerCase()) {
      case 'hypertrophy':
        return 'bg-emerald-100 text-emerald-800';
      case 'strength':
        return 'bg-red-100 text-red-800';
      case 'power':
        return 'bg-orange-100 text-orange-800';
      case 'peaking':
        return 'bg-yellow-100 text-yellow-800';
      case 'deload':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getIntensityColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'high':
        return 'bg-red-500';
      case 'deload':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  // Count total exercises for a microcycle
  const getExerciseCount = (microcycleId: string): number => {
    const days = trainingDays[microcycleId] || [];
    return days.reduce((total, day) => total + (day.exercises?.length || 0), 0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative"
    >
      {/* Animated border glow effect */}
      <motion.div
        className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 opacity-0"
        initial={{ opacity: 0 }}
        animate={{
          opacity: [0, 0.6, 0],
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
        }}
        transition={{
          duration: 3,
          ease: 'easeInOut',
          times: [0, 0.5, 1],
          delay: 0.5
        }}
        style={{ backgroundSize: '200% 200%' }}
      />
      <Card padding="none" className="relative rounded-2xl border-l-4 border-emerald-500 shadow-lg shadow-emerald-500/10 hover:shadow-xl hover:shadow-emerald-500/15 transition-all duration-300 overflow-hidden">
        {/* Header con degradado */}
        <div className="p-4 bg-gradient-to-r from-emerald-200 via-emerald-100/60 to-emerald-50/30 backdrop-blur-sm border-b border-emerald-300/50 hover:from-emerald-300/90 hover:via-emerald-200/60 hover:to-emerald-100/40 transition-all duration-300 cursor-pointer rounded-tr-2xl">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <ChevronDownIcon className="h-5 w-5" />
                  </motion.div>
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Block {mesocycle.block_number}: {mesocycle.name}
                    </h3>
                    {mesocycle.focus && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getFocusColor(mesocycle.focus)}`}>
                        {mesocycle.focus}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {format(new Date(mesocycle.start_date), 'MMM d')} -{' '}
                    {format(new Date(mesocycle.end_date), 'MMM d, yyyy')} •{' '}
                    {microcycles.length} {microcycles.length === 1 ? 'week' : 'weeks'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <PencilIcon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDelete}>
                <TrashIcon className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          </div>

          {mesocycle.description && (
            <p className="mt-2 text-sm text-gray-600 ml-12">{mesocycle.description}</p>
          )}
        </div>

      </Card>

      {/* Fullscreen Dialog */}
      <Transition show={isExpanded} as={Fragment}>
        <Dialog onClose={() => setIsExpanded(false)} className="relative z-50">
          {/* Backdrop */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" />
          </Transition.Child>

          {/* Panel fullscreen */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-y-0"
            enterTo="opacity-100 scale-y-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-y-100"
            leaveTo="opacity-0 scale-y-0"
          >
            <Dialog.Panel className="fixed inset-0 flex flex-col bg-white overflow-hidden origin-top">
              {/* Header fijo */}
              <div className="flex-shrink-0 p-4 border-b border-emerald-300/50 bg-gradient-to-r from-emerald-200 via-emerald-100/60 to-emerald-50/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Dialog.Title className="text-xl font-bold text-gray-900">
                          Bloque {mesocycle.block_number}: {mesocycle.name}
                        </Dialog.Title>
                        {mesocycle.focus && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getFocusColor(mesocycle.focus)}`}>
                            {mesocycle.focus}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {format(new Date(mesocycle.start_date), 'MMM d')} -{' '}
                        {format(new Date(mesocycle.end_date), 'MMM d, yyyy')} •{' '}
                        {microcycles.length} {microcycles.length === 1 ? 'semana' : 'semanas'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={onEdit}>
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
                      <XMarkIcon className="h-6 w-6" />
                    </Button>
                  </div>
                </div>
                {mesocycle.description && (
                  <p className="mt-2 text-sm text-gray-600">{mesocycle.description}</p>
                )}
              </div>

              {/* Contenido scrolleable */}
              <div className="flex-1 overflow-y-auto">
                {microcycles.length === 0 ? (
                  <div className="p-4 text-center py-8 text-gray-500">
                    <p className="mb-4">No hay microciclos aún</p>
                    <Button variant="secondary" size="sm" onClick={onAddMicrocycle}>
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Agregar Microciclo
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Tab Bar - Modern Pill Style */}
                    <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 sticky top-0 z-10">
                      <div className="flex items-center gap-2 overflow-x-auto" role="tablist">
                        {sortedMicrocycles.map((microcycle, index) => {
                          const isActive = microcycle.id === activeTabId;
                          const exerciseCount = getExerciseCount(microcycle.id);
                          const dayCount = (trainingDays[microcycle.id] || []).length;

                          return (
                            <button
                              key={microcycle.id}
                              role="tab"
                              aria-selected={isActive}
                              onClick={() => setActiveTabId(microcycle.id)}
                              className={`
                                relative flex flex-col items-center px-4 py-2 min-w-[90px] text-sm font-medium
                                rounded-full transition-all duration-200 whitespace-nowrap
                                ${isActive
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25'
                                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }
                              `}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full ${isActive ? 'bg-white/80' : getIntensityColor(microcycle.intensity_level)}`}
                                  title={microcycle.intensity_level}
                                />
                                <span>Micro {index + 1}</span>
                              </div>
                              <span className={`text-xs mt-0.5 ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                                {dayCount}d • {exerciseCount} ex
                              </span>
                            </button>
                          );
                        })}

                        {/* Add Microcycle Button */}
                        <button
                          onClick={onAddMicrocycle}
                          className="flex items-center justify-center w-9 h-9 rounded-full text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all duration-200"
                          title="Agregar Microciclo"
                        >
                          <PlusIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Active Tab Content */}
                    {activeMicrocycle && (
                      <>
                        {/* Charts Toggle and Charts */}
                        <div className="px-4 pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <button
                              onClick={() => setShowCharts(!showCharts)}
                              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                            >
                              <ChartBarIcon className="h-4 w-4" />
                              {showCharts ? 'Ocultar métricas' : 'Mostrar métricas'}
                            </button>
                          </div>
                          {showCharts && (
                            <MicrocycleCharts
                              weekNumber={activeMicrocycle.week_number}
                              trainingDays={trainingDays[activeMicrocycle.id] || []}
                              exercises={exercises}
                            />
                          )}
                        </div>

                        <MicrocycleCard
                          key={activeMicrocycle.id}
                          microcycle={activeMicrocycle}
                          trainingDays={trainingDays[activeMicrocycle.id] || []}
                          exercises={exercises}
                          onAddDay={() => onAddDay?.(activeMicrocycle.id)}
                          onAddExercise={(dayId) => onAddExercise?.(activeMicrocycle.id, dayId)}
                          onEditExercise={(dayId, exerciseId) => onEditExercise?.(activeMicrocycle.id, dayId, exerciseId)}
                          onDeleteExercise={(dayId, exerciseId) => onDeleteExercise?.(activeMicrocycle.id, dayId, exerciseId)}
                          // Kanban props - bind microcycleId to each handler
                          onEditDay={(dayId) => onKanbanEditDay?.(activeMicrocycle.id, dayId)}
                          onDeleteDay={(dayId) => onKanbanDeleteDay?.(activeMicrocycle.id, dayId)}
                          onCreateDayExercise={(dayId, exerciseId, config) =>
                            onKanbanCreateDayExercise?.(activeMicrocycle.id, dayId, exerciseId, config) ?? Promise.resolve()
                          }
                          onUpdateDayExercise={(dayExerciseId, config) =>
                            onKanbanUpdateDayExercise?.(activeMicrocycle.id, dayExerciseId, config) ?? Promise.resolve()
                          }
                          onDeleteDayExercise={(dayExerciseId) =>
                            onKanbanDeleteDayExercise?.(activeMicrocycle.id, dayExerciseId) ?? Promise.resolve()
                          }
                          onReorderExercises={onKanbanReorderExercises}
                          onMoveExercise={onKanbanMoveExercise}
                          onUpdateMicrocycle={(name) => onKanbanUpdateMicrocycle?.(activeMicrocycle.id, name) ?? Promise.resolve()}
                          onUpdateDayName={(dayId, name) => onKanbanUpdateDayName?.(activeMicrocycle.id, dayId, name) ?? Promise.resolve()}
                          hideHeader
                          viewMode={viewMode}
                          onViewModeChange={setViewMode}
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </Dialog>
      </Transition>
    </motion.div>
  );
}
