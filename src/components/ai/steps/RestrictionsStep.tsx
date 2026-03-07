import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../../store/aiStore';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export const RestrictionsStep: React.FC = () => {
  const { t } = useTranslation('ai');
  const { answers, setAnswer } = useAIStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t('restrictions.title')}
        </h2>
        <p className="text-gray-600">
          {t('restrictions.subtitle')}
        </p>
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-700">
            <p className="font-medium">{t('restrictions.important')}</p>
            <p>
              {t('restrictions.importantText')}
            </p>
          </div>
        </div>
      </div>

      {/* Injuries */}
      <div>
        <label
          htmlFor="injuries"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t('restrictions.injuries')}
        </label>
        <textarea
          id="injuries"
          rows={3}
          value={answers.injuries || ''}
          onChange={(e) => setAnswer('injuries', e.target.value)}
          placeholder={t('restrictions.injuriesPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        />
        <p className="mt-1 text-sm text-gray-500">
          {t('restrictions.injuriesHelp')}
        </p>
      </div>

      {/* Excluded Exercises */}
      <div>
        <label
          htmlFor="excluded_exercises"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t('restrictions.excludedExercises')}
        </label>
        <textarea
          id="excluded_exercises"
          rows={2}
          value={answers.excluded_exercises || ''}
          onChange={(e) => setAnswer('excluded_exercises', e.target.value)}
          placeholder={t('restrictions.excludedExercisesPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        />
        <p className="mt-1 text-sm text-gray-500">
          {t('restrictions.excludedExercisesHelp')}
        </p>
      </div>

      {/* Medical Conditions */}
      <div>
        <label
          htmlFor="medical_conditions"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t('restrictions.medical')}
        </label>
        <textarea
          id="medical_conditions"
          rows={2}
          value={answers.medical_conditions || ''}
          onChange={(e) => setAnswer('medical_conditions', e.target.value)}
          placeholder={t('restrictions.medicalPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Mobility Limitations */}
      <div>
        <label
          htmlFor="mobility_limitations"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t('restrictions.mobility')}
        </label>
        <textarea
          id="mobility_limitations"
          rows={2}
          value={answers.mobility_limitations || ''}
          onChange={(e) => setAnswer('mobility_limitations', e.target.value)}
          placeholder={t('restrictions.mobilityPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Summary */}
      {(answers.injuries ||
        answers.excluded_exercises ||
        answers.medical_conditions ||
        answers.mobility_limitations) && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">{t('restrictions.summary')}</h4>
          <p className="text-sm text-gray-600">
            {t('restrictions.summaryText')}
          </p>
        </div>
      )}
    </div>
  );
};
