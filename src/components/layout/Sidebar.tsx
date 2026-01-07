import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  BeakerIcon,
  DocumentDuplicateIcon,
  UsersIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  UserIcon,
  ChevronDownIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline';
import { Dumbbell, Apple, Utensils, Calendar } from 'lucide-react';
import fitPilotLogo from '../../assets/favicon.ico';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useClientStore } from '../../store/clientStore';

interface NavItem {
  nameKey: string;
  href: string;
  icon: any;
  roles?: string[];
}

const navigationConfig: NavItem[] = [
  { nameKey: 'dashboard', href: '/', icon: HomeIcon },
  { nameKey: 'exercises', href: '/exercises', icon: BeakerIcon },
  { nameKey: 'templates', href: '/templates', icon: DocumentDuplicateIcon },
  { nameKey: 'clients', href: '/clients', icon: UsersIcon, roles: ['trainer', 'admin'] },
  { nameKey: 'settings', href: '/settings', icon: Cog6ToothIcon },
];

const clientNavigationConfig = [
  { nameKey: 'summary', href: '', icon: HomeIcon },
  { nameKey: 'interview', href: '/interview', icon: ClipboardDocumentListIcon },
  { nameKey: 'programs', href: '/programs', icon: Dumbbell },
  { nameKey: 'metrics', href: '/metrics', icon: ChartBarIcon },
  { nameKey: 'diet', href: '/diet', icon: Apple },
];

const nutritionConfig = [
  { nameKey: 'dashboard', href: '/nutrition', icon: HomeIcon },
  { nameKey: 'agenda', href: '/nutrition/agenda', icon: Calendar },
  { nameKey: 'nutritionClients', href: '/nutrition/clients', icon: UsersIcon },
  { nameKey: 'nutritionCreateDiet', href: '/nutrition/create-diet', icon: PlusCircleIcon },
];

export function Sidebar() {
  const location = useLocation();
  const { t } = useTranslation('common');
  const { user } = useAuthStore();
  const { isSidebarOpen } = useUIStore();
  const { selectedClient } = useClientStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isNutritionOpen, setIsNutritionOpen] = useState(false);

  if (!isSidebarOpen) return null;

  // Detectar si estamos en contexto de cliente
  const isInClientContext = location.pathname.match(/^\/clients\/[^/]+/);

  const filteredNavigation = navigationConfig.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  // Navegación del cliente (solo cuando hay cliente seleccionado)
  const clientNavigation = selectedClient
    ? clientNavigationConfig.map(item => ({
      ...item,
      name: t(`clientNav.${item.nameKey}`),
      href: `/clients/${selectedClient.id}${item.href}`,
    }))
    : [];

  const sidebarWidth = isExpanded ? 256 : 72;

  // Verificar si una ruta de cliente está activa
  const isClientRouteActive = (href: string) => {
    if (href === `/clients/${selectedClient?.id}`) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <motion.aside
      initial={{ width: 72 }}
      animate={{ width: sidebarWidth }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className="relative bg-white/80 backdrop-blur-xl border-r border-gray-200/50 min-h-screen
                 shadow-lg shadow-gray-200/20 z-50 overflow-hidden flex flex-col"
    >
      {/* Gradient accent line */}
      <div className="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-blue-500 via-blue-600 to-blue-700" />

      {/* Logo Section */}
      <motion.div
        className="px-4 py-5 border-b border-gray-100"
        layout
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="shrink-0 w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 via-blue-600 to-blue-700
                       flex items-center justify-center shadow-lg shadow-blue-500/30 overflow-hidden"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ duration: 0.2 }}
          >
            <img src={fitPilotLogo} alt="FitPilot" className="h-7 w-7 object-contain" />
          </motion.div>
          <AnimatePresence mode="wait">
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <h1 className="text-xl font-bold bg-linear-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent whitespace-nowrap">
                  {t('appName')}
                </h1>
                <p className="text-xs text-gray-400 font-medium whitespace-nowrap">{t('appTagline')}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Main Navigation */}
      <nav className="px-3 py-4 space-y-2">
        {filteredNavigation.map((item) => {
          const isActive = location.pathname === item.href ||
            (item.href !== '/' && item.href !== '/clients' && location.pathname.startsWith(item.href)) ||
            (item.href === '/clients' && location.pathname.startsWith('/clients'));
          const Icon = item.icon;

          const itemName = t(`nav.${item.nameKey}`);
          return (
            <Link
              key={item.nameKey}
              to={item.href}
              className="group relative block"
            >
              <motion.div
                className={`
                  flex items-center gap-3 py-3 rounded-xl
                  transition-all duration-200 relative overflow-hidden
                  ${isExpanded ? 'px-3' : 'justify-center'}
                  ${isActive
                    ? 'bg-linear-to-r from-blue-500/10 to-blue-600/5 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                  }
                `}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full
                               bg-linear-to-b from-blue-500 to-blue-600"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}

                <motion.div
                  className={`shrink-0 p-2 rounded-lg transition-colors duration-200
                    ${isActive
                      ? 'bg-linear-to-br from-blue-500 to-blue-600 shadow-md shadow-blue-500/25'
                      : 'bg-gray-100 group-hover:bg-gray-200'
                    }`}
                  whileHover={{ scale: 1.1 }}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
                </motion.div>

                <AnimatePresence mode="wait">
                  {isExpanded && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className={`font-medium whitespace-nowrap ${isActive ? 'text-blue-700' : ''}`}
                    >
                      {itemName}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Tooltip when collapsed */}
                {!isExpanded && (
                  <div className="absolute left-full ml-3 px-3 py-2 bg-gray-900 text-white text-sm font-medium
                                  rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none
                                  transition-opacity duration-200 whitespace-nowrap z-50
                                  shadow-lg">
                    {itemName}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-gray-900" />
                  </div>
                )}
              </motion.div>
            </Link>
          );
        })}

      </nav>

      {/* Nutrition Section */}
      <div className="mx-3 my-2 border-t border-gray-200/50" />

      <nav className="px-3 space-y-2">
        <div className="px-3 mb-2">
          <AnimatePresence>
            {isExpanded && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs font-semibold text-gray-400 uppercase tracking-wider"
              >
                {t('nav.nutrition')}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Nutrition Dropdown Toggle */}
        <div className="relative group">
          <button
            onClick={() => {
              if (!isExpanded) {
                setIsExpanded(true);
                setIsNutritionOpen(true);
              } else {
                setIsNutritionOpen((prev) => !prev);
              }
            }}
            className={`
                    w-full flex items-center gap-3 py-3 rounded-xl
                    transition-all duration-200 relative overflow-hidden
                    ${isExpanded ? 'px-3' : 'justify-center'}
                    ${location.pathname.startsWith('/nutrition')
                ? 'bg-linear-to-r from-emerald-500/10 to-emerald-600/5 text-emerald-700'
                : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
              }
                `}
          >
            <motion.div
              className={`shrink-0 p-2 rounded-lg transition-colors duration-200
                    ${location.pathname.startsWith('/nutrition')
                  ? 'bg-linear-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/25'
                  : 'bg-gray-100 group-hover:bg-gray-200'
                }`}
              whileHover={{ scale: 1.1 }}
            >
              <Utensils className={`h-5 w-5 ${location.pathname.startsWith('/nutrition') ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
            </motion.div>

            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className={`font-medium whitespace-nowrap flex-1 text-left ${location.pathname.startsWith('/nutrition') ? 'text-emerald-700' : ''}`}
                >
                  {t('nav.nutrition')}
                </motion.span>
              )}
            </AnimatePresence>

            {isExpanded && (
              <motion.div
                initial={{ rotate: -90, opacity: 0 }}
                animate={{
                  rotate: isNutritionOpen ? 0 : -90,
                  opacity: 1
                }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDownIcon className="h-4 w-4" />
              </motion.div>
            )}
          </button>
        </div>

        {/* Nutrition Submenu */}
        <AnimatePresence>
          {isExpanded && isNutritionOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden pl-4"
            >
              {nutritionConfig.map((item) => {
                const isActive = item.href === '/nutrition'
                  ? location.pathname === item.href
                  : location.pathname.startsWith(item.href);
                const Icon = item.icon;
                const itemName = t(`nav.${item.nameKey}`);

                return (
                  <Link
                    key={item.nameKey}
                    to={item.href}
                    className="group relative block mt-1"
                  >
                    <motion.div
                      className={`
                            flex items-center gap-3 px-3 py-2 rounded-xl
                            transition-all duration-200 relative overflow-hidden
                            ${isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-700'
                        }
                            `}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <motion.div
                          layoutId="nutritionSubActiveIndicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full
                                        bg-emerald-500"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}

                      <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-gray-400 group-hover:text-emerald-600'}`} />

                      <span className="text-sm font-medium whitespace-nowrap">
                        {itemName}
                      </span>
                    </motion.div>
                  </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Client Section - Aparece cuando hay cliente seleccionado */}
      <AnimatePresence>
        {selectedClient && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Separator */}
            <div className="mx-3 my-2 border-t border-gray-200" />

            {/* Client Header */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-3">
                <motion.div
                  className="shrink-0 w-9 h-9 rounded-lg bg-linear-to-br from-emerald-500 to-teal-600
                             flex items-center justify-center shadow-md shadow-emerald-500/25"
                  whileHover={{ scale: 1.05 }}
                >
                  <UserIcon className="h-4 w-4 text-white" />
                </motion.div>
                <AnimatePresence mode="wait">
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden flex-1 min-w-0"
                    >
                      <p className="text-sm font-semibold text-gray-900 truncate whitespace-nowrap">
                        {selectedClient.full_name}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${selectedClient.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <p className="text-xs text-gray-500 whitespace-nowrap">
                          {selectedClient.is_active ? t('status.active') : t('status.inactive')}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Client Navigation */}
            <nav className="px-3 pb-2 space-y-1">
              {clientNavigation.map((item) => {
                const isActive = isClientRouteActive(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className="group relative block"
                  >
                    <motion.div
                      className={`
                        flex items-center gap-3 py-3 rounded-xl
                        transition-all duration-200 relative overflow-hidden
                        ${isExpanded ? 'px-3' : 'justify-center'}
                        ${isActive
                          ? 'bg-linear-to-r from-emerald-500/10 to-teal-600/5 text-emerald-700'
                          : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                        }
                      `}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* Active indicator - verde para cliente */}
                      {isActive && (
                        <motion.div
                          layoutId="clientActiveIndicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full
                                     bg-linear-to-b from-emerald-500 to-teal-600"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}

                      <motion.div
                        className={`shrink-0 p-2 rounded-lg transition-colors duration-200
                          ${isActive
                            ? 'bg-linear-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/25'
                            : 'bg-gray-100 group-hover:bg-gray-200'
                          }`}
                        whileHover={{ scale: 1.1 }}
                      >
                        <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
                      </motion.div>

                      <AnimatePresence mode="wait">
                        {isExpanded && (
                          <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.15 }}
                            className={`font-medium whitespace-nowrap ${isActive ? 'text-emerald-700' : ''}`}
                          >
                            {item.name}
                          </motion.span>
                        )}
                      </AnimatePresence>

                      {/* Tooltip when collapsed */}
                      {!isExpanded && (
                        <div className="absolute left-full ml-3 px-3 py-2 bg-gray-900 text-white text-sm font-medium
                                        rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none
                                        transition-opacity duration-200 whitespace-nowrap z-50
                                        shadow-lg">
                          {item.name}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-gray-900" />
                        </div>
                      )}
                    </motion.div>
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User Info */}
      {user && (
        <motion.div
          className="px-3 py-4 border-t border-gray-100 bg-linear-to-r from-gray-50/50 to-transparent"
          layout
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="shrink-0 h-10 w-10 rounded-xl bg-linear-to-br from-blue-500 to-blue-700
                         flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/25"
              whileHover={{ scale: 1.05 }}
            >
              {user.full_name.charAt(0).toUpperCase()}
            </motion.div>
            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p className="text-sm font-semibold text-gray-900 truncate whitespace-nowrap">
                    {user.full_name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize font-medium whitespace-nowrap">
                    {t(`roles.${user.role}`)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Expand hint indicator */}
      <AnimatePresence>
        {!isExpanded && !isInClientContext && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-gray-300 text-xs"
            >
              →
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
