import { useTranslation } from 'react-i18next';
import { Card } from '../components/common/Card';
import { useAuthStore } from '@/store/newAuthStore';
import {
  BeakerIcon,
  CalendarDaysIcon,
  UsersIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

type StatKey = 'totalExercises' | 'activeMesocycles' | 'clients' | 'completionRate';

export function DashboardPage() {
  const { t } = useTranslation('common');
  // const { user } = useAuthStore();

  const stats: { key: StatKey; value: string; icon: typeof BeakerIcon; color: string }[] = [
    {
      key: 'totalExercises',
      value: '32',
      icon: BeakerIcon,
      color: 'bg-blue-500',
    },
    {
      key: 'activeMesocycles',
      value: '2',
      icon: CalendarDaysIcon,
      color: 'bg-green-500',
    },
    // {
    //   key: 'clients',
    //   value: user?.role === 'trainer' ? '5' : '-',
    //   icon: UsersIcon,
    //   color: 'bg-purple-500',
    // },
    {
      key: 'completionRate',
      value: '87%',
      icon: ChartBarIcon,
      color: 'bg-yellow-500',
    },
  ];

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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.key} padding="md">
                <div className="flex items-center">
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{t(`dashboard.stats.${stat.key}`)}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Card>
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('dashboard.quickActions')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center">
              <BeakerIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="font-medium text-gray-700">{t('dashboard.browseExercises')}</p>
            </button>
            <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center">
              <CalendarDaysIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="font-medium text-gray-700">{t('dashboard.createMesocycle')}</p>
            </button>
            {/* {user?.role === 'trainer' && (
              <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center">
                <UsersIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="font-medium text-gray-700">{t('dashboard.manageClients')}</p>
              </button>
            )} */}
          </div>
        </Card>

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
