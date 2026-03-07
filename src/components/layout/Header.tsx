import { motion } from 'framer-motion';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { useUIStore } from '../../store/uiStore';
import { UserMenu } from './UserMenu';
import { LanguageSelector } from './LanguageSelector';

export function Header() {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100/50 sticky top-0 z-40
                       shadow-sm shadow-gray-200/20">
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <motion.button
            onClick={toggleSidebar}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2.5 rounded-xl text-gray-400 hover:text-gray-700
                       bg-gray-50 hover:bg-gray-100 transition-all duration-200
                       border border-gray-200/50"
          >
            <Bars3Icon className="h-5 w-5" />
          </motion.button>
        </div>

        <div className="flex items-center space-x-3">
          <LanguageSelector />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
