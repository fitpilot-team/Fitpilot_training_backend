import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../store/aiStore';
import { StepProgress } from './StepProgress';
import { ProfileStep } from './steps/ProfileStep';
import { GoalsStep } from './steps/GoalsStep';
import { AvailabilityStep } from './steps/AvailabilityStep';
import { EquipmentStep } from './steps/EquipmentStep';
import { RestrictionsStep } from './steps/RestrictionsStep';
import { PreferencesStep } from './steps/PreferencesStep';

const STEP_IDS = ['profile', 'goals', 'availability', 'equipment', 'restrictions', 'preferences'];

interface QuestionnaireWizardProps {
  onComplete: () => void;
}

export const QuestionnaireWizard: React.FC<QuestionnaireWizardProps> = ({
  onComplete,
}) => {
  const { t } = useTranslation('ai');
  const { currentStep, nextStep, prevStep, goToStep, answers } = useAIStore();

  const steps = STEP_IDS.map((id) => ({
    id,
    title: t(`steps.${id}`),
  }));

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      nextStep();
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    prevStep();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <ProfileStep />;
      case 1:
        return <GoalsStep />;
      case 2:
        return <AvailabilityStep />;
      case 3:
        return <EquipmentStep />;
      case 4:
        return <RestrictionsStep />;
      case 5:
        return <PreferencesStep />;
      default:
        return null;
    }
  };

  const isStepValid = (): boolean => {
    switch (currentStep) {
      case 0: // Profile
        return !!answers.fitness_level;
      case 1: // Goals
        return !!answers.primary_goal;
      case 2: // Availability
        return (
          !!answers.days_per_week && !!answers.session_duration_minutes
        );
      case 3: // Equipment
        return (
          answers.has_gym_access !== undefined &&
          (answers.available_equipment?.length ?? 0) > 0
        );
      case 4: // Restrictions (optional)
        return true;
      case 5: // Preferences
        return !!answers.total_weeks && !!answers.start_date;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <StepProgress
        steps={steps}
        currentStep={currentStep}
        onStepClick={goToStep}
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {renderStep()}

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('wizard.previous')}
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!isStepValid()}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentStep === steps.length - 1 ? t('wizard.generateProgram') : t('wizard.next')}
          </button>
        </div>
      </div>
    </div>
  );
};
