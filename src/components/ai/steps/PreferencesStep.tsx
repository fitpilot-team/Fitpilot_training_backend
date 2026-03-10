import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../../store/aiStore';
import type { ExerciseVariety } from '../../../types/ai';

const VARIETY_OPTIONS: ExerciseVariety[] = ['low', 'medium', 'high'];
const TRAINING_STYLE_IDS = ['auto', 'push_pull_legs', 'upper_lower', 'full_body', 'bro_split'];

export const PreferencesStep: React.FC = () => {
  const { t } = useTranslation('ai');
  const { answers, setAnswer } = useAIStore();

  // Get today's date formatted for the date input
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t('preferences.title')}
        </h2>
        <p className="text-gray-600">
          {t('preferences.subtitle')}
        </p>
      </div>

      {/* Exercise Variety */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {t('preferences.exerciseVariety')}
        </label>
        <div className="space-y-2">
          {VARIETY_OPTIONS.map((varietyId) => (
            <label
              key={varietyId}
              className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                answers.exercise_variety === varietyId
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="exercise_variety"
                value={varietyId}
                checked={answers.exercise_variety === varietyId}
                onChange={(e) =>
                  setAnswer('exercise_variety', e.target.value as ExerciseVariety)
                }
                className="mt-1 text-primary-600 focus:ring-primary-500"
              />
              <div className="ml-3">
                <span className="font-medium text-gray-900">{t(`preferences.variety.${varietyId}`)}</span>
                <p className="text-sm text-gray-500">{t(`preferences.variety.${varietyId}Desc`)}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Training Style */}
      <div>
        <label
          htmlFor="training_style"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t('preferences.trainingStyle')}
        </label>
        <select
          id="training_style"
          value={answers.preferred_training_style || ''}
          onChange={(e) => setAnswer('preferred_training_style', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        >
          {TRAINING_STYLE_IDS.map((styleId) => (
            <option key={styleId} value={styleId === 'auto' ? '' : styleId}>
              {t(`preferences.trainingStyles.${styleId}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Additional Options */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {t('preferences.additionalOptions')}
        </label>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={answers.include_warmup ?? true}
              onChange={(e) => setAnswer('include_warmup', e.target.checked)}
              className="text-primary-600 focus:ring-primary-500 rounded"
            />
            <span className="text-gray-700">{t('preferences.includeWarmup')}</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={answers.include_cardio ?? false}
              onChange={(e) => setAnswer('include_cardio', e.target.checked)}
              className="text-primary-600 focus:ring-primary-500 rounded"
            />
            <span className="text-gray-700">{t('preferences.includeCardio')}</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={answers.include_deload ?? true}
              onChange={(e) => setAnswer('include_deload', e.target.checked)}
              className="text-primary-600 focus:ring-primary-500 rounded"
            />
            <span className="text-gray-700">{t('preferences.includeDeload')}</span>
          </label>
        </div>
      </div>

      {/* Program Duration */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {t('preferences.programDuration')}
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Total Weeks */}
          <div>
            <label
              htmlFor="total_weeks"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('preferences.totalWeeks')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={16}
                value={answers.total_weeks || 8}
                onChange={(e) => setAnswer('total_weeks', Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <span className="w-10 text-center font-bold text-primary-600">
                {answers.total_weeks || 8}
              </span>
            </div>
          </div>

          {/* Mesocycle Weeks */}
          <div>
            <label
              htmlFor="mesocycle_weeks"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('preferences.mesocycleWeeks')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={6}
                value={answers.mesocycle_weeks || 4}
                onChange={(e) => setAnswer('mesocycle_weeks', Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <span className="w-10 text-center font-bold text-primary-600">
                {answers.mesocycle_weeks || 4}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Start Date */}
      <div>
        <label
          htmlFor="start_date"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t('preferences.startDate')}
        </label>
        <input
          type="date"
          id="start_date"
          min={today}
          value={answers.start_date || today}
          onChange={(e) => setAnswer('start_date', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Final Summary */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <h4 className="font-medium text-primary-900 mb-2">
          {t('preferences.programSummary')}
        </h4>
        <ul className="text-sm text-primary-700 space-y-1">
          <li>
            {t('preferences.durationSummary', {
              weeks: answers.total_weeks || 8,
              blocks: Math.ceil((answers.total_weeks || 8) / (answers.mesocycle_weeks || 4)),
            }).replace(/<strong>/g, '').replace(/<\/strong>/g, '')}
          </li>
          <li>
            {t('preferences.startSummary', {
              date: new Date(answers.start_date || today).toLocaleDateString(
                t('common:locale') === 'en' ? 'en-US' : 'es-ES',
                {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }
              ),
            }).replace(/<strong>/g, '').replace(/<\/strong>/g, '')}
          </li>
          <li>
            {answers.include_deload
              ? t('preferences.deloadIncluded')
              : t('preferences.deloadNotIncluded')}
          </li>
        </ul>
      </div>
    </div>
  );
};
