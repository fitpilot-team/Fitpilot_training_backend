import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import type { Client } from '../../types/client';
import type { InterviewValidationResponse } from '../../types/ai';
import { clientsApi } from '../../services/clients';
import { aiService } from '../../services/ai';

interface ClientSelectorProps {
  selectedClientId: string | null;
  onClientSelect: (clientId: string, clientName: string) => void;
  onValidationComplete: (validation: InterviewValidationResponse) => void;
}

export const ClientSelector: React.FC<ClientSelectorProps> = ({
  selectedClientId,
  onClientSelect,
  onValidationComplete,
}) => {
  const { t } = useTranslation('ai');
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<InterviewValidationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load clients on mount
  useEffect(() => {
    const loadClients = async () => {
      try {
        const response = await clientsApi.getClients();
        setClients(response.clients);
      } catch (err: any) {
        setError(err.message || 'Error cargando clientes');
      } finally {
        setIsLoadingClients(false);
      }
    };
    loadClients();
  }, []);

  // Validate interview when client is selected
  useEffect(() => {
    if (!selectedClientId) {
      setValidation(null);
      return;
    }

    const validateInterview = async () => {
      setIsValidating(true);
      setError(null);
      try {
        const result = await aiService.validateClientInterview(selectedClientId);
        setValidation(result);
        onValidationComplete(result);
      } catch (err: any) {
        setError(err.message || 'Error validando entrevista');
      } finally {
        setIsValidating(false);
      }
    };

    validateInterview();
  }, [selectedClientId, onValidationComplete]);

  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clientId = e.target.value;
    if (clientId) {
      const client = clients.find((c) => c.id === clientId);
      if (client) {
        onClientSelect(clientId, client.full_name);
      }
    }
  };

  const handleGoToInterview = () => {
    if (selectedClientId) {
      navigate(`/nutrition/clients/${selectedClientId}/medical-history`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Client Dropdown */}
      <div>
        <label
          htmlFor="client_select"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {t('clientSelector.label')}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <UserIcon className="h-5 w-5 text-gray-400" />
          </div>
          <select
            id="client_select"
            value={selectedClientId || ''}
            onChange={handleClientChange}
            disabled={isLoadingClients}
            className="block w-full pl-10 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-lg"
          >
            <option value="">{t('clientSelector.placeholder')}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>
          {isLoadingClients && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Validation Status */}
      {selectedClientId && (
        <div className="rounded-lg border p-4">
          {isValidating ? (
            <div className="flex items-center gap-3 text-gray-600">
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
              <span>{t('clientSelector.validating')}</span>
            </div>
          ) : validation ? (
            validation.is_complete ? (
              <div className="flex items-start gap-3 text-green-700 bg-green-50 rounded-lg p-4">
                <CheckCircleIcon className="h-6 w-6 flex-shrink-0" />
                <div>
                  <p className="font-medium">{t('clientSelector.interviewComplete')}</p>
                  <p className="text-sm text-green-600 mt-1">
                    {t('clientSelector.readyToGenerate')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="flex items-start gap-3 text-yellow-700">
                  <ExclamationTriangleIcon className="h-6 w-6 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">
                      {validation.has_interview
                        ? t('clientSelector.interviewIncomplete')
                        : t('clientSelector.noInterview')}
                    </p>
                    {validation.missing_fields.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-yellow-600 mb-2">
                          {t('clientSelector.missingFields')}:
                        </p>
                        <ul className="text-sm text-yellow-600 space-y-1">
                          {validation.missing_fields.map((field, index) => (
                            <li key={index} className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                              {field}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleGoToInterview}
                      className="mt-3 inline-flex items-center px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors"
                    >
                      {t('clientSelector.completeInterview')}
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : error ? (
            <div className="flex items-start gap-3 text-red-700 bg-red-50 rounded-lg p-4">
              <ExclamationTriangleIcon className="h-6 w-6 flex-shrink-0" />
              <div>
                <p className="font-medium">{t('clientSelector.error')}</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ClientSelector;
