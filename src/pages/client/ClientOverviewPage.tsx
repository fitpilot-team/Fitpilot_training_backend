import { useOutletContext, Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import type { Client } from '../../types/client';
import {
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CakeIcon,
  UserIcon,
  EnvelopeIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface ClientContext {
  client: Client;
}

export function ClientOverviewPage() {
  const { client } = useOutletContext<ClientContext>();

  const quickLinks = [
    {
      name: 'Interview',
      description: 'Complete client intake questionnaire',
      href: `interview`,
      icon: ClipboardDocumentListIcon,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      name: 'Training Programs',
      description: 'View and manage workout programs',
      href: `programs`,
      icon: CalendarDaysIcon,
      color: 'bg-green-50 text-green-600',
    },
    {
      name: 'Metrics',
      description: 'Track progress and measurements',
      href: `metrics`,
      icon: ChartBarIcon,
      color: 'bg-purple-50 text-purple-600',
    },
    {
      name: 'Diet Plans',
      description: 'Nutrition and meal planning',
      href: `diet`,
      icon: CakeIcon,
      color: 'bg-orange-50 text-orange-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Client Overview</h1>
        <p className="mt-1 text-gray-600">
          Quick access to {client.full_name}'s information and tools
        </p>
      </div>

      {/* Client Info Card */}
      <Card>
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <UserIcon className="h-10 w-10 text-primary-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">{client.full_name}</h2>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-gray-600">
                <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                <span>{client.email}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
                <span>Member since {format(new Date(client.created_at), 'MMMM yyyy')}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  client.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {client.is_active ? 'Active Client' : 'Inactive Client'}
              </span>
              {client.is_verified && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  Verified
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Links Grid */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className="block group"
            >
              <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary-200 group-hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${link.color}`}>
                    <link.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900 group-hover:text-primary-700">
                      {link.name}
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">{link.description}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Activity Summary - Placeholder */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="text-center py-8 text-gray-500">
          <p>Activity tracking coming soon</p>
          <p className="text-sm mt-1">Recent workouts, measurements, and notes will appear here</p>
        </div>
      </Card>
    </div>
  );
}
