import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../../store/aiStore';
import type { EquipmentType } from '../../../types/ai';

const EQUIPMENT_IDS: EquipmentType[] = [
  'barbell', 'dumbbells', 'cables', 'machines', 'kettlebells',
  'resistance_bands', 'pull_up_bar', 'bench', 'squat_rack', 'bodyweight'
];

export const EquipmentStep: React.FC = () => {
  const { t } = useTranslation('ai');
  const { answers, setAnswer } = useAIStore();

  const handleEquipmentToggle = (equipment: EquipmentType) => {
    const current = answers.available_equipment || [];
    if (current.includes(equipment)) {
      // Don't allow removing the last equipment
      if (current.length > 1) {
        setAnswer(
          'available_equipment',
          current.filter((e) => e !== equipment)
        );
      }
    } else {
      setAnswer('available_equipment', [...current, equipment]);
    }
  };

  const selectAllGymEquipment = () => {
    setAnswer('available_equipment', [
      'barbell',
      'dumbbells',
      'cables',
      'machines',
      'bench',
      'squat_rack',
      'pull_up_bar',
    ]);
  };

  const selectHomeEquipment = () => {
    setAnswer('available_equipment', ['dumbbells', 'resistance_bands', 'bodyweight']);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t('equipment.title')}
        </h2>
        <p className="text-gray-600">
          {t('equipment.subtitle')}
        </p>
      </div>

      {/* Gym Access */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {t('equipment.gymAccess')}
        </label>
        <div className="flex gap-4">
          <label
            className={`flex-1 flex items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors ${
              answers.has_gym_access === true
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="has_gym_access"
              checked={answers.has_gym_access === true}
              onChange={() => {
                setAnswer('has_gym_access', true);
                selectAllGymEquipment();
              }}
              className="sr-only"
            />
            <div className="text-center">
              <span className="text-3xl">🏋️</span>
              <p className="mt-2 font-medium">{t('equipment.hasGym')}</p>
            </div>
          </label>

          <label
            className={`flex-1 flex items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors ${
              answers.has_gym_access === false
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="has_gym_access"
              checked={answers.has_gym_access === false}
              onChange={() => {
                setAnswer('has_gym_access', false);
                selectHomeEquipment();
              }}
              className="sr-only"
            />
            <div className="text-center">
              <span className="text-3xl">🏠</span>
              <p className="mt-2 font-medium">{t('equipment.noGym')}</p>
            </div>
          </label>
        </div>
      </div>

      {/* Equipment Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {t('equipment.availableEquipment')}
        </label>
        <p className="text-sm text-gray-500 mb-3">
          {t('equipment.availableEquipmentHelp')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {EQUIPMENT_IDS.map((equipmentId) => (
            <label
              key={equipmentId}
              className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                answers.available_equipment?.includes(equipmentId)
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={answers.available_equipment?.includes(equipmentId) || false}
                onChange={() => handleEquipmentToggle(equipmentId)}
                className="mt-1 text-primary-600 focus:ring-primary-500 rounded"
              />
              <div className="ml-3">
                <span className="font-medium text-gray-900 text-sm">
                  {t(`equipment.options.${equipmentId}`)}
                </span>
                <p className="text-xs text-gray-500">{t(`equipment.options.${equipmentId}Desc`)}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Equipment Notes */}
      <div>
        <label
          htmlFor="equipment_notes"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t('equipment.notes')}
        </label>
        <textarea
          id="equipment_notes"
          rows={2}
          value={answers.equipment_notes || ''}
          onChange={(e) => setAnswer('equipment_notes', e.target.value)}
          placeholder={t('equipment.notesPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">
          {t('equipment.selectedCount', { count: answers.available_equipment?.length || 0 })}
        </h4>
        <div className="flex flex-wrap gap-2">
          {answers.available_equipment?.map((eq) => (
            <span
              key={eq}
              className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-sm"
            >
              {t(`equipment.options.${eq}`)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
