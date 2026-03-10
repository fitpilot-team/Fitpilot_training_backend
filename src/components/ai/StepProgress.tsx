import React from 'react';
import { CheckIcon } from '@heroicons/react/24/solid';

interface Step {
  id: string;
  title: string;
}

interface StepProgressProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (index: number) => void;
}

export const StepProgress: React.FC<StepProgressProps> = ({
  steps,
  currentStep,
  onStepClick,
}) => {
  return (
    <nav aria-label="Progreso" className="mb-8">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = onStepClick && index <= currentStep;

          return (
            <li key={step.id} className="relative flex-1">
              {/* Connector line */}
              {index !== steps.length - 1 && (
                <div
                  className={`absolute top-5 left-1/2 w-full h-0.5 ${
                    isCompleted ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                  aria-hidden="true"
                />
              )}

              {/* Step indicator */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                className={`relative flex flex-col items-center group ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    isCompleted
                      ? 'bg-primary-600 border-primary-600'
                      : isCurrent
                      ? 'bg-white border-primary-600'
                      : 'bg-white border-gray-300'
                  } ${isClickable && !isCurrent ? 'group-hover:border-primary-400' : ''}`}
                >
                  {isCompleted ? (
                    <CheckIcon className="w-5 h-5 text-white" />
                  ) : (
                    <span
                      className={`text-sm font-medium ${
                        isCurrent ? 'text-primary-600' : 'text-gray-500'
                      }`}
                    >
                      {index + 1}
                    </span>
                  )}
                </span>

                <span
                  className={`mt-2 text-xs font-medium text-center max-w-[80px] ${
                    isCurrent ? 'text-primary-600' : 'text-gray-500'
                  }`}
                >
                  {step.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
