import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { authService } from '../services/auth';
import type { User, Language } from '../types/api';
import type { LoginCredentials } from '../types/auth';
import { useLanguageStore } from './languageStore';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  loadUser: () => Promise<void>;
  updatePreferredLanguage: (language: Language) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      user: null,
      token: authService.getToken(),
      isAuthenticated: authService.isAuthenticated(),
      isLoading: false,
      error: null,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
          // Map email to identifier for transition
          const response = await authService.login({
            identifier: credentials.email,
            password: credentials.password
          });
          set({ token: response.access_token, isAuthenticated: true });

          // Load user profile after successful login
          await get().loadUser();
        } catch (error: any) {
          const errorMessage = error.message || 'Login failed. Please try again.';
          set({ error: errorMessage, isAuthenticated: false, user: null });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        authService.logout();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      setUser: (user: User | null) => {
        set({ user });
      },

      loadUser: async () => {
        const token = authService.getToken();

        if (!token) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        set({ isLoading: true });

        try {
          const user = await authService.getCurrentUser();
          set({
            user,
            isAuthenticated: true,
            token,
            error: null,
          });

          // Sync language with user's preference
          if (user.preferred_language) {
            useLanguageStore.getState().initFromUser(user.preferred_language);
          }
        } catch (error: any) {
          // If user fetch fails, clear auth
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            error: error.message,
          });
          authService.logout();
        } finally {
          set({ isLoading: false });
        }
      },

      updatePreferredLanguage: async (language: Language) => {
        const { user } = get();
        if (!user) return;

        try {
          const updatedUser = await authService.updateUser({ preferred_language: language });
          set({ user: updatedUser });

          // Also update local language store
          useLanguageStore.getState().setLanguage(language);
        } catch (error: any) {
          console.error('Failed to update language preference:', error);
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'AuthStore' }
  )
);
