import { create } from "zustand";
import { devtools } from 'zustand/middleware';
import { User } from "../types/api";
import { useLanguageStore } from "./languageStore";

const resolveInitialLanguage = (): 'es' | 'en' => {
  if (typeof window === 'undefined') {
    return 'es';
  }

  const storedLanguage =
    localStorage.getItem('fitpilot_language_preference') || localStorage.getItem('language');

  return storedLanguage?.toLowerCase().startsWith('en') ? 'en' : 'es';
};

type AuthState = {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  authChecked: boolean;
  language: 'es' | 'en';
  setAuth: (data: { token: string }) => void;
  clearAuth: () => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  setAuthChecked: (checked: boolean) => void;
  setLanguage: (lang: 'es' | 'en') => void;
};

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      authChecked: false,
      language: resolveInitialLanguage(),

      setAuth: ({ token }) => {
        set({
          token,
          isAuthenticated: true,
          authChecked: true,
        });
      },

      clearAuth: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          authChecked: true,
        });
      },

      setUser: (user) => {
        const preferredLanguage = user?.preferred_language;

        if (preferredLanguage === 'es' || preferredLanguage === 'en') {
          useLanguageStore.getState().initFromUser(preferredLanguage);
          localStorage.setItem('language', preferredLanguage);
          set({ user, language: preferredLanguage });
          return;
        }

        set({ user });
      },

      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          authChecked: true,
        });
      },

      setAuthChecked: (checked) => set({ authChecked: checked }),

      setLanguage: (lang) => {
        useLanguageStore.getState().setLanguage(lang);
        localStorage.setItem('language', lang);
        set({ language: lang });
      },
    }),
    { name: 'NewAuthStore' }
  )
);
