import { useOutletContext } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import type { Client } from '../../types/client';
import { CakeIcon } from '@heroicons/react/24/outline';

interface ClientContext {
  client: Client;
}

export function ClientDietPage() {
  const { client } = useOutletContext<ClientContext>();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Diet Plans</h1>
        <p className="mt-1 text-gray-600">
          Nutrition and meal planning for {client.full_name}
        </p>
      </div>

      {/* Coming Soon Card */}
      <Card>
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-6">
            <CakeIcon className="h-10 w-10 text-orange-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Diet Plans Coming Soon
          </h3>
          <p className="text-gray-600 max-w-md mx-auto mb-6">
            We're working on a comprehensive nutrition management system.
            This feature will allow you to create personalized meal plans,
            track macros, and manage dietary requirements for your clients.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
              Meal Planning
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
              Macro Tracking
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
              Recipe Database
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
              Calorie Calculator
            </span>
          </div>
        </div>
      </Card>

      {/* Feature Preview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="opacity-60">
          <h4 className="font-semibold text-gray-900 mb-2">Calorie Calculator</h4>
          <p className="text-sm text-gray-600">
            Calculate daily caloric needs based on goals, activity level, and body composition.
          </p>
        </Card>
        <Card className="opacity-60">
          <h4 className="font-semibold text-gray-900 mb-2">Macro Distribution</h4>
          <p className="text-sm text-gray-600">
            Set custom protein, carb, and fat ratios based on training phases.
          </p>
        </Card>
        <Card className="opacity-60">
          <h4 className="font-semibold text-gray-900 mb-2">Meal Templates</h4>
          <p className="text-sm text-gray-600">
            Create reusable meal templates for easy meal plan creation.
          </p>
        </Card>
        <Card className="opacity-60">
          <h4 className="font-semibold text-gray-900 mb-2">Shopping Lists</h4>
          <p className="text-sm text-gray-600">
            Auto-generate shopping lists from weekly meal plans.
          </p>
        </Card>
      </div>
    </div>
  );
}
