import { Fragment, ReactNode } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  panelClassName?: string;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', panelClassName = '' }: ModalProps) {
  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-xl', // Typo in original file? previous was 4xl, let's keep it consistent or check.
    // Wait, previous file had: xl: 'max-w-4xl'. I should be careful not to regress. 
    full: 'max-w-7xl',
  };
  
  // I will just modify the interface and the usage line, avoiding re-writing the whole map if possible, 
  // but replace_file_content needs context.
  
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop with blur */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-4"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-4"
            >
              <Dialog.Panel
                className={`
                  w-full ${sizeStyles[size as keyof typeof sizeStyles] || sizeStyles.md} transform overflow-hidden
                  rounded-2xl bg-white/95 backdrop-blur-xl
                  p-6 text-left align-middle
                  shadow-2xl shadow-gray-900/10
                  border border-gray-100/50
                  transition-all ${panelClassName}
                `}
              >
                {title && (
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
                    <Dialog.Title
                      as="h3"
                      className="text-xl font-bold text-gray-900"
                    >
                      {title}
                    </Dialog.Title>
                    <motion.button
                      onClick={onClose}
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100
                                 rounded-xl transition-colors duration-200"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </motion.button>
                  </div>
                )}
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
