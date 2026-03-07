import React from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentDuplicateIcon, UserIcon } from '@heroicons/react/24/outline';
import type { CreationMode } from '../../types/ai';

interface ModeSelectorProps {
  selectedMode: CreationMode | null;
  onModeSelect: (mode: CreationMode) => void;
  disabled?: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedMode,
  onModeSelect,
  disabled = false,
}) => {
  const { t } = useTranslation('ai');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {t('modeSelector.title')}
        </h2>
        <p className="text-gray-600 text-sm">
          {t('modeSelector.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Template Mode */}
        <button
          type="button"
          onClick={() => onModeSelect('template')}
          disabled={disabled}
          className={`relative p-6 rounded-xl border-2 text-left transition-all ${
            selectedMode === 'template'
              ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-lg ${
                selectedMode === 'template'
                  ? 'bg-primary-100 text-primary-600'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <DocumentDuplicateIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                {t('modeSelector.template.title')}
              </h3>
              <p className="text-sm text-gray-600">
                {t('modeSelector.template.description')}
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-gray-500">
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  {t('modeSelector.template.feature1')}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  {t('modeSelector.template.feature2')}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  {t('modeSelector.template.feature3')}
                </li>
              </ul>
            </div>
          </div>
          {selectedMode === 'template' && (
            <div className="absolute top-3 right-3">
              <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          )}
        </button>

        {/* Client Mode */}
        <button
          type="button"
          onClick={() => onModeSelect('client')}
          disabled={disabled}
          className={`relative p-6 rounded-xl border-2 text-left transition-all ${
            selectedMode === 'client'
              ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-lg ${
                selectedMode === 'client'
                  ? 'bg-primary-100 text-primary-600'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <UserIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                {t('modeSelector.client.title')}
              </h3>
              <p className="text-sm text-gray-600">
                {t('modeSelector.client.description')}
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-gray-500">
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  {t('modeSelector.client.feature1')}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  {t('modeSelector.client.feature2')}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  {t('modeSelector.client.feature3')}
                </li>
              </ul>
            </div>
          </div>
          {selectedMode === 'client' && (
            <div className="absolute top-3 right-3">
              <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};

export default ModeSelector;
