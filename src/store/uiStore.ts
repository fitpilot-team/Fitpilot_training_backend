import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface UIState {
  isSidebarOpen: boolean;
  activeModal: string | null;
  modalData: any;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  openModal: (modalId: string, data?: any) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      isSidebarOpen: true,
      activeModal: null,
      modalData: null,

      toggleSidebar: () => {
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen }), false, 'toggleSidebar');
      },

      setSidebarOpen: (isOpen: boolean) => {
        set({ isSidebarOpen: isOpen }, false, 'setSidebarOpen');
      },

      openModal: (modalId: string, data?: any) => {
        set({ activeModal: modalId, modalData: data }, false, 'openModal');
      },

      closeModal: () => {
        set({ activeModal: null, modalData: null }, false, 'closeModal');
      },
    }),
    { name: 'UIStore' }
  )
);
