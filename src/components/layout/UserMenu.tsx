import { Fragment, useState } from 'react';
import { Menu, Transition, MenuItems, MenuItem, MenuButton } from '@headlessui/react';
import { UserCircleIcon, ArrowRightOnRectangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/newAuthStore';
import { useNavigate } from 'react-router-dom';
import { logoutRequest } from '@/api/auth/auth.api';

export function UserMenu() {
  const { t } = useTranslation(['auth', 'common']);
  const { user, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      await logoutRequest();
    } catch {
      // Local logout still executes even if backend logout fails.
    } finally {
      logout();
      navigate('/auth/login', { replace: true });
    }
  };

  // If user is not yet loaded, we use a placeholder or dummy data
  const displayName = user?.full_name || 'User';
  const displayEmail = user?.email || '';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      {isLoggingOut && (
        <div className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-sm flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg border border-gray-200">
            <ArrowPathIcon className="h-5 w-5 text-blue-600 animate-spin" />
            <span className="text-sm font-medium text-gray-700">{t('auth:logout.loading')}</span>
          </div>
        </div>
      )}

      <Menu as="div" className="relative">
      <MenuButton className={`flex items-center space-x-3 p-1 rounded-full 
        hover:bg-gray-100 transition-all duration-200 
        border border-none hover:cursor-pointer
        hover:shadow-md
        `}
        disabled={isLoggingOut}
      >
        <div className={`h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
          {initial}
        </div>
      </MenuButton>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <MenuItems className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl bg-white shadow-xl focus:outline-none z-50 overflow-hidden">
          <div className="px-5 py-4 bg-gray-50/50 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
          </div>

          <div className="py-2">
            <MenuItem>
              {({ active }) => (
                <button
                  onClick={() => navigate('/profile')}
                  disabled={isLoggingOut}
                  className={`${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    } flex w-full items-center px-5 py-2.5 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <UserCircleIcon className={`mr-3 h-5 w-5 ${active ? 'text-blue-500' : 'text-gray-400'}`} />
                  {t('auth:profile.title')}
                </button>
              )}
            </MenuItem>

            <div className="my-1 border-t border-gray-100" />

            <MenuItem>
              {({ active, focus }) => (
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className={`${active || focus ? 'bg-red-50 text-red-700' : 'text-gray-700'
                    } flex w-full items-center px-5 py-2.5 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {isLoggingOut ? (
                    <ArrowPathIcon className="mr-3 h-5 w-5 text-red-500 animate-spin" />
                  ) : (
                    <ArrowRightOnRectangleIcon className={`mr-3 h-5 w-5 ${active || focus ? 'text-red-500' : 'text-red-400'}`} />
                  )}
                  {isLoggingOut ? t('auth:logout.loading') : t('auth:logout.button')}
                </button>
              )}
            </MenuItem>
          </div>
        </MenuItems>
      </Transition>
      </Menu>
    </>
  );
}
