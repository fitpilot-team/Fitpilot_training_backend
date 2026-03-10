import React from 'react';
import { useTranslation } from 'react-i18next';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useAIStore } from '../../store/aiStore';

export const GenerationProgress: React.FC = () => {
  const { t } = useTranslation('ai');
  const { isGenerating, generatedWorkout, isSaving } = useAIStore();

  // Determine current phase
  const isGenerated = !isGenerating && generatedWorkout?.macrocycle;
  const isSavingPhase = isGenerated && isSaving;

  // Determine step statuses
  const getStepStatus = (step: 'analyzing' | 'selecting' | 'structuring' | 'calculating' | 'saving') => {
    if (isSavingPhase) {
      // All generation steps complete, saving in progress
      if (step === 'saving') return 'in-progress';
      return 'completed';
    }

    if (isGenerated) {
      // Generated but not yet saving (brief moment)
      if (step === 'saving') return 'in-progress';
      return 'completed';
    }

    // Still generating - show animated progress
    switch (step) {
      case 'analyzing':
        return 'completed';
      case 'selecting':
        return 'in-progress';
      case 'structuring':
      case 'calculating':
      case 'saving':
        return 'pending';
      default:
        return 'pending';
    }
  };

  const getMessage = () => {
    if (isSavingPhase || isGenerated) {
      return t('generation.saving');
    }
    return t('generation.generating');
  };

  const getSubMessage = () => {
    if (isSavingPhase || isGenerated) {
      return t('generation.savingDescription');
    }
    return t('generation.timeWarning');
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Animated icon */}
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping">
          <SparklesIcon className="w-16 h-16 text-primary-400 opacity-75" />
        </div>
        <SparklesIcon className="relative w-16 h-16 text-primary-600 animate-pulse" />
      </div>

      {/* Loading spinner */}
      <div className="mb-6">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>

      {/* Message */}
      <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
        {getMessage()}
      </h3>

      <p className="text-gray-500 text-center max-w-md">
        {getSubMessage()}
      </p>

      {/* Progress steps */}
      <div className="mt-8 space-y-3 w-full max-w-sm">
        <ProgressStep
          label={t('generation.analyzing')}
          status={getStepStatus('analyzing')}
        />
        <ProgressStep
          label={t('generation.selecting')}
          status={getStepStatus('selecting')}
        />
        <ProgressStep
          label={t('generation.structuring')}
          status={getStepStatus('structuring')}
        />
        <ProgressStep
          label={t('generation.calculating')}
          status={getStepStatus('calculating')}
        />
        <ProgressStep
          label={t('generation.savingProgram')}
          status={getStepStatus('saving')}
        />
      </div>
    </div>
  );
};

interface ProgressStepProps {
  label: string;
  status: 'pending' | 'in-progress' | 'completed';
}

const ProgressStep: React.FC<ProgressStepProps> = ({ label, status }) => {
  return (
    <div className="flex items-center gap-3">
      {status === 'completed' && (
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
      {status === 'in-progress' && (
        <div className="w-5 h-5 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
      )}
      {status === 'pending' && (
        <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
      )}
      <span
        className={`text-sm ${
          status === 'completed'
            ? 'text-green-600'
            : status === 'in-progress'
            ? 'text-primary-600 font-medium'
            : 'text-gray-400'
        }`}
      >
        {label}
      </span>
    </div>
  );
};
