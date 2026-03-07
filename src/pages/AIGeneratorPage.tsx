import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import {
  SparklesIcon,
  ArrowLeftIcon,
  DocumentDuplicateIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import { useAIStore } from '../store/aiStore';
import { useAuthStore } from '../store/newAuthStore';
import {
  ModeSelector,
  ClientSelector,
  TrainingQuestionnaire,
  GenerationProgress,
  QuickConfigPanel,
} from '../components/ai';
import type { CreationMode, InterviewValidationResponse } from '../types/ai';

type PageStep = 'mode-selection' | 'client-selection' | 'template-config' | 'quick-config' | 'questionnaire' | 'generating';

// Map missing field names to step indices
const FIELD_TO_STEP_MAP: Record<string, number> = {
  // Profile (step 0)
  'fitness_level': 0,
  'Nivel de experiencia': 0,
  'Experience level': 0,
  // Goals (step 1)
  'primary_goal': 1,
  'Objetivo principal': 1,
  'Primary goal': 1,
  // Availability (step 2)
  'days_per_week': 2,
  'session_duration_minutes': 2,
  'Días por semana': 2,
  'Duración de sesión': 2,
  'Days per week': 2,
  'Session duration': 2,
  // Equipment (step 3)
  'has_gym_access': 3,
  'available_equipment': 3,
  'Acceso a gimnasio': 3,
  'Equipamiento disponible': 3,
  'Gym access': 3,
  'Available equipment': 3,
};

export const AIGeneratorPage: React.FC = () => {
  const { t } = useTranslation(['ai', 'common']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientIdFromUrl = searchParams.get('client_id');

  const { user } = useAuthStore();
  const {
    creationMode,
    selectedClientId,
    selectedClientName,
    templateName,
  interviewValidation,
  isGenerating,
  generatedWorkout,
  error,
  config,
  setCreationMode,
  setSelectedClient,
  setTemplateName,
  setInterviewValidation,
  loadInterviewData,
    generateWorkout,
    testGenerateWorkout,
  saveWorkout,
  reset,
  clearError,
  loadConfig,
} = useAIStore();

  const [pageStep, setPageStep] = useState<PageStep>('mode-selection');
  const [localTemplateName, setLocalTemplateName] = useState('');
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isInitializing, setIsInitializing] = useState(false);

  // Calculate which steps to show when there are missing fields, leveraging backend config labels
  const stepsToShow = useMemo(() => {
    if (missingFields.length === 0) return undefined;

    const indices = new Set<number>();

    if (config?.steps?.length) {
      missingFields.forEach((field) => {
        const stepIndex = config.steps.findIndex((step) =>
          step.fields?.some((f) => f.label === field || f.name === field)
        );
        if (stepIndex >= 0) {
          indices.add(stepIndex);
        }
      });
    }

    // Fallback mapping for legacy/translated labels
    missingFields.forEach((field) => {
      const mapped = FIELD_TO_STEP_MAP[field];
      if (mapped !== undefined) {
        indices.add(mapped);
      }
    });

    const result = Array.from(indices).filter((step) => step !== undefined);
    return result.length ? result.sort((a, b) => a - b) : undefined;
  }, [missingFields, config]);

  // Initialize based on URL params
  useEffect(() => {
    const initializeFromUrl = async () => {
      reset();

      if (clientIdFromUrl) {
        setIsInitializing(true);
        setCreationMode('client');
        setSelectedClient(clientIdFromUrl, null);

        try {
          // Validate the client's interview
          const validation = await useAIStore.getState().validateClientInterview(clientIdFromUrl);
          setInterviewValidation(validation);

          if (validation.is_complete) {
            // Interview is complete - load data and go to quick-config
            await loadInterviewData(clientIdFromUrl);
            setPageStep('quick-config');
          } else if (validation.has_interview) {
            // Interview exists but incomplete - load data and show only missing steps
            await loadInterviewData(clientIdFromUrl);
            setMissingFields(validation.missing_fields);
            setPageStep('questionnaire');
          } else {
            // No interview at all - go to client selection to show the warning
            setPageStep('client-selection');
          }
        } catch {
          // On error, fall back to client selection
          setPageStep('client-selection');
        } finally {
          setIsInitializing(false);
        }
      }
    };

    initializeFromUrl();
  }, [clientIdFromUrl]);

  // Load questionnaire config once to align steps with backend
  useEffect(() => {
    if (!config) {
      loadConfig().catch(() => {
        toast.error(t('ai:errors.configLoadFailed', { defaultValue: 'No pudimos cargar el cuestionario. Intenta de nuevo.' }));
      });
    }
  }, [config, loadConfig, t]);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error]);

  // Update page step based on generation state
  useEffect(() => {
    if (isGenerating) {
      setPageStep('generating');
    }
  }, [isGenerating]);

  // Auto-save and redirect when generation completes
  useEffect(() => {
    const autoSaveAndRedirect = async () => {
      if (!isGenerating && generatedWorkout?.macrocycle && pageStep === 'generating') {
        try {
          if (generatedWorkout.warnings?.length) {
            generatedWorkout.warnings.slice(0, 3).forEach((warning) => {
              toast(warning, { icon: '⚠️' });
            });
          }
          const macrocycleId = await saveWorkout();
          toast.success(t('ai:messages.programSaved'));
          navigate(`/training/programs/${macrocycleId}`);
        } catch {
          // Error handled in store, go back to questionnaire
          setPageStep('questionnaire');
        }
      }
    };
    autoSaveAndRedirect();
  }, [isGenerating, generatedWorkout]);

  // Check if user can generate (trainer or admin)
  const canGenerate = user?.role === 'trainer' || user?.role === 'admin';

  if (!canGenerate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <SparklesIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('ai:page.accessRestricted')}
          </h2>
          <p className="text-gray-600 mb-4">
            {t('ai:page.trainersOnly')}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            {t('ai:page.backToDashboard')}
          </button>
        </div>
      </div>
    );
  }

  // Handlers
  const handleModeSelect = (mode: CreationMode) => {
    setCreationMode(mode);
    if (mode === 'template') {
      setPageStep('template-config');
    } else {
      setPageStep('client-selection');
    }
  };

  const handleClientSelect = (clientId: string, clientName: string) => {
    setSelectedClient(clientId, clientName);
  };

  const handleValidationComplete = async (validation: InterviewValidationResponse) => {
    setInterviewValidation(validation);
    if (validation.is_complete && selectedClientId) {
      // Load interview data and go directly to questionnaire
      try {
        await loadInterviewData(selectedClientId);
        setPageStep('questionnaire');
      } catch {
        // Error handled in store
      }
    }
  };

  const handleTemplateNameSubmit = () => {
    if (!localTemplateName.trim()) {
      toast.error(t('ai:errors.templateNameRequired'));
      return;
    }
    setTemplateName(localTemplateName);
    setPageStep('questionnaire');
  };

  const handleQuestionnaireComplete = async () => {
    await generateWorkout();
  };

  const handleTestGenerate = async () => {
    await testGenerateWorkout();
  };

  const handleBack = () => {
    switch (pageStep) {
      case 'client-selection':
      case 'template-config':
        setPageStep('mode-selection');
        setCreationMode(null as unknown as CreationMode);
        break;
      case 'quick-config':
        // If came from URL with client_id, go back to clients page
        if (clientIdFromUrl) {
          navigate('/training/programs');
        } else {
          setPageStep('client-selection');
        }
        break;
      case 'questionnaire':
        if (creationMode === 'template') {
          setPageStep('template-config');
        } else if (missingFields.length > 0) {
          // If we were showing missing fields, go back to quick-config or client-selection
          setMissingFields([]);
          if (clientIdFromUrl) {
            navigate('/training/programs');
          } else {
            setPageStep('client-selection');
          }
        } else {
          setPageStep('client-selection');
        }
        break;
      default:
        navigate(-1);
    }
  };

  const getPageTitle = () => {
    switch (pageStep) {
      case 'mode-selection':
        return t('ai:page.selectMode');
      case 'client-selection':
        return t('ai:page.selectClient');
      case 'template-config':
        return t('ai:page.configureTemplate');
      case 'quick-config':
        return t('ai:quickConfig.title');
      case 'questionnaire':
        return creationMode === 'template'
          ? t('ai:page.createTemplate')
          : t('ai:page.createForClient', { name: selectedClientName });
      case 'generating':
        return t('ai:page.generating');
      default:
        return t('ai:title');
    }
  };

  const renderContent = () => {
    // Show loading while initializing from URL
    if (isInitializing) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-3 text-gray-600">{t('ai:clientSelector.validating')}</span>
          </div>
        </div>
      );
    }

    switch (pageStep) {
      case 'mode-selection':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <ModeSelector
              selectedMode={creationMode}
              onModeSelect={handleModeSelect}
            />
          </div>
        );

      case 'client-selection':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <ClientSelector
                selectedClientId={selectedClientId}
                onClientSelect={handleClientSelect}
                onValidationComplete={handleValidationComplete}
              />
            </div>
            {/* Show continue button if interview is complete */}
            {interviewValidation?.is_complete && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setPageStep('questionnaire')}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {t('ai:page.continueToGeneration')}
                </button>
              </div>
            )}
          </div>
        );

      case 'template-config':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {t('ai:templateConfig.title')}
                </h2>
                <p className="text-gray-600 text-sm">
                  {t('ai:templateConfig.description')}
                </p>
              </div>

              <div>
                <label
                  htmlFor="template_name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  {t('ai:templateConfig.nameLabel')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DocumentDuplicateIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="template_name"
                    value={localTemplateName}
                    onChange={(e) => setLocalTemplateName(e.target.value)}
                    placeholder={t('ai:templateConfig.namePlaceholder')}
                    className="block w-full pl-10 pr-4 py-3 border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {t('ai:templateConfig.nameHelp')}
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleTemplateNameSubmit}
                  disabled={!localTemplateName.trim()}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('ai:page.continueToQuestionnaire')}
                </button>
              </div>
            </div>
          </div>
        );

      case 'quick-config':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <QuickConfigPanel
              onGenerate={handleQuestionnaireComplete}
              isGenerating={isGenerating}
            />
          </div>
        );

      case 'questionnaire':
        return (
          <div className="space-y-4">
            <TrainingQuestionnaire
              mode="template"
              onComplete={handleQuestionnaireComplete}
              submitButtonText={t('ai:wizard.generateProgram')}
              config={config || undefined}
              stepsToShow={stepsToShow}
            />
            {/* Boton de Test - genera sin usar API de Claude */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BeakerIcon className="w-6 h-6 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">Modo Test</p>
                    <p className="text-sm text-yellow-600">Genera un programa mock sin usar creditos de IA</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTestGenerate}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2"
                >
                  <BeakerIcon className="w-4 h-4" />
                  Generar Test
                </button>
              </div>
            </div>
          </div>
        );

      case 'generating':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <GenerationProgress />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-6 h-6 text-primary-600" />
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    {getPageTitle()}
                  </h1>
                  {creationMode && pageStep !== 'mode-selection' && (
                    <p className="text-sm text-gray-500">
                      {creationMode === 'template'
                        ? t('ai:page.creatingTemplate')
                        : t('ai:page.creatingForClient')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Context indicator */}
            {selectedClientName && pageStep !== 'mode-selection' && pageStep !== 'client-selection' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 rounded-lg">
                <span className="text-sm text-primary-700">
                  {t('ai:page.for')}: <strong>{selectedClientName}</strong>
                </span>
              </div>
            )}
            {templateName && pageStep !== 'mode-selection' && pageStep !== 'template-config' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 rounded-lg">
                <DocumentDuplicateIcon className="w-4 h-4 text-primary-600" />
                <span className="text-sm text-primary-700">
                  <strong>{templateName}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Info banner - only show on initial steps */}
        {(pageStep === 'mode-selection' || pageStep === 'client-selection' || pageStep === 'template-config') && (
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg p-6 text-white mb-8">
            <div className="flex items-start gap-4">
              <SparklesIcon className="w-8 h-8 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-semibold mb-1">
                  {t('ai:page.createInMinutes')}
                </h2>
                <p className="text-primary-100">
                  {t('ai:page.answerQuestionnaire')}
                </p>
              </div>
            </div>
          </div>
        )}

        {renderContent()}
      </main>
    </div>
  );
};
