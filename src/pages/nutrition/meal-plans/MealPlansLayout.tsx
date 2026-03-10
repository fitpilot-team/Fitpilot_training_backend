import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export function MealPlansLayout() {
    const { t } = useTranslation('common');
    const location = useLocation();

    const navItems = [
        { name: t('mealPlans.overview'), href: '/nutrition/meal-plans', end: true },
        { name: t('nav.clientsMenus'), href: '/nutrition/meal-plans/clients-menus' },
        { name: t('mealPlans.builder'), href: '/nutrition/meal-plans/builder' },
        { name: t('mealPlans.templates'), href: '/nutrition/meal-plans/templates' },
        { name: 'Menús Reutilizables', href: '/nutrition/meal-plans/reusable-menus' },
        { name: 'Menús sin terminar', href: '/nutrition/meal-plans/drafts' },
    ];

    return (
        <div className="flex flex-col h-full">
            {/* Internal Navigation Menu */}
            <div className="bg-white border-b border-gray-200 px-6 py-2">
                <nav className="flex space-x-8">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.href}
                            to={item.href}
                            end={item.end}
                            className={({ isActive }) => `
                relative py-3 text-sm font-medium transition-colors duration-200
                ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}
              `}
                        >
                            {item.name}
                            {((item.end && location.pathname === item.href) || (!item.end && location.pathname.startsWith(item.href))) && (
                                <motion.div
                                    layoutId="mealPlansNavUnderline"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                                    initial={false}
                                />
                            )}
                        </NavLink>
                    ))}
                </nav>
            </div>

            {/* Page Content */}
            <div className="flex-1 overflow-auto">
                <Outlet />
            </div>
        </div>
    );
}
