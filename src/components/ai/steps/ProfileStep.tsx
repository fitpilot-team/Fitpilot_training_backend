import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../../store/aiStore';
import type { FitnessLevel, Gender } from '../../../types/ai';

const FITNESS_LEVELS: FitnessLevel[] = ['beginner', 'intermediate', 'advanced'];
const GENDERS: Gender[] = ['male', 'female', 'other'];

export const ProfileStep: React.FC = () => {
  const { t } = useTranslation('ai');
  const { answers, setAnswer } = useAIStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t('profile.title')}
        </h2>
        <p className="text-gray-600">
          {t('profile.subtitle')}
        </p>
      </div>

      {/* Fitness Level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {t('profile.fitnessLevelRequired')}
        </label>
        <div className="space-y-3">
          {FITNESS_LEVELS.map((level) => (
            <label
              key={level}
              className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                answers.fitness_level === level
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="fitness_level"
                value={level}
                checked={answers.fitness_level === level}
                onChange={(e) =>
                  setAnswer('fitness_level', e.target.value as FitnessLevel)
                }
                className="mt-1 text-primary-600 focus:ring-primary-500"
              />
              <div className="ml-3">
                <span className="font-medium text-gray-900">{t(`fitnessLevels.${level}`)}</span>
                <p className="text-sm text-gray-500">{t(`fitnessLevels.${level}Desc`)}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Age */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="age"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t('profile.age')}
          </label>
          <input
            type="number"
            id="age"
            min={14}
            max={100}
            value={answers.age || ''}
            onChange={(e) =>
              setAnswer('age', e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder={t('profile.agePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div>
          <label
            htmlFor="gender"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t('profile.gender')}
          </label>
          <select
            id="gender"
            value={answers.gender || ''}
            onChange={(e) =>
              setAnswer('gender', e.target.value as Gender || undefined)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">{t('profile.genderSelect')}</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {t(`genders.${g}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Weight and Height */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="weight"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t('profile.weight')}
          </label>
          <input
            type="number"
            id="weight"
            min={30}
            max={300}
            value={answers.weight_kg || ''}
            onChange={(e) =>
              setAnswer(
                'weight_kg',
                e.target.value ? Number(e.target.value) : undefined
              )
            }
            placeholder={t('profile.weightPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div>
          <label
            htmlFor="height"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t('profile.height')}
          </label>
          <input
            type="number"
            id="height"
            min={100}
            max={250}
            value={answers.height_cm || ''}
            onChange={(e) =>
              setAnswer(
                'height_cm',
                e.target.value ? Number(e.target.value) : undefined
              )
            }
            placeholder={t('profile.heightPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Training Experience */}
      <div>
        <label
          htmlFor="experience"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t('profile.experience')}
        </label>
        <input
          type="number"
          id="experience"
          min={0}
          max={600}
          value={answers.training_experience_months || ''}
          onChange={(e) =>
            setAnswer(
              'training_experience_months',
              e.target.value ? Number(e.target.value) : undefined
            )
          }
          placeholder={t('profile.experiencePlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        />
        <p className="mt-1 text-sm text-gray-500">
          {t('profile.experienceHelp')}
        </p>
      </div>
    </div>
  );
};
