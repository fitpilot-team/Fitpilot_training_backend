import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useClientStore } from '../store/clientStore';
import {
  UserGroupIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  UserIcon,
  TrashIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { ClientCreate } from '../types/client';

export function ClientsPage() {
  const { t, i18n } = useTranslation(['clients', 'common']);
  const navigate = useNavigate();
  const {
    clients,
    isLoading,
    fetchClients,
    createClient,
    deleteClient,
  } = useClientStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClientCreate>({
    email: '',
    full_name: '',
    password: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const dateLocale = i18n.language === 'es' ? es : enUS;

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const filteredClients = clients.filter(
    (client) =>
      client.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      errors.full_name = t('clients:validation.nameRequired');
    }
    if (!formData.email.trim()) {
      errors.email = t('clients:validation.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = t('clients:validation.emailInvalid');
    }
    if (!formData.password) {
      errors.password = t('clients:validation.passwordRequired');
    } else if (formData.password.length < 6) {
      errors.password = t('clients:validation.passwordLength');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsCreating(true);
    try {
      await createClient(formData);
      toast.success(t('clients:messages.created'));
      setIsCreateModalOpen(false);
      setFormData({ email: '', full_name: '', password: '' });
      setFormErrors({});
    } catch (error: any) {
      toast.error(error.message || t('clients:messages.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(t('clients:confirmDelete', { name: clientName }))) {
      return;
    }

    setDeletingId(clientId);
    try {
      await deleteClient(clientId);
      toast.success(t('clients:messages.deleted'));
    } catch (error: any) {
      toast.error(error.message || t('clients:messages.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleClientClick = (clientId: string) => {
    navigate(`/clients/${clientId}`);
  };

  if (isLoading && clients.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('clients:title')}</h1>
            <p className="mt-2 text-gray-600">
              {t('clients:subtitle')}
            </p>
          </div>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            <PlusIcon className="h-5 w-5 mr-2" />
            {t('clients:newClient')}
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('clients:searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Clients Grid */}
        {filteredClients.length === 0 ? (
          <Card>
            <div className="text-center py-12 text-gray-500">
              <UserGroupIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {clients.length === 0 ? t('clients:noClients') : t('clients:noClientsFound')}
              </h3>
              <p className="max-w-md mx-auto mb-6">
                {clients.length === 0
                  ? t('clients:noClientsDescription')
                  : t('clients:adjustSearch')}
              </p>
              {clients.length === 0 && (
                <Button
                  variant="primary"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  {t('clients:addFirst')}
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <Card
                key={client.id}
                padding="none"
                className="transition-all duration-200 hover:shadow-lg hover:border-primary-300 cursor-pointer group"
              >
                <div
                  className="p-6"
                  onClick={() => handleClientClick(client.id)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary-100 text-primary-600 group-hover:bg-primary-200 transition-colors">
                        <UserIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                          {client.full_name}
                        </h3>
                        <p className="text-sm text-gray-500">{client.email}</p>
                      </div>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
                  </div>

                  {/* Info */}
                  <div className="space-y-1 mb-4 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">{t('clients:fields.status')}:</span>{' '}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          client.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {client.is_active ? t('common:status.active') : t('common:status.inactive')}
                      </span>
                    </p>
                    <p>
                      <span className="font-medium">{t('clients:joined')}:</span>{' '}
                      {format(new Date(client.created_at), 'PPP', { locale: dateLocale })}
                    </p>
                  </div>
                </div>

                {/* Actions - separate from clickable area */}
                <div className="px-6 pb-4 pt-0">
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <span className="text-xs text-gray-500">{t('clients:clickToOpen')}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClient(client.id, client.full_name);
                      }}
                      isLoading={deletingId === client.id}
                    >
                      <TrashIcon className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Client Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setFormData({ email: '', full_name: '', password: '' });
          setFormErrors({});
        }}
        title={t('clients:addNewClient')}
      >
        <form onSubmit={handleCreateClient} className="space-y-4">
          <Input
            label={t('clients:fields.fullName')}
            type="text"
            value={formData.full_name}
            onChange={(e) =>
              setFormData({ ...formData, full_name: e.target.value })
            }
            error={formErrors.full_name}
            placeholder={t('clients:placeholders.fullName')}
          />

          <Input
            label={t('clients:fields.email')}
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            error={formErrors.email}
            placeholder={t('clients:placeholders.email')}
          />

          <Input
            label={t('clients:fields.password')}
            type="password"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            error={formErrors.password}
            placeholder={t('clients:placeholders.password')}
            helperText={t('clients:helperText.password')}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setFormData({ email: '', full_name: '', password: '' });
                setFormErrors({});
              }}
            >
              {t('common:buttons.cancel')}
            </Button>
            <Button type="submit" variant="primary" isLoading={isCreating}>
              {t('clients:createClient')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
