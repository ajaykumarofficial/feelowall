import { LANGUAGES, MESSAGES } from './locales';

export const STORAGE_KEY = 'feelowall-language';

/** Pick a supported language from a saved choice, then the browser's preferences. */
export const detectLanguage = (saved, browserLanguages = []) => {
  const supported = LANGUAGES.map((language) => language.code);
  if (supported.includes(saved)) return saved;
  for (const candidate of browserLanguages) {
    const base = String(candidate).toLowerCase().split('-')[0];
    if (supported.includes(base)) return base;
  }
  return 'en';
};

/** Look up text, falling back to English and then to the key itself. */
export const translate = (language, key, vars = {}) => {
  const template = MESSAGES[language]?.[key] ?? MESSAGES.en[key] ?? key;
  return Object.entries(vars).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), template);
};
