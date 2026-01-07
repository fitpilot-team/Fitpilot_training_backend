import { create } from "zustand";
import { devtools } from 'zustand/middleware';
import { User } from "../types/api";

type AuthState = {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  language: 'es' | 'en';
  setAuth: (data: { token: string }) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  setLanguage: (lang: 'es' | 'en') => void;
};

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      token: localStorage.getItem('access_token'),
      user: null,
      isAuthenticated: !!localStorage.getItem('access_token'),
      language: (localStorage.getItem('language') as 'es' | 'en') || 'es',

      setAuth: ({ token }) => {
        localStorage.setItem('access_token', token);
        set({
          token,
          isAuthenticated: true,
        });
      },

      setUser: (user) => set({ user }),

      logout: () => {
        localStorage.removeItem('access_token');
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
      },

      setLanguage: (lang) => {
        localStorage.setItem('language', lang);
        set({ language: lang });
      },
    }),
    { name: 'NewAuthStore' }
  )
);
