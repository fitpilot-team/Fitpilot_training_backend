import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../../store/aiStore';
import type { PrimaryGoal, MuscleGroupPreference } from '../../../types/ai';

const GOAL_IDS: PrimaryGoal[] = ['hypertrophy', 'strength', 'power', 'endurance', 'fat_loss', 'general_fitness'];
const GOAL_ICONS: Record<PrimaryGoal, string> = {
  hypertrophy: '💪',
  strength: '🏋️',
  power: '⚡',
  endurance: '🔄',
  fat_loss: '🔥',
  general_fitness: '❤️',
};
const MUSCLE_GROUPS: MuscleGroupPreference[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];

export const GoalsStep: React.FC = () => {
  const { t } = useTranslation('ai');
  const { answers, setAnswer } = useAIStore();

  const handleMuscleGroupToggle = (group: MuscleGroupPreference) => {
    const current = answers.target_muscle_groups || [];
    if (current.includes(group)) {
      setAnswer(
        'target_muscle_groups',
        current.filter((g) => g !== group)
      );
    } else {
      setAnswer('target_muscle_groups', [...current, group]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t('goals.title')}
        </h2>
        <p className="text-gray-600">
          {t('goals.subtitle')}
        </p>
      </div>

      {/* Primary Goal */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {t('goals.primary')}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {GOAL_IDS.map((goalId) => (
            <label
              key={goalId}
              className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                answers.primary_goal === goalId
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="primary_goal"
                value={goalId}
                checked={answers.primary_goal === goalId}
                onChange={(e) =>
                  setAnswer('primary_goal', e.target.value as PrimaryGoal)
                }
                className="sr-only"
              />
              <div>
                <span className="text-2xl mr-2">{GOAL_ICONS[goalId]}</span>
                <span className="font-medium text-gray-900">{t(`goals.options.${goalId}`)}</span>
                <p className="text-sm text-gray-500 mt-1">{t(`goals.options.${goalId}Desc`)}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Target Muscle Groups */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {t('goals.muscleGroupsLabel')}
        </label>
        <p className="text-sm text-gray-500 mb-3">
          {t('goals.muscleGroupsHelp')}
        </p>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => handleMuscleGroupToggle(group)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                answers.target_muscle_groups?.includes(group)
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t(`muscleGroups.${group}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Specific Goals */}
      <div>
        <label
          htmlFor="specific_goals"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t('goals.specificGoals')}
        </label>
        <textarea
          id="specific_goals"
          rows={3}
          value={answers.specific_goals || ''}
          onChange={(e) => setAnswer('specific_goals', e.target.value)}
          placeholder={t('goals.specificGoalsPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        />
        <p className="mt-1 text-sm text-gray-500">
          {t('goals.specificGoalsHelp')}
        </p>
      </div>
    </div>
  );
};
