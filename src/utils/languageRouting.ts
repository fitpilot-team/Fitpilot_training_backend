import type { Language } from '../store/languageStore';

const LANGUAGE_SEGMENT_REGEX = /^\/(es|en)(?=\/|$)/;

export const normalizeToSupportedLanguage = (value?: string | null): Language =>
  value?.toLowerCase().startsWith('en') ? 'en' : 'es';

export const getLanguageFromPathname = (pathname: string): Language | null => {
  const match = pathname.match(LANGUAGE_SEGMENT_REGEX);
  return match ? (match[1] as Language) : null;
};

export const stripLanguageFromPathname = (pathname: string): string => {
  const languageInPath = getLanguageFromPathname(pathname);
  if (!languageInPath) {
    return pathname || '/';
  }

  const strippedPath = pathname.slice(languageInPath.length + 1);
  return strippedPath || '/';
};

export const withLanguagePrefix = (pathname: string, language: Language): string => {
  const normalizedPath = stripLanguageFromPathname(pathname || '/');
  const safePath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;

  return safePath === '/' ? `/${language}` : `/${language}${safePath}`;
};
