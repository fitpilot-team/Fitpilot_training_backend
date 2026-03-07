import { useState, useCallback } from 'react';

/**
 * Generic hook for modal state management
 * Replaces repetitive useState patterns across 8+ components
 */
export function useModal<T = null>(initialData: T | null = null) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | null>(initialData);

  const open = useCallback((item?: T) => {
    setData(item ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setData(null);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
    isOpen,
    data,
    open,
    close,
    toggle,
    setData,
  };
}

/**
 * Hook for managing multiple modals in a component
 */
export function useMultipleModals<T extends string>(modalNames: T[]) {
  const [openModals, setOpenModals] = useState<Record<T, boolean>>(
    () => modalNames.reduce((acc, name) => ({ ...acc, [name]: false }), {} as Record<T, boolean>)
  );

  const openModal = useCallback((name: T) => {
    setOpenModals((prev) => ({ ...prev, [name]: true }));
  }, []);

  const closeModal = useCallback((name: T) => {
    setOpenModals((prev) => ({ ...prev, [name]: false }));
  }, []);

  const toggleModal = useCallback((name: T) => {
    setOpenModals((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const isModalOpen = useCallback((name: T) => openModals[name], [openModals]);

  return {
    openModals,
    openModal,
    closeModal,
    toggleModal,
    isModalOpen,
  };
}

export default useModal;
