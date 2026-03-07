import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAIStore } from '../../store/aiStore';
import { Button } from '../common/Button';
import {
  PencilSquareIcon,
  SparklesIcon,
  UserIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import type { ExerciseVariety } from '../../types/ai';

const VARIETY_OPTIONS: ExerciseVariety[] = ['low', 'medium', 'high'];

interface QuickConfigPanelProps {
  onGenerate: () => void;
  isGenerating?: boolean;
}

export const QuickConfigPanel: React.FC<QuickConfigPanelProps> = ({
  onGenerate,
  isGenerating = false,
}) => {
  const { t } = useTranslation('ai');
  const navigate = useNavigate();
  const { answers, setAnswer, selectedClientId, selectedClientName } = useAIStore();

  const today = new Date().toISOString().split('T')[0];

  const handleEditClientData = () => {
    if (selectedClientId) {
      navigate(`/nutrition/clients/${selectedClientId}/medical-history`);
    }
  };

  const totalWeeks = answers.total_weeks || 8;
  const mesocycleWeeks = answers.mesocycle_weeks || 4;
  const numBlocks = Math.ceil(totalWeeks / mesocycleWeeks);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t('quickConfig.title')}
        </h2>
        <p className="text-gray-600">
          {t('quickConfig.subtitle', { name: selectedClientName || 'Cliente' })}
        </p>
      </div>

      {/* Client Summary Card */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-gray-500" />
            <h3 className="font-medium text-gray-900">
              {t('quickConfig.clientSummary')}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEditClientData}
          >
            <PencilSquareIcon className="h-4 w-4 mr-1" />
            {t('quickConfig.editClientData')}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Level */}
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              {t('quickConfig.level')}
            </span>
            <p className="font-medium text-gray-900 capitalize">
              {answers.fitness_level
                ? t(`fitnessLevels.${answers.fitness_level}`)
                : '-'}
            </p>
          </div>

          {/* Goal */}
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              {t('quickConfig.goal')}
            </span>
            <p className="font-medium text-gray-900">
              {answers.primary_goal
                ? t(`goals.options.${answers.primary_goal}`)
                : '-'}
            </p>
          </div>

          {/* Days per week */}
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              {t('quickConfig.daysPerWeek')}
            </span>
            <p className="font-medium text-gray-900">
              {answers.days_per_week || '-'}
            </p>
          </div>

          {/* Equipment */}
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              {t('quickConfig.equipment')}
            </span>
            <p className="font-medium text-gray-900">
              {answers.has_gym_access
                ? t('quickConfig.gymAccess')
                : t('quickConfig.homeTraining')}
            </p>
          </div>
        </div>
      </div>

      {/* Program Configuration */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDaysIcon className="h-5 w-5 text-primary-500" />
          <h3 className="font-medium text-gray-900">
            {t('quickConfig.programConfig')}
          </h3>
        </div>

        <div className="space-y-6">
          {/* Total Weeks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('preferences.totalWeeks')}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={16}
                value={totalWeeks}
                onChange={(e) => setAnswer('total_weeks', Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <span className="w-12 text-center font-bold text-primary-600 text-lg">
                {totalWeeks}
              </span>
            </div>
          </div>

          {/* Mesocycle Weeks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('preferences.mesocycleWeeks')}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={Math.min(6, totalWeeks)}
                value={Math.min(mesocycleWeeks, totalWeeks)}
                onChange={(e) => setAnswer('mesocycle_weeks', Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <span className="w-12 text-center font-bold text-primary-600 text-lg">
                {Math.min(mesocycleWeeks, totalWeeks)}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {t('quickConfig.mesocycleInfo', { blocks: numBlocks, weeks: mesocycleWeeks })}
            </p>
          </div>

          {/* Exercise Variety */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('preferences.exerciseVariety')}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {VARIETY_OPTIONS.map((varietyId) => (
                <label
                  key={varietyId}
                  className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors ${
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
                    className="sr-only"
                  />
                  <span className="font-medium text-gray-900">
                    {t(`preferences.variety.${varietyId}`)}
                  </span>
                  <span className="text-xs text-gray-500 text-center mt-1">
                    {t(`preferences.variety.${varietyId}Desc`)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('preferences.startDate')}
            </label>
            <input
              type="date"
              min={today}
              value={answers.start_date || today}
              onChange={(e) => setAnswer('start_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Include Deload */}
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

      {/* Generate Button */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={onGenerate}
        disabled={isGenerating}
      >
        <SparklesIcon className="h-5 w-5 mr-2" />
        {isGenerating ? t('generation.generating') : t('quickConfig.generateProgram')}
      </Button>
    </div>
  );
};
