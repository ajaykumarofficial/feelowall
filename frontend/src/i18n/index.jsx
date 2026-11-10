import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGES } from './locales';
import { STORAGE_KEY, detectLanguage, translate } from './translate';

const I18nContext = createContext(null);

const readSaved = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export const I18nProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => detectLanguage(readSaved(), navigator.languages || [navigator.language]));

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  const setLanguage = useCallback((next) => {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice just won't persist, e.g. in a private window.
    }
  }, []);

  const value = useMemo(() => ({
    language,
    setLanguage,
    languages: LANGUAGES,
    t: (key, vars) => translate(language, key, vars)
  }), [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within an I18nProvider');
  return context;
};
