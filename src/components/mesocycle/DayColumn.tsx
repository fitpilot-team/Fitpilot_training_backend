import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon, PencilIcon, TrashIcon, SparklesIcon, MoonIcon } from '@heroicons/react/24/outline';
import { KanbanExerciseCard } from './KanbanExerciseCard';
import type { TrainingDay, Exercise, DayExercise } from '../../types';

interface DayColumnProps {
  trainingDay: TrainingDay;
  exercises: Exercise[];
  onExerciseClick?: (dayExercise: DayExercise) => void;
  onEditDay?: () => void;
  onDeleteDay?: () => void;
  onUpdateDayName?: (name: string) => void;
  isBeingDraggedOver?: boolean;
  isWarmupDraggedOver?: boolean;
  isMainDraggedOver?: boolean;
  isCooldownDraggedOver?: boolean;
}

// Modern focus colors with gradients
const getFocusStyle = (focus: string | null, isRestDay: boolean = false) => {
  // Estilo especial para días de descanso
  if (isRestDay) return {
    dot: 'bg-gradient-to-r from-emerald-400 to-teal-500',
    header: 'from-emerald-50 to-white',
    accent: 'border-emerald-200'
  };

  if (!focus) return {
    dot: 'bg-gradient-to-r from-gray-400 to-gray-500',
    header: 'from-gray-50 to-white',
    accent: 'border-gray-200'
  };
  const focusLower = focus.toLowerCase();
  if (focusLower.includes('chest') || focusLower.includes('push')) return {
    dot: 'bg-gradient-to-r from-rose-500 to-red-500',
    header: 'from-rose-50 to-white',
    accent: 'border-rose-200'
  };
  if (focusLower.includes('back') || focusLower.includes('pull')) return {
    dot: 'bg-gradient-to-r from-blue-500 to-indigo-500',
    header: 'from-blue-50 to-white',
    accent: 'border-blue-200'
  };
  if (focusLower.includes('leg') || focusLower.includes('lower')) return {
    dot: 'bg-gradient-to-r from-green-500 to-emerald-500',
    header: 'from-green-50 to-white',
    accent: 'border-green-200'
  };
  if (focusLower.includes('shoulder')) return {
    dot: 'bg-gradient-to-r from-amber-500 to-yellow-500',
    header: 'from-amber-50 to-white',
    accent: 'border-amber-200'
  };
  if (focusLower.includes('arm')) return {
    dot: 'bg-gradient-to-r from-purple-500 to-violet-500',
    header: 'from-purple-50 to-white',
    accent: 'border-purple-200'
  };
  if (focusLower.includes('core')) return {
    dot: 'bg-gradient-to-r from-orange-500 to-amber-500',
    header: 'from-orange-50 to-white',
    accent: 'border-orange-200'
  };
  return {
    dot: 'bg-gradient-to-r from-gray-400 to-gray-500',
    header: 'from-gray-50 to-white',
    accent: 'border-gray-200'
  };
};

export function DayColumn({
  trainingDay,
  exercises,
  onExerciseClick,
  onEditDay,
  onDeleteDay,
  onUpdateDayName,
  isBeingDraggedOver = false,
  isWarmupDraggedOver = false,
  isMainDraggedOver = false,
  isCooldownDraggedOver = false,
}: DayColumnProps) {
  const { t } = useTranslation('training');
  const dayExercises = trainingDay.exercises || [];

  // Split exercises into warm-up, main, and cooldown sections
  const warmupExercises = dayExercises.filter(e => e.phase === 'warmup').sort((a, b) => a.order_index - b.order_index);
  const mainExercises = dayExercises.filter(e => e.phase === 'main').sort((a, b) => a.order_index - b.order_index);
  const cooldownExercises = dayExercises.filter(e => e.phase === 'cooldown').sort((a, b) => a.order_index - b.order_index);

  const warmupExerciseIds = warmupExercises.map((e) => e.id);
  const mainExerciseIds = mainExercises.map((e) => e.id);
  const cooldownExerciseIds = cooldownExercises.map((e) => e.id);

  // Estado para edición inline del nombre del día
  const [isEditingName, setIsEditingName] = useState(false);
  const [dayName, setDayName] = useState(trainingDay.name || '');

  // Sincronizar con props cuando cambie externamente
  useEffect(() => {
    setDayName(trainingDay.name || '');
  }, [trainingDay.name]);

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (dayName !== trainingDay.name) {
      onUpdateDayName?.(dayName);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setDayName(trainingDay.name || '');
      setIsEditingName(false);
    }
  };

  const { isOver } = useDroppable({
    id: `day-${trainingDay.id}`,
    data: {
      type: 'day-column',
      trainingDay,
    },
  });

  // Hooks para las zonas de drop por sección (movidos al nivel superior para cumplir reglas de hooks)
  const warmupDroppable = useDroppable({ id: `warmup-${trainingDay.id}` });
  const mainDroppable = useDroppable({ id: `main-${trainingDay.id}` });
  const cooldownDroppable = useDroppable({ id: `cooldown-${trainingDay.id}` });

  const getExerciseData = (dayExercise: DayExercise): Exercise | undefined => {
    return dayExercise.exercise || exercises.find((e) => e.id === dayExercise.exercise_id);
  };

  const focusStyle = getFocusStyle(trainingDay.focus, trainingDay.rest_day);

  // Renderizar versión simplificada para días de descanso
  if (trainingDay.rest_day) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`
          flex flex-col w-44 min-w-[176px] lg:w-48 lg:min-w-[192px]
          bg-gradient-to-br from-emerald-50/80 to-white backdrop-blur-sm rounded-2xl
          border border-emerald-200 transition-all duration-300 overflow-hidden
          shadow-sm hover:shadow-md
        `}
      >
        {/* Header para día de descanso */}
        <div className={`p-3 bg-gradient-to-b from-emerald-50 to-white border-b border-emerald-100`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 shadow-sm"
                whileHover={{ scale: 1.2 }}
                transition={{ type: "spring", stiffness: 400 }}
              />
              <div>
                <h3 className="font-bold text-gray-800 text-sm tracking-tight">
                  {t('trainingDay.dayName', { number: trainingDay.day_number })}
                </h3>
                <p className="text-[11px] text-emerald-600 font-medium">
                  {trainingDay.name || t('trainingDay.restDay')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <motion.button
                onClick={onEditDay}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg
                           hover:bg-primary-50 transition-colors duration-200"
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </motion.button>
              <motion.button
                onClick={onDeleteDay}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg
                           hover:bg-red-50 transition-colors duration-200"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </motion.button>
            </div>
          </div>

          {/* Badge de día de descanso */}
          <div className="flex items-center justify-center mt-2">
            <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider
                           bg-emerald-100 px-3 py-1 rounded-full flex items-center gap-1">
              <MoonIcon className="h-3 w-3" />
              {t('trainingDay.restDay')}
            </span>
          </div>
        </div>

        {/* Contenido para día de descanso */}
        <div className="flex-1 p-4 min-h-[200px] flex flex-col items-center justify-center">
          <motion.div
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.7, 1, 0.7]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100
                       flex items-center justify-center mb-4 shadow-inner"
          >
            <MoonIcon className="h-8 w-8 text-emerald-500" />
          </motion.div>
          <p className="text-emerald-700 font-semibold text-sm text-center">
            {t('trainingDay.restDay')}
          </p>
          <p className="text-emerald-500 text-xs text-center mt-1 max-w-[140px]">
            {t('trainingDay.restDayDescription')}
          </p>
          {trainingDay.notes && (
            <p className="text-gray-500 text-[10px] text-center mt-3 italic max-w-[140px] line-clamp-2">
              {trainingDay.notes}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        flex flex-col w-44 min-w-[176px] lg:w-48 lg:min-w-[192px]
        bg-white/80 backdrop-blur-sm rounded-2xl
        border transition-all duration-300 overflow-hidden
        shadow-sm hover:shadow-md
        ${(isOver || isBeingDraggedOver)
          ? 'border-primary-400 ring-2 ring-primary-200 shadow-lg shadow-primary-100'
          : `border-gray-100 ${focusStyle.accent}`
        }
      `}
    >
      {/* Column Header - Glass effect */}
      <div className={`p-3 bg-gradient-to-b ${focusStyle.header} border-b border-gray-100`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              className={`w-3 h-3 rounded-full ${focusStyle.dot} shadow-sm`}
              whileHover={{ scale: 1.2 }}
              transition={{ type: "spring", stiffness: 400 }}
            />
            <div>
              <h3 className="font-bold text-gray-800 text-sm tracking-tight">
                {t('trainingDay.dayName', { number: trainingDay.day_number })}
              </h3>
              {isEditingName ? (
                <input
                  type="text"
                  value={dayName}
                  onChange={(e) => setDayName(e.target.value)}
                  onBlur={handleNameBlur}
                  onKeyDown={handleNameKeyDown}
                  autoFocus
                  placeholder={t('trainingDay.dayNamePlaceholder')}
                  className="text-[11px] text-gray-600 bg-transparent border-b border-primary-300
                             outline-none w-full max-w-[120px] font-medium py-0"
                />
              ) : (
                <p
                  onClick={() => setIsEditingName(true)}
                  className="text-[11px] text-gray-500 truncate max-w-[120px] font-medium
                             cursor-text hover:text-gray-700 hover:bg-gray-100/50 rounded px-1 -mx-1
                             transition-colors duration-150"
                  title={t('trainingDay.clickToEdit')}
                >
                  {trainingDay.name || t('trainingDay.dayNamePlaceholder')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <motion.button
              onClick={() => setIsEditingName(true)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg
                         hover:bg-primary-50 transition-colors duration-200"
              title={t('trainingDay.clickToEdit')}
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </motion.button>
            <motion.button
              onClick={onDeleteDay}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg
                         hover:bg-red-50 transition-colors duration-200"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </motion.button>
          </div>
        </div>

        {/* Exercise count badge */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            {t('trainingDay.exerciseCount', { count: dayExercises.length })}
          </span>
          {trainingDay.focus && (
            <span className="text-[9px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-600 font-medium truncate max-w-[80px]">
              {trainingDay.focus}
            </span>
          )}
        </div>
      </div>

      {/* Exercises List */}
      <div
        className="flex-1 p-2 min-h-[200px] overflow-y-auto
                   scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
      >
        {/* Warm-up Section */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {t('trainingDay.warmup')}
            </span>
            <div className="h-px flex-1 bg-emerald-100/50"></div>
          </div>

          <SortableContext id={`warmup-${trainingDay.id}`} items={warmupExerciseIds} strategy={verticalListSortingStrategy}>
            <div
              ref={warmupDroppable.setNodeRef}
              className={`min-h-[80px] rounded-xl transition-colors duration-200 ${isWarmupDraggedOver || warmupDroppable.isOver
                  ? 'bg-emerald-50/50 ring-2 ring-emerald-300'
                  : warmupExercises.length === 0 ? 'bg-emerald-50/30 border border-dashed border-emerald-200/50' : ''
                }`}
            >
              <AnimatePresence mode="popLayout">
                <div className="space-y-2">
                  {warmupExercises.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`
                        flex flex-col items-center justify-center h-24
                        border-2 border-dashed rounded-xl
                        transition-all duration-300
                        ${(isWarmupDraggedOver || warmupDroppable.isOver)
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-transparent text-emerald-300 hover:text-emerald-400'
                        }
                      `}
                    >
                      <motion.div
                        animate={(isWarmupDraggedOver || warmupDroppable.isOver) ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                        transition={{ duration: 0.5, repeat: (isWarmupDraggedOver || warmupDroppable.isOver) ? Infinity : 0 }}
                      >
                        {(isWarmupDraggedOver || warmupDroppable.isOver) ? (
                          <SparklesIcon className="h-6 w-6 mb-1 text-emerald-500" />
                        ) : (
                          <PlusIcon className="h-6 w-6 mb-1" />
                        )}
                      </motion.div>
                      <span className="text-[10px] font-medium">
                        {(isWarmupDraggedOver || warmupDroppable.isOver) ? t('trainingDay.dropHere') : t('trainingDay.dragToWarmup')}
                      </span>
                    </motion.div>
                  ) : (
                    warmupExercises.map((dayExercise, index) => (
                      <motion.div
                        key={dayExercise.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <KanbanExerciseCard
                          dayExercise={dayExercise}
                          exercise={getExerciseData(dayExercise)}
                          onClick={() => onExerciseClick?.(dayExercise)}
                          orderIndex={index + 1}
                        />
                      </motion.div>
                    ))
                  )}
                </div>
              </AnimatePresence>

              {/* Drop Zone at Bottom (when there are exercises) */}
              <AnimatePresence>
                {warmupExercises.length > 0 && (isWarmupDraggedOver || warmupDroppable.isOver) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 p-3 border-2 border-dashed border-emerald-400 rounded-xl
                              bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-center"
                  >
                    <span className="text-xs text-emerald-600 font-semibold">{t('trainingDay.dropToAdd')}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </SortableContext>
        </div>

        {/* Main Workout Section */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {t('trainingDay.workout')}
            </span>
            <div className="h-px flex-1 bg-blue-100/50"></div>
          </div>

          <SortableContext id={`main-${trainingDay.id}`} items={mainExerciseIds} strategy={verticalListSortingStrategy}>
            <div
              ref={mainDroppable.setNodeRef}
              className={`min-h-[100px] rounded-xl transition-colors duration-200 ${isMainDraggedOver || mainDroppable.isOver
                  ? 'bg-blue-50/50 ring-2 ring-blue-300'
                  : mainExercises.length === 0 ? 'bg-blue-50/30 border border-dashed border-blue-200/50' : ''
                }`}
            >
              <AnimatePresence mode="popLayout">
                <div className="space-y-2">
                  {mainExercises.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`
                        flex flex-col items-center justify-center h-32
                        border-2 border-dashed rounded-xl
                        transition-all duration-300
                        ${(isMainDraggedOver || mainDroppable.isOver)
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-transparent text-blue-300 hover:text-blue-400'
                        }
                      `}
                    >
                      <motion.div
                        animate={(isMainDraggedOver || mainDroppable.isOver) ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                        transition={{ duration: 0.5, repeat: (isMainDraggedOver || mainDroppable.isOver) ? Infinity : 0 }}
                      >
                        {(isMainDraggedOver || mainDroppable.isOver) ? (
                          <SparklesIcon className="h-8 w-8 mb-1 text-blue-500" />
                        ) : (
                          <PlusIcon className="h-8 w-8 mb-1" />
                        )}
                      </motion.div>
                      <span className="text-xs font-medium">
                        {(isMainDraggedOver || mainDroppable.isOver) ? t('trainingDay.dropHere') : t('trainingDay.dragExercises')}
                      </span>
                    </motion.div>
                  ) : (
                    mainExercises.map((dayExercise, index) => (
                      <motion.div
                        key={dayExercise.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <KanbanExerciseCard
                          dayExercise={dayExercise}
                          exercise={getExerciseData(dayExercise)}
                          onClick={() => onExerciseClick?.(dayExercise)}
                          orderIndex={index + 1}
                        />
                      </motion.div>
                    ))
                  )}
                </div>
              </AnimatePresence>

              {/* Drop Zone at Bottom (when there are exercises) */}
              <AnimatePresence>
                {mainExercises.length > 0 && (isMainDraggedOver || mainDroppable.isOver) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 p-3 border-2 border-dashed border-blue-400 rounded-xl
                              bg-gradient-to-br from-blue-50 to-blue-100/50 text-center"
                  >
                    <span className="text-xs text-blue-600 font-semibold">{t('trainingDay.dropToAdd')}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </SortableContext>
        </div>

        {/* Cooldown Section */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {t('trainingDay.cooldown')}
            </span>
            <div className="h-px flex-1 bg-amber-100/50"></div>
          </div>

          <SortableContext id={`cooldown-${trainingDay.id}`} items={cooldownExerciseIds} strategy={verticalListSortingStrategy}>
            <div
              ref={cooldownDroppable.setNodeRef}
              className={`min-h-[80px] rounded-xl transition-colors duration-200 ${isCooldownDraggedOver || cooldownDroppable.isOver
                  ? 'bg-amber-50/50 ring-2 ring-amber-300'
                  : cooldownExercises.length === 0 ? 'bg-amber-50/30 border border-dashed border-amber-200/50' : ''
                }`}
            >
              <AnimatePresence mode="popLayout">
                <div className="space-y-2">
                  {cooldownExercises.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`
                        flex flex-col items-center justify-center h-24
                        border-2 border-dashed rounded-xl
                        transition-all duration-300
                        ${(isCooldownDraggedOver || cooldownDroppable.isOver)
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-transparent text-amber-300 hover:text-amber-400'
                        }
                      `}
                    >
                      <motion.div
                        animate={(isCooldownDraggedOver || cooldownDroppable.isOver) ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                        transition={{ duration: 0.5, repeat: (isCooldownDraggedOver || cooldownDroppable.isOver) ? Infinity : 0 }}
                      >
                        {(isCooldownDraggedOver || cooldownDroppable.isOver) ? (
                          <SparklesIcon className="h-6 w-6 mb-1 text-amber-500" />
                        ) : (
                          <PlusIcon className="h-6 w-6 mb-1" />
                        )}
                      </motion.div>
                      <span className="text-[10px] font-medium">
                        {(isCooldownDraggedOver || cooldownDroppable.isOver) ? t('trainingDay.dropHere') : t('trainingDay.dragToCooldown')}
                      </span>
                    </motion.div>
                  ) : (
                    cooldownExercises.map((dayExercise, index) => (
                      <motion.div
                        key={dayExercise.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <KanbanExerciseCard
                          dayExercise={dayExercise}
                          exercise={getExerciseData(dayExercise)}
                          onClick={() => onExerciseClick?.(dayExercise)}
                          orderIndex={index + 1}
                        />
                      </motion.div>
                    ))
                  )}
                </div>
              </AnimatePresence>

              {/* Drop Zone at Bottom (when there are exercises) */}
              <AnimatePresence>
                {cooldownExercises.length > 0 && (isCooldownDraggedOver || cooldownDroppable.isOver) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 p-3 border-2 border-dashed border-amber-400 rounded-xl
                              bg-gradient-to-br from-amber-50 to-amber-100/50 text-center"
                  >
                    <span className="text-xs text-amber-600 font-semibold">{t('trainingDay.dropToAdd')}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </SortableContext>
        </div>
      </div>
    </motion.div>
  );
}

// Add Day Column - Modern design
interface AddDayColumnProps {
  onClick: () => void;
}

export function AddDayColumn({ onClick }: AddDayColumnProps) {
  const { t } = useTranslation('training');
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
      className="
        flex flex-col items-center justify-center w-40 min-w-[160px] min-h-[300px]
        bg-gradient-to-br from-gray-50 to-white
        border-2 border-dashed border-gray-200 rounded-2xl
        text-gray-400 hover:text-primary-600 hover:border-primary-300
        hover:bg-gradient-to-br hover:from-primary-50 hover:to-white
        transition-all duration-300 group
      "
    >
      <motion.div
        className="p-3 rounded-xl bg-gray-100 group-hover:bg-primary-100 transition-colors duration-300"
        whileHover={{ rotate: 90 }}
        transition={{ duration: 0.3 }}
      >
        <PlusIcon className="h-6 w-6" />
      </motion.div>
      <span className="text-sm font-semibold mt-3">{t('trainingDay.addDay')}</span>
      <span className="text-xs text-gray-400 group-hover:text-primary-400 mt-1">{t('trainingDay.ofTraining')}</span>
    </motion.button>
  );
}
