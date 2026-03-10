import { useTranslation } from 'react-i18next';

export function MealOverviewPage() {
    const { t } = useTranslation('common');

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">{t('mealPlans.overview')}</h1>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <p className="text-gray-600">Welcome to the Meal Plans Overview. Here you can see a summary of your current meal plans.</p>
            </div>
        </div>
    );
}
