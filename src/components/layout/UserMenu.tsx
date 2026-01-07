import { Fragment } from 'react';
import { Menu, Transition, MenuItems, MenuItem, MenuButton } from '@headlessui/react';
import { UserCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/newAuthStore';
import { useNavigate } from 'react-router-dom';

export function UserMenu() {
  const { t } = useTranslation(['auth', 'common']);
  const { user, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  if (!isAuthenticated) return null;

  const handleLogout = () => {
    logout();
    navigate('/auth/login');
  };

  // If user is not yet loaded, we use a placeholder or dummy data
  const displayName = user?.full_name || 'User';
  const displayEmail = user?.email || '';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Menu as="div" className="relative">
      <MenuButton className={`flex items-center space-x-3 p-1 rounded-full 
        hover:bg-gray-100 transition-all duration-200 
        border border-none hover:cursor-pointer
        hover:shadow-md
        `}>
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
                  className={`${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    } flex w-full items-center px-5 py-2.5 text-sm transition-colors`}
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
                  className={`${active || focus ? 'bg-red-50 text-red-700' : 'text-gray-700'
                    } flex w-full items-center px-5 py-2.5 text-sm transition-colors`}
                >
                  <ArrowRightOnRectangleIcon className={`mr-3 h-5 w-5 ${active || focus ? 'text-red-500' : 'text-red-400'}`} />
                  {t('auth:logout.button')}
                </button>
              )}
            </MenuItem>
          </div>
        </MenuItems>
      </Transition>
    </Menu>
  );
}
