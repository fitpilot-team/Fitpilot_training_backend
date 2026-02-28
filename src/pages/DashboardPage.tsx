import { useTranslation } from 'react-i18next';
import { Card } from '../components/common/Card';
import {
  ChartBarIcon,
} from '@heroicons/react/24/outline';

export function DashboardPage() {
  const { t } = useTranslation('common');

  return (
    <div className="space-y-6">
        <div>
          {/* <h1 className="text-3xl font-bold text-gray-900">
            {t('dashboard.welcome', { name: user?.full_name })}
          </h1> */}
          <p className="mt-2 text-gray-600">
            {t('dashboard.subtitle')}
          </p>
        </div>

        {/* Recent Activity Placeholder */}
        <Card>
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('dashboard.recentActivity')}</h2>
          <div className="text-center py-12 text-gray-500">
            <ChartBarIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>{t('dashboard.noActivity')}</p>
            <p className="text-sm">{t('dashboard.startCreating')}</p>
          </div>
        </Card>
    </div>
  );
}
