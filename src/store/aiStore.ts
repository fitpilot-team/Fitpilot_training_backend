import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { aiService } from '../services/ai';
import type {
  AIGeneratorState,
  QuestionnaireAnswers,
  AIWorkoutRequest,
  FitnessLevel,
  PrimaryGoal,
  EquipmentType,
  CreationMode,
  InterviewValidationResponse,
} from '../types/ai';

const TOTAL_STEPS = 6;

const initialAnswers: QuestionnaireAnswers = {
  // Profile defaults
  fitness_level: undefined,
  age: undefined,
  gender: undefined,
  weight_kg: undefined,
  height_cm: undefined,
  training_experience_months: undefined,

  // Goals defaults
  primary_goal: undefined,
  specific_goals: '',
  target_muscle_groups: [],

  // Availability defaults
  days_per_week: 4,
  session_duration_minutes: 60,
  preferred_days: [],

  // Equipment defaults
  has_gym_access: true,
  available_equipment: ['bodyweight'],
  equipment_notes: '',

  // Restrictions defaults
  injuries: '',
  excluded_exercises: '',
  medical_conditions: '',
  mobility_limitations: '',

  // Preferences defaults
  exercise_variety: 'medium',
  include_cardio: false,
  include_warmup: true,
  preferred_training_style: '',

  // Duration defaults
  total_weeks: 8,
  mesocycle_weeks: 4,
  include_deload: true,
  start_date: new Date().toISOString().split('T')[0],
};

interface AIStoreActions {
  // Navigation
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;

  // Answers
  setAnswer: <K extends keyof QuestionnaireAnswers>(
    key: K,
    value: QuestionnaireAnswers[K]
  ) => void;
  setAnswers: (answers: Partial<QuestionnaireAnswers>) => void;

  // Config
  loadConfig: () => Promise<void>;

  // Mode selection
  setCreationMode: (mode: CreationMode) => void;
  setSelectedClient: (clientId: string | null, clientName: string | null) => void;
  setTemplateName: (name: string) => void;

  // Interview validation
  validateClientInterview: (clientId: string) => Promise<InterviewValidationResponse>;
  loadInterviewData: (clientId: string) => Promise<void>;
  setInterviewValidation: (validation: InterviewValidationResponse | null) => void;

  // Generation
  generateWorkout: (clientId?: string) => Promise<void>;
  generatePreview: (clientId?: string) => Promise<void>;
  testGenerateWorkout: (clientId?: string) => Promise<void>;
  saveWorkout: (clientId?: string) => Promise<string>;

  // UI
  clearError: () => void;
  reset: () => void;
  clearPersistedState: () => void;
}

type AIStore = AIGeneratorState & AIStoreActions;

export const useAIStore = create<AIStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentStep: 0,
        answers: { ...initialAnswers },
        config: null,
        isGenerating: false,
        generatedWorkout: null,
        isSaving: false,
        error: null,

        // Mode state
        creationMode: null,
        selectedClientId: null,
        selectedClientName: null,
        templateName: '',

        // Validation state
        isValidatingInterview: false,
        interviewValidation: null,

        // Navigation actions
        nextStep: () => {
          const { currentStep } = get();
          if (currentStep < TOTAL_STEPS - 1) {
            set({ currentStep: currentStep + 1 });
          }
        },

        prevStep: () => {
          const { currentStep } = get();
          if (currentStep > 0) {
            set({ currentStep: currentStep - 1 });
          }
        },

        goToStep: (step: number) => {
          if (step >= 0 && step < TOTAL_STEPS) {
            set({ currentStep: step });
          }
        },

        // Answer actions
        setAnswer: (key, value) => {
          set((state) => ({
            answers: {
              ...state.answers,
              [key]: value,
            },
          }));
        },

        setAnswers: (answers) => {
          set((state) => ({
            answers: {
              ...state.answers,
              ...answers,
            },
          }));
        },

        // Config actions
        loadConfig: async () => {
          try {
            const config = await aiService.getQuestionnaireConfig();
            set({ config });
          } catch (error: any) {
            set({ error: error.message || 'Error cargando configuracion' });
          }
        },

        // Mode selection actions
        setCreationMode: (mode: CreationMode) => {
          set({ creationMode: mode });
        },

        setSelectedClient: (clientId: string | null, clientName: string | null) => {
          set({
            selectedClientId: clientId,
            selectedClientName: clientName,
            interviewValidation: null,
          });
        },

        setTemplateName: (name: string) => {
          set({ templateName: name });
        },

        // Interview validation actions
        validateClientInterview: async (clientId: string) => {
          set({ isValidatingInterview: true, error: null });
          try {
            const validation = await aiService.validateClientInterview(clientId);
            set({ interviewValidation: validation, isValidatingInterview: false });
            return validation;
          } catch (error: any) {
            set({
              error: error.message || 'Error validando entrevista',
              isValidatingInterview: false,
            });
            throw error;
          }
        },

        loadInterviewData: async (clientId: string) => {
          set({ error: null });
          try {
            const data = await aiService.getInterviewData(clientId);
            // Map interview data to questionnaire answers
            set((state) => ({
              answers: {
                ...state.answers,
                // Profile
                fitness_level: data.user_profile.fitness_level,
                age: data.user_profile.age,
                gender: data.user_profile.gender,
                weight_kg: data.user_profile.weight_kg,
                height_cm: data.user_profile.height_cm,
                training_experience_months: data.user_profile.training_experience_months,
                // Goals
                primary_goal: data.goals.primary_goal,
                specific_goals: data.goals.specific_goals?.join(', ') || '',
                target_muscle_groups: data.goals.target_muscle_groups,
                // Availability
                days_per_week: data.availability.days_per_week,
                session_duration_minutes: data.availability.session_duration_minutes,
                preferred_days: data.availability.preferred_days,
                // Equipment
                has_gym_access: data.equipment.has_gym_access,
                available_equipment: data.equipment.available_equipment,
                equipment_notes: data.equipment.equipment_notes,
                // Restrictions
                injuries: data.restrictions?.injuries?.join(', ') || '',
                excluded_exercises: data.restrictions?.excluded_exercises?.join(', ') || '',
                medical_conditions: data.restrictions?.medical_conditions?.join(', ') || '',
                mobility_limitations: data.restrictions?.mobility_limitations || '',
              },
              selectedClientId: clientId,
              selectedClientName: data.client_name,
            }));
          } catch (error: any) {
            set({ error: error.message || 'Error cargando datos de entrevista' });
            throw error;
          }
        },

        setInterviewValidation: (validation: InterviewValidationResponse | null) => {
          set({ interviewValidation: validation });
        },

        // Generation actions
        generateWorkout: async (clientId?: string) => {
          const { answers, creationMode, selectedClientId, templateName } = get();
          const effectiveClientId = clientId || selectedClientId;
          set({ isGenerating: true, error: null });

          try {
            const normalizedAnswers = normalizeAnswers(answers);
            set({ answers: normalizedAnswers });
            const request = buildRequest(normalizedAnswers, effectiveClientId, creationMode, templateName);
            const result = await aiService.generateWorkout(request);

            if (result.success) {
              set({ generatedWorkout: result });
            } else {
              set({ error: result.error || 'Error generando programa' });
            }
          } catch (error: any) {
            set({ error: error.message || 'Error generando programa' });
          } finally {
            set({ isGenerating: false });
          }
        },

        generatePreview: async (clientId?: string) => {
          const { answers, creationMode, selectedClientId, templateName } = get();
          const effectiveClientId = clientId || selectedClientId;
          set({ isGenerating: true, error: null });

          try {
            const normalizedAnswers = normalizeAnswers(answers);
            set({ answers: normalizedAnswers });
            const request = buildRequest(normalizedAnswers, effectiveClientId, creationMode, templateName);
            const result = await aiService.generatePreview(request);

            if (result.success) {
              set({ generatedWorkout: result });
            } else {
              set({ error: result.error || 'Error generando preview' });
            }
          } catch (error: any) {
            set({ error: error.message || 'Error generando preview' });
          } finally {
            set({ isGenerating: false });
          }
        },

        testGenerateWorkout: async (clientId?: string) => {
          const { answers, creationMode, selectedClientId, templateName } = get();
          const effectiveClientId = clientId || selectedClientId;
          set({ isGenerating: true, error: null });

          try {
            const normalizedAnswers = normalizeAnswers(answers);
            set({ answers: normalizedAnswers });
            const request = buildRequest(normalizedAnswers, effectiveClientId, creationMode, templateName);
            const result = await aiService.testGenerate(request);

            if (result.success) {
              set({ generatedWorkout: result });
            } else {
              set({ error: result.error || 'Error generando programa de prueba' });
            }
          } catch (error: any) {
            set({ error: error.message || 'Error generando programa de prueba' });
          } finally {
            set({ isGenerating: false });
          }
        },

        saveWorkout: async (clientId?: string) => {
          const { answers, generatedWorkout, creationMode, selectedClientId, templateName } = get();
          const effectiveClientId = clientId || selectedClientId;

          if (!generatedWorkout?.macrocycle) {
            set({ error: 'No hay programa para guardar' });
            throw new Error('No hay programa para guardar');
          }

          set({ isSaving: true, error: null });

          try {
            const normalizedAnswers = normalizeAnswers(answers);
            set({ answers: normalizedAnswers });
            const request = buildRequest(normalizedAnswers, effectiveClientId, creationMode, templateName);
            const result = await aiService.saveWorkout(request, {
              macrocycle: generatedWorkout.macrocycle,
              explanation: generatedWorkout.explanation,
            });

            set({ isSaving: false });
            return result.macrocycle_id;
          } catch (error: any) {
            set({ error: error.message || 'Error guardando programa', isSaving: false });
            throw error;
          }
        },

        // UI actions
        clearError: () => {
          set({ error: null });
        },

        reset: () => {
          set({
            currentStep: 0,
            answers: { ...initialAnswers },
            isGenerating: false,
            generatedWorkout: null,
            isSaving: false,
            error: null,
            creationMode: null,
            selectedClientId: null,
            selectedClientName: null,
            templateName: '',
            isValidatingInterview: false,
            interviewValidation: null,
          });
        },

        clearPersistedState: () => {
          // Clear localStorage and reset to initial state
          localStorage.removeItem('ai-generator-storage');
          set({
            currentStep: 0,
            answers: { ...initialAnswers },
            isGenerating: false,
            generatedWorkout: null,
            isSaving: false,
            error: null,
            creationMode: null,
            selectedClientId: null,
            selectedClientName: null,
            templateName: '',
            isValidatingInterview: false,
            interviewValidation: null,
          });
        },
      }),
      {
        name: 'ai-generator-storage',
        storage: createJSONStorage(() => localStorage),
        // Only persist these fields to avoid storing sensitive/transient data
        partialize: (state) => ({
          answers: state.answers,
          selectedClientId: state.selectedClientId,
          selectedClientName: state.selectedClientName,
          templateName: state.templateName,
          creationMode: state.creationMode,
          currentStep: state.currentStep,
        }),
      }
    ),
    { name: 'AIStore' }
  )
);

// Helpers to sanitize and normalize answers before hitting the API
function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function sanitizeOptionalNumber(value: number | undefined, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  if (value < min || value > max) return undefined;
  return value;
}

function dedupeStringArray<T extends string>(items?: T[]): T[] | undefined {
  if (!items || items.length === 0) return undefined;
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))) as T[];
}

function dedupeNumberArray(items: number[] | undefined, min?: number, max?: number): number[] | undefined {
  if (!items || items.length === 0) return undefined;
  const filtered = items.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  const bounded = filtered
    .map((n) => {
      if (min !== undefined && n < min) return min;
      if (max !== undefined && n > max) return max;
      return n;
    });
  return Array.from(new Set(bounded)).sort((a, b) => a - b);
}

function cleanCommaSeparated(value?: string): string {
  if (!value) return '';
  const cleaned = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return cleaned.join(', ');
}

function normalizeEquipment(equipment?: EquipmentType[]): EquipmentType[] {
  const fallback: EquipmentType[] = ['bodyweight'];
  if (!equipment || equipment.length === 0) return fallback;
  const deduped = Array.from(new Set(equipment));
  return deduped.length ? deduped : fallback;
}

function normalizeAnswers(answers: QuestionnaireAnswers): QuestionnaireAnswers {
  const today = new Date().toISOString().split('T')[0];
  const daysPerWeek = clampNumber(answers.days_per_week, 1, 7, 4);
  const sessionDuration = clampNumber(answers.session_duration_minutes, 20, 180, 60);
  const totalWeeks = clampNumber(answers.total_weeks, 1, 52, 8);
  const mesocycleWeeks = clampNumber(
    answers.mesocycle_weeks,
    1,
    Math.max(1, Math.min(6, totalWeeks)),
    4
  );

  return {
    ...answers,
    // Profile
    fitness_level: answers.fitness_level,
    age: sanitizeOptionalNumber(answers.age, 10, 100),
    weight_kg: sanitizeOptionalNumber(answers.weight_kg, 30, 300),
    height_cm: sanitizeOptionalNumber(answers.height_cm, 120, 250),
    gender: answers.gender,
    training_experience_months: sanitizeOptionalNumber(answers.training_experience_months, 0, 600),
    // Goals
    primary_goal: answers.primary_goal,
    specific_goals: cleanCommaSeparated(answers.specific_goals),
    target_muscle_groups: dedupeStringArray(answers.target_muscle_groups),
    // Availability
    days_per_week: daysPerWeek,
    session_duration_minutes: sessionDuration,
    preferred_days: dedupeNumberArray(answers.preferred_days, 1, 7),
    // Equipment
    has_gym_access: answers.has_gym_access ?? true,
    available_equipment: normalizeEquipment(answers.available_equipment as EquipmentType[] | undefined),
    equipment_notes: answers.equipment_notes?.trim() || '',
    // Restrictions
    injuries: cleanCommaSeparated(answers.injuries),
    excluded_exercises: cleanCommaSeparated(answers.excluded_exercises),
    medical_conditions: cleanCommaSeparated(answers.medical_conditions),
    mobility_limitations: answers.mobility_limitations?.trim() || '',
    // Preferences
    exercise_variety: answers.exercise_variety || 'medium',
    include_cardio: answers.include_cardio ?? false,
    include_warmup: answers.include_warmup ?? true,
    preferred_training_style: (answers.preferred_training_style || '').trim(),
    // Duration
    total_weeks: totalWeeks,
    mesocycle_weeks: mesocycleWeeks,
    include_deload: answers.include_deload ?? true,
    start_date: answers.start_date?.trim() || today,
  };
}

// Helper function to build the request from answers
function buildRequest(
  answers: QuestionnaireAnswers,
  clientId: string | null | undefined,
  creationMode: CreationMode | null,
  templateName: string
): AIWorkoutRequest {
  const normalized = normalizeAnswers(answers);

  // Parse specific_goals from string to array
  const specificGoals = normalized.specific_goals
    ? normalized.specific_goals.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Parse injuries from string to array
  const injuries = normalized.injuries
    ? normalized.injuries.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Parse excluded_exercises from string to array
  const excludedExercises = normalized.excluded_exercises
    ? normalized.excluded_exercises.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Parse medical_conditions from string to array
  const medicalConditions = normalized.medical_conditions
    ? normalized.medical_conditions.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Determine effective creation mode
  const effectiveMode: CreationMode = creationMode || (clientId ? 'client' : 'template');

  return {
    user_profile: {
      fitness_level: normalized.fitness_level as FitnessLevel,
      age: normalized.age,
      weight_kg: normalized.weight_kg,
      height_cm: normalized.height_cm,
      gender: normalized.gender,
      training_experience_months: normalized.training_experience_months,
    },
    goals: {
      primary_goal: normalized.primary_goal as PrimaryGoal,
      specific_goals: specificGoals,
      target_muscle_groups: normalized.target_muscle_groups,
    },
    availability: {
      days_per_week: normalized.days_per_week || 4,
      session_duration_minutes: normalized.session_duration_minutes || 60,
      preferred_days: normalized.preferred_days,
    },
    equipment: {
      has_gym_access: normalized.has_gym_access ?? true,
      available_equipment: (normalized.available_equipment || ['bodyweight']) as EquipmentType[],
      equipment_notes: normalized.equipment_notes,
    },
    restrictions: {
      injuries,
      excluded_exercises: excludedExercises,
      medical_conditions: medicalConditions,
      mobility_limitations: normalized.mobility_limitations,
    },
    preferences: {
      exercise_variety: normalized.exercise_variety,
      include_cardio: normalized.include_cardio,
      include_warmup: normalized.include_warmup,
      include_cooldown: false,
      preferred_training_style: normalized.preferred_training_style,
    },
    program_duration: {
      total_weeks: normalized.total_weeks || 8,
      mesocycle_weeks: normalized.mesocycle_weeks || 4,
      include_deload: normalized.include_deload ?? true,
      start_date: normalized.start_date || new Date().toISOString().split('T')[0],
    },
    creation_mode: effectiveMode,
    client_id: effectiveMode === 'client' ? clientId || undefined : undefined,
    template_name: effectiveMode === 'template' ? templateName || undefined : undefined,
  };
}
