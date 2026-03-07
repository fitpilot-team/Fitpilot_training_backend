import { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import type { Client } from '../../types/client';
import type { Macrocycle } from '../../types';
import { useMesocycleStore } from '../../store/mesocycleStore';
import {
  PlusIcon,
  CalendarDaysIcon,
  PencilIcon,
  SparklesIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface ClientContext {
  client: Client;
}

export function ClientProgramsPage() {
  const { client } = useOutletContext<ClientContext>();
  const navigate = useNavigate();
  const { macrocycles, isLoadingMacrocycles, loadMacrocycles } = useMesocycleStore();
  const [clientPrograms, setClientPrograms] = useState<Macrocycle[]>([]);
  const [templates, setTemplates] = useState<Macrocycle[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  useEffect(() => {
    loadMacrocycles();
  }, [loadMacrocycles]);

  useEffect(() => {
    // Filter macrocycles for this client
    const filtered = macrocycles.filter((m) => m.client_id === client.id);
    setClientPrograms(filtered);
    // Filter templates (macrocycles without client_id)
    const templatesList = macrocycles.filter((m) => m.client_id === null);
    setTemplates(templatesList);
  }, [macrocycles, client.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'archived':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateProgram = () => {
    // Navigate to create new program - client is already selected in store
    navigate(`/clients/${client.id}/programs/new`);
  };

  if (isLoadingMacrocycles) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Programs</h1>
          <p className="mt-1 text-gray-600">
            Manage training programs for {client.full_name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate(`/ai-generator?client_id=${client.id}`)}>
            <SparklesIcon className="h-5 w-5 mr-2" />
            AI Generator
          </Button>
          <Button variant="secondary" onClick={() => setShowTemplateModal(true)}>
            <DocumentDuplicateIcon className="h-5 w-5 mr-2" />
            Load Template
          </Button>
          <Button variant="primary" onClick={handleCreateProgram}>
            <PlusIcon className="h-5 w-5 mr-2" />
            New Program
          </Button>
        </div>
      </div>

      {/* Programs List */}
      {clientPrograms.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <CalendarDaysIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Training Programs Yet
            </h3>
            <p className="max-w-md mx-auto mb-6">
              Create a personalized training program for {client.full_name} to get started.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button variant="secondary" onClick={() => navigate(`/ai-generator?client_id=${client.id}`)}>
                <SparklesIcon className="h-5 w-5 mr-2" />
                AI Generator
              </Button>
              <Button variant="secondary" onClick={() => setShowTemplateModal(true)}>
                <DocumentDuplicateIcon className="h-5 w-5 mr-2" />
                Load Template
              </Button>
              <Button variant="primary" onClick={handleCreateProgram}>
                <PlusIcon className="h-5 w-5 mr-2" />
                Create First Program
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {clientPrograms.map((program) => (
            <Card key={program.id} padding="none">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {program.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          program.status
                        )}`}
                      >
                        {program.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {program.objective}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {program.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {program.description}
                  </p>
                )}

                {/* Dates */}
                <div className="space-y-1 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="font-medium mr-2">Start:</span>
                    {format(new Date(program.start_date), 'MMM d, yyyy')}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="font-medium mr-2">End:</span>
                    {format(new Date(program.end_date), 'MMM d, yyyy')}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span>{program.mesocycles?.length || 0} mesocycles</span>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-gray-200">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/clients/${client.id}/programs/${program.id}`)}
                    className="w-full"
                  >
                    <PencilIcon className="h-4 w-4 mr-2" />
                    Edit Program
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Template Selection Modal */}
      <Modal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title="Load Template"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a template to create a new program for {client.full_name}
          </p>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <DocumentDuplicateIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No templates available</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowTemplateModal(false);
                  navigate('/templates');
                }}
                className="mt-4"
              >
                Create a Template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    // TODO: Implement clone template to client program
                    // For now, navigate to template editor
                    setShowTemplateModal(false);
                    navigate(`/templates/${template.id}?clientId=${client.id}`);
                  }}
                  className="flex items-start p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">{template.objective}</p>
                    {template.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>{template.mesocycles?.length || 0} mesocycles</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
