import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Macrocycle,
  Mesocycle,
  Microcycle,
  TrainingDay,
  DayExercise,
  Exercise,
} from '../types';
import {
  mesocyclesService,
  MacrocycleCreateData,
  MacrocycleUpdateData,
  MesocycleCreateData,
  MesocycleUpdateData,
  MicrocycleCreateData,
  MicrocycleUpdateData,
  TrainingDayCreateData,
  TrainingDayUpdateData,
  DayExerciseCreateData,
  DayExerciseUpdateData,
} from '../services/mesocycles';
import { exercisesService } from '../services/exercises';

interface MesocycleState {
  // Data - 5 level hierarchy
  macrocycles: Macrocycle[];
  currentMacrocycle: Macrocycle | null;
  mesocycles: Record<string, Mesocycle[]>; // keyed by macrocycle_id
  microcycles: Record<string, Microcycle[]>; // keyed by mesocycle_id
  trainingDays: Record<string, TrainingDay[]>; // keyed by microcycle_id
  dayExercises: Record<string, DayExercise[]>; // keyed by training_day_id
  exercises: Exercise[];

  // Loading states
  isLoadingMacrocycles: boolean;
  isLoadingMacrocycle: boolean;
  isLoadingExercises: boolean;

  // Error
  error: string | null;

  // Actions - Macrocycles
  loadMacrocycles: () => Promise<void>;
  loadMacrocycle: (id: string) => Promise<void>;
  createMacrocycle: (data: MacrocycleCreateData) => Promise<Macrocycle>;
  updateMacrocycle: (id: string, data: MacrocycleUpdateData) => Promise<void>;
  deleteMacrocycle: (id: string) => Promise<void>;
  setCurrentMacrocycle: (macrocycle: Macrocycle | null) => void;

  // Actions - Mesocycles
  loadMesocycles: (macrocycleId: string) => Promise<void>;
  createMesocycle: (macrocycleId: string, data: MesocycleCreateData) => Promise<Mesocycle>;
  updateMesocycle: (macrocycleId: string, mesocycleId: string, data: MesocycleUpdateData) => Promise<void>;
  deleteMesocycle: (macrocycleId: string, mesocycleId: string) => Promise<void>;

  // Actions - Microcycles
  createMicrocycle: (macrocycleId: string, mesocycleId: string, data: MicrocycleCreateData) => Promise<Microcycle>;
  updateMicrocycle: (macrocycleId: string, mesocycleId: string, microcycleId: string, data: MicrocycleUpdateData) => Promise<void>;
  deleteMicrocycle: (macrocycleId: string, mesocycleId: string, microcycleId: string) => Promise<void>;

  // Actions - Training Days
  createTrainingDay: (macrocycleId: string, mesocycleId: string, microcycleId: string, data: TrainingDayCreateData) => Promise<TrainingDay>;
  updateTrainingDay: (macrocycleId: string, mesocycleId: string, microcycleId: string, dayId: string, data: TrainingDayUpdateData) => Promise<void>;
  deleteTrainingDay: (macrocycleId: string, mesocycleId: string, microcycleId: string, dayId: string) => Promise<void>;

  // Actions - Day Exercises
  createDayExercise: (macrocycleId: string, mesocycleId: string, microcycleId: string, dayId: string, data: DayExerciseCreateData) => Promise<DayExercise>;
  updateDayExercise: (macrocycleId: string, mesocycleId: string, microcycleId: string, dayId: string, exerciseId: string, data: DayExerciseUpdateData) => Promise<void>;
  deleteDayExercise: (macrocycleId: string, mesocycleId: string, microcycleId: string, dayId: string, exerciseId: string) => Promise<void>;

  // Actions - Exercises
  loadExercises: (filters?: any) => Promise<void>;

  // Actions - Drag and Drop
  reorderExercises: (dayId: string, exerciseIds: string[]) => Promise<void>;
  moveExerciseBetweenDays: (exerciseId: string, fromDayId: string, toDayId: string, newIndex: number) => Promise<void>;
}

export const useMesocycleStore = create<MesocycleState>()(
  devtools(
    (set) => ({
      // Initial state
      macrocycles: [],
      currentMacrocycle: null,
      mesocycles: {},
      microcycles: {},
      trainingDays: {},
      dayExercises: {},
      exercises: [],
      isLoadingMacrocycles: false,
      isLoadingMacrocycle: false,
      isLoadingExercises: false,
      error: null,

      // =============== Macrocycles ===============
      loadMacrocycles: async () => {
        set({ isLoadingMacrocycles: true, error: null });
        try {
          const response = await mesocyclesService.getAllMacrocycles();
          const macrocycles = Array.isArray(response) ? response : [];
          set({ macrocycles, isLoadingMacrocycles: false });
        } catch (error: any) {
          set({ error: error.message, isLoadingMacrocycles: false, macrocycles: [] });
        }
      },

      loadMacrocycle: async (id: string) => {
        set({ isLoadingMacrocycle: true, error: null });
        try {
          const macrocycle = await mesocyclesService.getMacrocycleById(id);
          set({ currentMacrocycle: macrocycle, isLoadingMacrocycle: false });

          // Extract nested mesocycles from macrocycle response
          if (macrocycle.mesocycles) {
            set((state) => ({
              mesocycles: { ...state.mesocycles, [id]: macrocycle.mesocycles },
            }));

            // Extract microcycles from each mesocycle
            for (const meso of macrocycle.mesocycles) {
              if (meso.microcycles) {
                set((state) => ({
                  microcycles: { ...state.microcycles, [meso.id]: meso.microcycles },
                }));

                // Extract training days from each microcycle
                for (const micro of meso.microcycles) {
                  if (micro.training_days) {
                    set((state) => ({
                      trainingDays: { ...state.trainingDays, [micro.id]: micro.training_days },
                    }));

                    // Extract day exercises from each training day
                    for (const day of micro.training_days) {
                      if (day.exercises) {
                        set((state) => ({
                          dayExercises: { ...state.dayExercises, [day.id]: day.exercises },
                        }));
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (error: any) {
          set({ error: error.message, isLoadingMacrocycle: false });
        }
      },

      createMacrocycle: async (data: MacrocycleCreateData) => {
        set({ error: null });
        try {
          const macrocycle = await mesocyclesService.createMacrocycle(data);
          set((state) => ({
            macrocycles: [...state.macrocycles, macrocycle],
          }));
          return macrocycle;
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      updateMacrocycle: async (id: string, data: MacrocycleUpdateData) => {
        set({ error: null });
        try {
          const updated = await mesocyclesService.updateMacrocycle(id, data);
          set((state) => ({
            macrocycles: state.macrocycles.map((m) => (m.id === id ? updated : m)),
            currentMacrocycle: state.currentMacrocycle?.id === id ? updated : state.currentMacrocycle,
          }));
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      deleteMacrocycle: async (id: string) => {
        set({ error: null });
        try {
          await mesocyclesService.deleteMacrocycle(id);
          set((state) => ({
            macrocycles: state.macrocycles.filter((m) => m.id !== id),
            currentMacrocycle: state.currentMacrocycle?.id === id ? null : state.currentMacrocycle,
          }));
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      setCurrentMacrocycle: (macrocycle: Macrocycle | null) => {
        set({ currentMacrocycle: macrocycle });
      },

      // =============== Mesocycles ===============
      loadMesocycles: async (macrocycleId: string) => {
        set({ error: null });
        try {
          const mesocycles = await mesocyclesService.getMesocycles(macrocycleId);
          set((state) => ({
            mesocycles: { ...state.mesocycles, [macrocycleId]: mesocycles },
          }));
        } catch (error: any) {
          set({ error: error.message });
        }
      },

      createMesocycle: async (macrocycleId: string, data: MesocycleCreateData) => {
        set({ error: null });
        try {
          const mesocycle = await mesocyclesService.createMesocycle(macrocycleId, data);
          set((state) => ({
            mesocycles: {
              ...state.mesocycles,
              [macrocycleId]: [...(state.mesocycles[macrocycleId] || []), mesocycle],
            },
          }));
          return mesocycle;
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      updateMesocycle: async (macrocycleId: string, mesocycleId: string, data: MesocycleUpdateData) => {
        set({ error: null });
        try {
          const updated = await mesocyclesService.updateMesocycle(macrocycleId, mesocycleId, data);
          set((state) => ({
            mesocycles: {
              ...state.mesocycles,
              [macrocycleId]: (state.mesocycles[macrocycleId] || []).map((m) =>
                m.id === mesocycleId ? updated : m
              ),
            },
          }));
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      deleteMesocycle: async (macrocycleId: string, mesocycleId: string) => {
        set({ error: null });
        try {
          await mesocyclesService.deleteMesocycle(macrocycleId, mesocycleId);
          set((state) => ({
            mesocycles: {
              ...state.mesocycles,
              [macrocycleId]: (state.mesocycles[macrocycleId] || []).filter((m) => m.id !== mesocycleId),
            },
          }));
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      // =============== Microcycles ===============
      createMicrocycle: async (macrocycleId: string, mesocycleId: string, data: MicrocycleCreateData) => {
        set({ error: null });
        try {
          const microcycle = await mesocyclesService.createMicrocycle(macrocycleId, mesocycleId, data);
          set((state) => ({
            microcycles: {
              ...state.microcycles,
              [mesocycleId]: [...(state.microcycles[mesocycleId] || []), microcycle],
            },
          }));
          return microcycle;
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      updateMicrocycle: async (macrocycleId: string, mesocycleId: string, microcycleId: string, data: MicrocycleUpdateData) => {
        set({ error: null });
        try {
          const updated = await mesocyclesService.updateMicrocycle(macrocycleId, mesocycleId, microcycleId, data);
          set((state) => ({
            microcycles: {
              ...state.microcycles,
              [mesocycleId]: (state.microcycles[mesocycleId] || []).map((m) =>
                m.id === microcycleId ? updated : m
              ),
            },
          }));
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      deleteMicrocycle: async (macrocycleId: string, mesocycleId: string, microcycleId: string) => {
        set({ error: null });
        try {
          await mesocyclesService.deleteMicrocycle(macrocycleId, mesocycleId, microcycleId);
          set((state) => ({
            microcycles: {
              ...state.microcycles,
              [mesocycleId]: (state.microcycles[mesocycleId] || []).filter((m) => m.id !== microcycleId),
            },
          }));
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      // =============== Training Days ===============
      createTrainingDay: async (macrocycleId: string, mesocycleId: string, microcycleId: string, data: TrainingDayCreateData) => {
        set({ error: null });
        try {
          const day = await mesocyclesService.createTrainingDay(macrocycleId, mesocycleId, microcycleId, data);
          set((state) => ({
            trainingDays: {
              ...state.trainingDays,
              [microcycleId]: [...(state.trainingDays[microcycleId] || []), day],
            },
          }));
          return day;
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      updateTrainingDay: async (macrocycleId: string, mesocycleId: string, microcycleId: string, dayId: string, data: TrainingDayUpdateData) => {
        set({ error: null });
        try {
          const updated = await mesocyclesService.updateTrainingDay(macrocycleId, mesocycleId, microcycleId, dayId, data);
          set((state) => ({
            trainingDays: {
              ...state.trainingDays,
              [microcycleId]: (state.trainingDays[microcycleId] || []).map((d) =>
                d.id === dayId ? updated : d
              ),
            },
          }));
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      deleteTrainingDay: async (macrocycleId: string, mesocycleId: string, microcycleId: string, dayId: string) => {
        set({ error: null });
        try {
          await mesocyclesService.deleteTrainingDay(macrocycleId, mesocycleId, microcycleId, dayId);
          set((state) => ({
            trainingDays: {
              ...state.trainingDays,
              [microcycleId]: (state.trainingDays[microcycleId] || []).filter((d) => d.id !== dayId),
            },
          }));
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      // =============== Day Exercises ===============
      createDayExercise: async (macrocycleId: string, mesocycleId: string, microcycleId: string, dayId: string, data: DayExerciseCreateData) => {
        set({ error: null });
        try {
          const exercise = await mesocyclesService.createDayExercise(macrocycleId, mesocycleId, microcycleId, dayId, data);
          set((state) => {
            const updatedDayExercises = [...(state.dayExercises[dayId] || []), exercise];

            // También actualizar trainingDays para que la UI se actualice
            const updatedTrainingDays = { ...state.trainingDays };
            for (const mcId of Object.keys(updatedTrainingDays)) {
              updatedTrainingDays[mcId] = updatedTrainingDays[mcId].map(day => {
                if (day.id === dayId) {
                  return { ...day, exercises: updatedDayExercises };
                }
                return day;
              });
            }

            return {
              dayExercises: {
                ...state.dayExercises,
                [dayId]: updatedDayExercises,
              },
              trainingDays: updatedTrainingDays,
            };
          });
          return exercise;
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      updateDayExercise: async (macrocycleId: string, mesocycleId: string, microcycleId: string, dayId: string, exerciseId: string, data: DayExerciseUpdateData) => {
        set({ error: null });
        try {
          const updated = await mesocyclesService.updateDayExercise(macrocycleId, mesocycleId, microcycleId, dayId, exerciseId, data);
          set((state) => {
            // Actualizar dayExercises
            const updatedDayExercises = (state.dayExercises[dayId] || []).map((e) =>
              e.id === exerciseId ? updated : e
            );

            // También actualizar trainingDays para que la UI se actualice
            const updatedTrainingDays = { ...state.trainingDays };
            for (const mcId of Object.keys(updatedTrainingDays)) {
              updatedTrainingDays[mcId] = updatedTrainingDays[mcId].map(day => {
                if (day.id === dayId) {
                  return { ...day, exercises: updatedDayExercises };
                }
                return day;
              });
            }

            return {
              dayExercises: {
                ...state.dayExercises,
                [dayId]: updatedDayExercises,
              },
              trainingDays: updatedTrainingDays,
            };
          });
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      deleteDayExercise: async (macrocycleId: string, mesocycleId: string, microcycleId: string, dayId: string, exerciseId: string) => {
        set({ error: null });
        try {
          await mesocyclesService.deleteDayExercise(macrocycleId, mesocycleId, microcycleId, dayId, exerciseId);
          set((state) => {
            const updatedDayExercises = (state.dayExercises[dayId] || []).filter((e) => e.id !== exerciseId);

            // También actualizar trainingDays para que la UI se actualice
            const updatedTrainingDays = { ...state.trainingDays };
            for (const mcId of Object.keys(updatedTrainingDays)) {
              updatedTrainingDays[mcId] = updatedTrainingDays[mcId].map(day => {
                if (day.id === dayId) {
                  return { ...day, exercises: updatedDayExercises };
                }
                return day;
              });
            }

            return {
              dayExercises: {
                ...state.dayExercises,
                [dayId]: updatedDayExercises,
              },
              trainingDays: updatedTrainingDays,
            };
          });
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      // =============== Exercises ===============
      loadExercises: async (filters?: any) => {
        set({ isLoadingExercises: true, error: null });
        try {
          // Cargar todos los ejercicios (el backend tiene límite de 100 por defecto)
          const response = await exercisesService.getAll({ ...filters, limit: 500 });
          set({ exercises: response.exercises, isLoadingExercises: false });
        } catch (error: any) {
          set({ error: error.message, isLoadingExercises: false });
        }
      },

      // =============== Drag and Drop ===============
      reorderExercises: async (dayId: string, exerciseIds: string[]) => {
        set({ error: null });
        try {
          // Actualización optimista de AMBAS estructuras
          set((state) => {
            const dayExercises = state.dayExercises[dayId] || [];
            const reordered = exerciseIds.map((id, index) => {
              const exercise = dayExercises.find((e) => e.id === id);
              return exercise ? { ...exercise, order_index: index } : null;
            }).filter(Boolean) as DayExercise[];

            // También actualizar trainingDays para que la UI se actualice
            const updatedTrainingDays = { ...state.trainingDays };
            for (const microcycleId of Object.keys(updatedTrainingDays)) {
              updatedTrainingDays[microcycleId] = updatedTrainingDays[microcycleId].map(day => {
                if (day.id === dayId) {
                  return { ...day, exercises: reordered };
                }
                return day;
              });
            }

            return {
              dayExercises: {
                ...state.dayExercises,
                [dayId]: reordered,
              },
              trainingDays: updatedTrainingDays,
            };
          });

          // API call
          await mesocyclesService.reorderExercises(dayId, exerciseIds);
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      moveExerciseBetweenDays: async (
        exerciseId: string,
        fromDayId: string,
        toDayId: string,
        newIndex: number
      ) => {
        set({ error: null });
        try {
          // Actualización optimista de AMBAS estructuras
          set((state) => {
            const fromExercises = [...(state.dayExercises[fromDayId] || [])];
            const toExercises = [...(state.dayExercises[toDayId] || [])];

            // Find and remove from source
            const exerciseIndex = fromExercises.findIndex((e) => e.id === exerciseId);
            if (exerciseIndex === -1) return state;

            const [movedExercise] = fromExercises.splice(exerciseIndex, 1);

            // Add to target
            const updatedExercise = { ...movedExercise, training_day_id: toDayId, order_index: newIndex };
            toExercises.splice(newIndex, 0, updatedExercise);

            // Reindex both arrays
            const reindexedFrom = fromExercises.map((e, i) => ({ ...e, order_index: i }));
            const reindexedTo = toExercises.map((e, i) => ({ ...e, order_index: i }));

            // También actualizar trainingDays para que la UI se actualice
            const updatedTrainingDays = { ...state.trainingDays };
            for (const microcycleId of Object.keys(updatedTrainingDays)) {
              updatedTrainingDays[microcycleId] = updatedTrainingDays[microcycleId].map(day => {
                if (day.id === fromDayId) {
                  return { ...day, exercises: reindexedFrom };
                }
                if (day.id === toDayId) {
                  return { ...day, exercises: reindexedTo };
                }
                return day;
              });
            }

            return {
              dayExercises: {
                ...state.dayExercises,
                [fromDayId]: reindexedFrom,
                [toDayId]: reindexedTo,
              },
              trainingDays: updatedTrainingDays,
            };
          });

          // API call
          await mesocyclesService.moveExerciseBetweenDays(exerciseId, fromDayId, toDayId, newIndex);
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },
    }),
    { name: 'MesocycleStore' }
  )
);
