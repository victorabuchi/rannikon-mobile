import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import en from './translations/en';
import uk from './translations/uk';
import km from './translations/km';
import vi from './translations/vi';
import ne from './translations/ne';

const LANG_KEY = 'rannikon_lang';

const translations = { en, uk, km, vi, ne };

export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'uk', label: 'Ukrainian', flag: '🇺🇦' },
  { code: 'km', label: 'Khmer', flag: '🇰🇭' },
  { code: 'vi', label: 'Vietnamese', flag: '🇻🇳' },
  { code: 'ne', label: 'Nepali', flag: '🇳🇵' },
];

function lookup(dict, key) {
  return key.split('.').reduce((obj, part) => (obj && obj[part] !== undefined ? obj[part] : undefined), dict);
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(LANG_KEY);
      if (saved && translations[saved]) {
        setLangState(saved);
      }
    })();
  }, []);

  const setLang = useCallback(async (next) => {
    if (!translations[next]) return;
    setLangState(next);
    await SecureStore.setItemAsync(LANG_KEY, next);
  }, []);

  const t = useCallback((key) => {
    const value = lookup(translations[lang], key);
    if (value !== undefined) return value;
    const fallback = lookup(translations.en, key);
    return fallback !== undefined ? fallback : key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
