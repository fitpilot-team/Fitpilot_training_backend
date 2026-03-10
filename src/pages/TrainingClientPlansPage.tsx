import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon, SparklesIcon, UserIcon } from '@heroicons/react/24/outline';
import { useMesocycleStore } from '../store/mesocycleStore';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { useProfessionalClients } from '@/features/professional-clients/queries';
import type { IProfessionalClient } from '@/features/professional-clients/types';
import type { Macrocycle } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';

type ClientGroup = {
  client: IProfessionalClient | null;
  clientId: string;
  programs: Macrocycle[];
  latestProgram: Macrocycle;
};

const normalizeClientId = (value: unknown): string => String(value ?? '').trim();

const getProgramSortScore = (program: Macrocycle): number => {
  const created = Date.parse(program.created_at || '');
  if (!Number.isNaN(created)) return created;
  const updated = Date.parse(program.updated_at || '');
  if (!Number.isNaN(updated)) return updated;
  const numericId = Number(program.id);
  return Number.isFinite(numericId) ? numericId : 0;
};

const resolveClientName = (client: IProfessionalClient | null, fallbackId: string, t: (key: string, opts?: any) => string) => {
  if (!client) {
    return t('training:clientPlans.unknownClient', { clientId: fallbackId });
  }

  const fullName = [client.name, client.lastname].filter(Boolean).join(' ').trim();
  return fullName || client.email || t('training:clientPlans.unknownClient', { clientId: fallbackId });
};

export function TrainingClientPlansPage() {
  const { t } = useTranslation(['training']);
  const navigate = useNavigate();
  const { professional, userData } = useProfessional();
  const professionalId = professional?.sub || userData?.id || '';
  const { data: clients = [] } = useProfessionalClients(professionalId);
  const { macrocycles, isLoadingMacrocycles, loadMacrocycles } = useMesocycleStore();

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  useEffect(() => {
    loadMacrocycles();
  }, [loadMacrocycles]);

  const groupedClients = useMemo<ClientGroup[]>(() => {
    const programsByClient = new Map<string, Macrocycle[]>();

    for (const program of macrocycles) {
      const clientId = normalizeClientId(program.client_id);
      if (!clientId) {
        continue;
      }

      const existing = programsByClient.get(clientId) || [];
      existing.push(program);
      programsByClient.set(clientId, existing);
    }

    return Array.from(programsByClient.entries())
      .map(([clientId, programs]) => {
        const sortedPrograms = [...programs].sort((a, b) => getProgramSortScore(b) - getProgramSortScore(a));
        const latestProgram = sortedPrograms[0];
        const client = clients.find((item) => normalizeClientId(item.id) === clientId) || null;

        if (!latestProgram) {
          return null;
        }

        return {
          client,
          clientId,
          programs: sortedPrograms,
          latestProgram,
        };
      })
      .filter((group): group is ClientGroup => group !== null)
      .sort((a, b) => getProgramSortScore(b.latestProgram) - getProgramSortScore(a.latestProgram));
  }, [macrocycles, clients]);

  const filteredGroups = useMemo(() => {
    if (!selectedClientId) {
      return groupedClients;
    }
    return groupedClients.filter((group) => group.clientId === selectedClientId);
  }, [groupedClients, selectedClientId]);

  const selectableClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    const options = groupedClients.map((group) => ({
      id: group.clientId,
      name: resolveClientName(group.client, group.clientId, t),
    }));

    if (!query) {
      return options;
    }

    return options.filter((option) => option.name.toLowerCase().includes(query));
  }, [groupedClients, clientSearch, t]);

  if (isLoadingMacrocycles) {
    return (
      <Card>
        <div className="flex min-h-[16rem] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('training:clientPlans.title')}</h1>
          <p className="mt-1 text-gray-600">{t('training:clientPlans.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setIsClientModalOpen(true)}>
            <MagnifyingGlassIcon className="mr-2 h-5 w-5" />
            {selectedClientId
              ? resolveClientName(
                groupedClients.find((item) => item.clientId === selectedClientId)?.client || null,
                selectedClientId,
                t,
              )
              : t('training:clientPlans.filters.searchClient')}
          </Button>
          {selectedClientId ? (
            <Button
              variant="ghost"
              onClick={() => setSelectedClientId(null)}
              className="text-gray-600"
            >
              Limpiar
            </Button>
          ) : null}
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <Card>
          <div className="py-16 text-center">
            <SparklesIcon className="mx-auto h-12 w-12 text-blue-300" />
            <h3 className="mt-4 text-xl font-semibold text-gray-900">{t('training:clientPlans.empty.title')}</h3>
            <p className="mx-auto mt-2 max-w-lg text-gray-600">{t('training:clientPlans.empty.description')}</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredGroups.map((group) => (
            <Card key={group.clientId}>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <UserIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-gray-900">
                        {resolveClientName(group.client, group.clientId, t)}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {t('training:clientPlans.programCount', { count: group.programs.length })}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                    {group.latestProgram.status}
                  </span>
                </div>

                <div className="space-y-1 text-sm text-gray-700">
                  {group.programs.slice(0, 2).map((program) => (
                    <div key={program.id} className="truncate">
                      • {program.name}
                    </div>
                  ))}
                  {group.programs.length > 2 ? (
                    <div className="text-gray-500">
                      {t('training:clientPlans.morePrograms', { count: group.programs.length - 2 })}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <p className="truncate pr-4 text-xs text-gray-500">
                    {group.latestProgram.objective}
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => navigate(`/training/programs/${group.latestProgram.id}`)}
                  >
                    {t('training:clientPlans.actions.openLatestProgram')}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        title={t('training:clientPlans.filters.searchClient')}
        size="lg"
      >
        <div className="space-y-4">
          <input
            type="text"
            value={clientSearch}
            onChange={(event) => setClientSearch(event.target.value)}
            placeholder={t('training:clientPlans.filters.searchClient')}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {selectableClients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => {
                  setSelectedClientId(client.id);
                  setIsClientModalOpen(false);
                }}
                className="w-full rounded-lg border border-gray-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
              >
                <p className="font-medium text-gray-900">{client.name}</p>
              </button>
            ))}
            {selectableClients.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">{t('training:clientPlans.empty.description')}</p>
            ) : null}
          </div>
        </div>
      </Modal>
    </div>
  );
}

