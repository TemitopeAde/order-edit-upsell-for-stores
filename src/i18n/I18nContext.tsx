import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { i18n } from '@wix/essentials';
import {
  translations,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  type LanguageOption,
} from './translations';
import { Globe, ChevronDown } from 'lucide-react';

interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  languages: LanguageOption[];
}

const I18nContext = createContext<I18nContextType | null>(null);

function detectInitialLanguage(): SupportedLanguage {
  try {
    const wixLang = i18n.getLanguage?.()?.toLowerCase()?.slice(0, 2);
    if (wixLang && ['en', 'es', 'fr', 'de', 'pt', 'ja'].includes(wixLang)) {
      return wixLang as SupportedLanguage;
    }
    // Also check navigator in browser runtime if available
    if (typeof window !== 'undefined' && window.navigator?.language) {
      const navLang = window.navigator.language.slice(0, 2).toLowerCase();
      if (['en', 'es', 'fr', 'de', 'pt', 'ja'].includes(navLang)) {
        return navLang as SupportedLanguage;
      }
    }
  } catch {
    // Fall back to English
  }
  return 'en';
}

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');

  useEffect(() => {
    const detected = detectInitialLanguage();
    setLanguageState(detected);
  }, []);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
  };

  const t = (key: string, vars?: Record<string, string | number>): string => {
    const currentDict = translations[language] || translations.en;
    let template = currentDict[key] || translations.en[key] || key;

    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }

    return template;
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { language, setLanguage, languages } = useTranslation();
  const currentLang = languages.find((l) => l.code === language) || languages[0];

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <label
        htmlFor="app-language-select"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: compact ? '6px 10px' : '8px 14px',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          color: '#334155',
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        <Globe size={15} color="#2563eb" />
        <span>{currentLang.flag}</span>
        {!compact && <span>{currentLang.name}</span>}
        <ChevronDown size={14} color="#64748b" />
      </label>
      <select
        id="app-language-select"
        value={language}
        onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
        }}
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.name}
          </option>
        ))}
      </select>
    </div>
  );
};
