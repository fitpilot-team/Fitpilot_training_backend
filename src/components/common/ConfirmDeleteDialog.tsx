import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from './Button';

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  variant?: 'danger' | 'warning';
}

/**
 * Reusable confirmation dialog for delete operations
 * Replaces duplicated confirmation patterns across ExercisesPage, ClientsPage, etc.
 */
export function ConfirmDeleteDialog({
  isOpen,
  title = 'Confirmar eliminación',
  message,
  itemName,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  isLoading = false,
  onConfirm,
  onCancel,
  variant = 'danger',
}: ConfirmDeleteDialogProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'bg-red-100 text-red-600',
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
      icon: 'bg-yellow-100 text-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    },
  };

  const styles = variantStyles[variant];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onCancel}
        />

        {/* Dialog */}
        <div className="flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600
                         rounded-lg hover:bg-gray-100 transition-colors"
              disabled={isLoading}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>

            <div className="p-6">
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className={`p-3 rounded-full ${styles.icon}`}>
                  <ExclamationTriangleIcon className="h-8 w-8" />
                </div>
              </div>

              {/* Title */}
              <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                {title}
              </h3>

              {/* Message */}
              <p className="text-gray-600 text-center mb-2">
                {message}
              </p>

              {/* Item name highlight */}
              {itemName && (
                <p className="text-center mb-6">
                  <span className="font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                    {itemName}
                  </span>
                </p>
              )}

              {/* Warning text */}
              <p className="text-sm text-gray-500 text-center mb-6">
                Esta acción no se puede deshacer.
              </p>

              {/* Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  {cancelLabel}
                </Button>
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-white font-medium
                             transition-all duration-200 disabled:opacity-50
                             focus:outline-none focus:ring-2 focus:ring-offset-2
                             ${styles.button}`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Eliminando...
                    </span>
                  ) : (
                    confirmLabel
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}

/**
 * Hook for managing confirm delete dialog state
 */
export function useConfirmDelete<T extends { id: string; name?: string }>() {
  const [itemToDelete, setItemToDelete] = useState<T | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openDeleteDialog = (item: T) => {
    setItemToDelete(item);
  };

  const closeDeleteDialog = () => {
    setItemToDelete(null);
  };

  const confirmDelete = async (onDelete: (item: T) => Promise<void>) => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(itemToDelete);
      setItemToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    itemToDelete,
    isDeleting,
    isOpen: !!itemToDelete,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
  };
}

export default ConfirmDeleteDialog;
