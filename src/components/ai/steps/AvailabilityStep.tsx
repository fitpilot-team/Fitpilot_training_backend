import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../../store/aiStore';

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const AvailabilityStep: React.FC = () => {
  const { t } = useTranslation('ai');
  const { answers, setAnswer } = useAIStore();

  const handleDayToggle = (day: number) => {
    const current = answers.preferred_days || [];
    if (current.includes(day)) {
      setAnswer(
        'preferred_days',
        current.filter((d) => d !== day)
      );
    } else {
      setAnswer('preferred_days', [...current, day].sort());
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t('availability.title')}
        </h2>
        <p className="text-gray-600">
          {t('availability.subtitle')}
        </p>
      </div>

      {/* Days per week */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {t('availability.daysPerWeek')}
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={7}
            value={answers.days_per_week || 4}
            onChange={(e) => setAnswer('days_per_week', Number(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <span className="w-12 text-center text-2xl font-bold text-primary-600">
            {answers.days_per_week || 4}
          </span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{t('availability.daysMin')}</span>
          <span>{t('availability.daysMax')}</span>
        </div>
      </div>

      {/* Session duration */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {t('availability.sessionDuration')}
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={20}
            max={120}
            step={5}
            value={answers.session_duration_minutes || 60}
            onChange={(e) =>
              setAnswer('session_duration_minutes', Number(e.target.value))
            }
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <span className="w-16 text-center text-2xl font-bold text-primary-600">
            {answers.session_duration_minutes || 60}
          </span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{t('availability.durationMin')}</span>
          <span>{t('availability.durationMax')}</span>
        </div>
      </div>

      {/* Preferred days */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {t('availability.preferredDays')}
        </label>
        <p className="text-sm text-gray-500 mb-3">
          {t('availability.preferredDaysHelp')}
        </p>
        <div className="flex gap-2">
          {DAY_KEYS.map((dayKey, index) => (
            <button
              key={dayKey}
              type="button"
              onClick={() => handleDayToggle(index + 1)}
              className={`w-12 h-12 rounded-full text-sm font-medium transition-colors ${
                answers.preferred_days?.includes(index + 1)
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={t(`days.${dayKey}`)}
            >
              {t(`days.${dayKey}Short`)}
            </button>
          ))}
        </div>
        {(answers.preferred_days?.length || 0) > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            {t('availability.daysSelected', { count: answers.preferred_days?.length })}
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">{t('availability.summary')}</h4>
        <p className="text-sm text-gray-600">
          {t('availability.summaryText', {
            days: answers.days_per_week || 4,
            duration: answers.session_duration_minutes || 60,
          }).replace(/<strong>/g, '').replace(/<\/strong>/g, '')}
        </p>
        {(answers.days_per_week || 4) >= 5 && (
          <p className="text-sm text-yellow-600 mt-2">
            {t('availability.highFrequencyWarning')}
          </p>
        )}
      </div>
    </div>
  );
};
