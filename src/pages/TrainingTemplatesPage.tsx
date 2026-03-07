import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useMesocycleStore } from '../store/mesocycleStore';
import {
  CalendarDaysIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import toast from 'react-hot-toast';

export function TrainingTemplatesPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(['training', 'common']);
  const {
    macrocycles = [],
    isLoadingMacrocycles,
    loadMacrocycles,
    deleteMacrocycle,
  } = useMesocycleStore();

  const programs = Array.isArray(macrocycles) ? macrocycles : [];

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const dateLocale = i18n.language === 'es' ? es : enUS;

  useEffect(() => {
    loadMacrocycles();
  }, [loadMacrocycles]);

  const handleDelete = async (id: string, _name: string) => {
    if (!confirm(t('common:confirmation.deleteMessage'))) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteMacrocycle(id);
      toast.success(t('training:messages.programUpdated'));
    } catch (error: any) {
      toast.error(error.message || t('errors:training.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

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

  if (isLoadingMacrocycles) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('training:templates.title')}</h1>
            <p className="mt-2 text-gray-600">
              {t('training:templates.subtitle')}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate('/training/programs/new')}
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            {t('training:templates.new')}
          </Button>
        </div>

        {/* Programs Grid */}
        {programs.length === 0 ? (
          <Card>
            <div className="text-center py-12 text-gray-500">
              <CalendarDaysIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('training:templates.noTemplates')}
              </h3>
              <p className="max-w-md mx-auto mb-6">
                {t('training:templates.description')}
              </p>
              <Button
                variant="primary"
                onClick={() => navigate('/training/programs/new')}
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                {t('training:templates.createFirst')}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map((macrocycle) => (
              <Card key={macrocycle.id} padding="none">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {macrocycle.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            macrocycle.status
                          )}`}
                        >
                          {t(`common:status.${macrocycle.status}`)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {t(`training:objectives.${macrocycle.objective}`, macrocycle.objective)}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            macrocycle.client_id ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {macrocycle.client_id ? 'Asignado' : 'Plantilla'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {macrocycle.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {macrocycle.description}
                    </p>
                  )}

                  {/* Dates */}
                  <div className="space-y-1 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="font-medium mr-2">{t('training:macrocycle.startDate')}:</span>
                      {format(new Date(macrocycle.start_date), 'PPP', { locale: dateLocale })}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="font-medium mr-2">{t('training:macrocycle.endDate')}:</span>
                      {format(new Date(macrocycle.end_date), 'PPP', { locale: dateLocale })}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <span>{macrocycle.mesocycles?.length || 0} {t('training:mesocycle.titlePlural').toLowerCase()}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/training/programs/${macrocycle.id}`)}
                      className="flex-1"
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      {t('common:buttons.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(macrocycle.id, macrocycle.name)}
                      isLoading={deletingId === macrocycle.id}
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
  );
}
