import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esExercises from './locales/es/exercises.json';
import esTraining from './locales/es/training.json';
import esClients from './locales/es/clients.json';
import esAi from './locales/es/ai.json';
import esErrors from './locales/es/errors.json';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enExercises from './locales/en/exercises.json';
import enTraining from './locales/en/training.json';
import enClients from './locales/en/clients.json';
import enAi from './locales/en/ai.json';
import enErrors from './locales/en/errors.json';

const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
const LANGUAGE_PREFERENCE_KEY = 'fitpilot_language_preference';
const LEGACY_LANGUAGE_STORE_KEY = 'fitpilot_language';

const normalizeLanguage = (language?: string | null): SupportedLanguage =>
  language?.toLowerCase().startsWith('en') ? 'en' : 'es';

const getDefaultLanguage = (): SupportedLanguage => {
  if (typeof navigator === 'undefined') {
    return 'es';
  }

  return normalizeLanguage(navigator.language);
};

const getLegacyLanguagePreference = (): SupportedLanguage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const legacyValue = localStorage.getItem(LEGACY_LANGUAGE_STORE_KEY);
  if (!legacyValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(legacyValue);
    const language = parsed?.state?.language;

    if (language === 'es' || language === 'en') {
      return language;
    }
  } catch {
    // Ignore parse errors
  }

  return null;
};

const bootstrapLanguagePreference = (): SupportedLanguage => {
  if (typeof window === 'undefined') {
    return getDefaultLanguage();
  }

  const storedPreference = localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
  if (storedPreference) {
    const normalized = normalizeLanguage(storedPreference);
    localStorage.setItem(LANGUAGE_PREFERENCE_KEY, normalized);
    return normalized;
  }

  const legacyPreference = getLegacyLanguagePreference();
  if (legacyPreference) {
    localStorage.setItem(LANGUAGE_PREFERENCE_KEY, legacyPreference);
    return legacyPreference;
  }

  const browserPreference = getDefaultLanguage();
  localStorage.setItem(LANGUAGE_PREFERENCE_KEY, browserPreference);
  return browserPreference;
};

const defaultLanguage = bootstrapLanguagePreference();

export const defaultNS = 'common';
export const resources = {
  es: {
    common: esCommon,
    auth: esAuth,
    exercises: esExercises,
    training: esTraining,
    clients: esClients,
    ai: esAi,
    errors: esErrors,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    exercises: enExercises,
    training: enTraining,
    clients: enClients,
    ai: enAi,
    errors: enErrors,
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: defaultLanguage,
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    defaultNS,
    ns: ['common', 'auth', 'exercises', 'training', 'clients', 'ai', 'errors'],

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: LANGUAGE_PREFERENCE_KEY,
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;
