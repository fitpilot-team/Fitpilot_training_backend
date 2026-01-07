import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import i18n from '../i18n';

export type Language = 'es' | 'en';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  initFromUser: (preferredLanguage?: Language) => void;
  syncWithI18n: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  devtools(
    persist(
      (set, get) => ({
        language: 'es',

        setLanguage: (lang: Language) => {
          i18n.changeLanguage(lang);
          set({ language: lang });
        },

        initFromUser: (preferredLanguage?: Language) => {
          if (preferredLanguage) {
            i18n.changeLanguage(preferredLanguage);
            set({ language: preferredLanguage });
          }
        },

        syncWithI18n: () => {
          const { language } = get();
          i18n.changeLanguage(language);
        },
      }),
      {
        name: 'fitpilot_language',
        partialize: (state) => ({ language: state.language }),
      }
    ),
    { name: 'LanguageStore' }
  )
);

// Sync i18n with persisted language on app load
const storedLanguage = localStorage.getItem('fitpilot_language');
if (storedLanguage) {
  try {
    const parsed = JSON.parse(storedLanguage);
    if (parsed?.state?.language) {
      i18n.changeLanguage(parsed.state.language);
    }
  } catch {
    // Ignore parse errors
  }
}
