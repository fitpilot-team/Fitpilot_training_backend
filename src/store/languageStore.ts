import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import i18n from '../i18n';

export type Language = 'es' | 'en';
const LANGUAGE_STORE_KEY = 'fitpilot_language';
const LANGUAGE_PREFERENCE_KEY = 'fitpilot_language_preference';

const normalizeLanguage = (language?: string | null): Language =>
  language?.toLowerCase().startsWith('en') ? 'en' : 'es';

const applyLanguage = (language: Language) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LANGUAGE_PREFERENCE_KEY, language);
  }

  i18n.changeLanguage(language);
};

const getPersistedLanguage = (): Language | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const detectedLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
  if (detectedLanguage) {
    return normalizeLanguage(detectedLanguage);
  }

  const storedLanguage = localStorage.getItem(LANGUAGE_STORE_KEY);
  if (!storedLanguage) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedLanguage);
    const language = parsed?.state?.language;

    if (language === 'es' || language === 'en') {
      return language;
    }
  } catch {
    // Ignore parse errors
  }

  return null;
};

const getInitialLanguage = (): Language => {
  const persistedLanguage = getPersistedLanguage();
  if (persistedLanguage) {
    return persistedLanguage;
  }

  const i18nLanguage = i18n.resolvedLanguage || i18n.language;
  if (i18nLanguage) {
    return normalizeLanguage(i18nLanguage);
  }

  if (typeof navigator !== 'undefined') {
    return normalizeLanguage(navigator.language);
  }

  return 'es';
};

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
        language: getInitialLanguage(),

        setLanguage: (lang: Language) => {
          applyLanguage(lang);
          set({ language: lang });
        },

        initFromUser: (preferredLanguage?: Language) => {
          if (preferredLanguage) {
            const language = normalizeLanguage(preferredLanguage);
            applyLanguage(language);
            set({ language });
          }
        },

        syncWithI18n: () => {
          const { language } = get();
          applyLanguage(language);
        },
      }),
      {
        name: LANGUAGE_STORE_KEY,
        partialize: (state) => ({ language: state.language }),
      }
    ),
    { name: 'LanguageStore' }
  )
);

const persistedLanguage = getPersistedLanguage();
if (persistedLanguage) {
  applyLanguage(persistedLanguage);
}
