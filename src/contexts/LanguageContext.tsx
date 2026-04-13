import React, { createContext, useContext, useState, useCallback } from "react";
import en, { type TranslationKeys } from "@/i18n/en";
import am from "@/i18n/am";
import om from "@/i18n/om";
import type { Language } from "@/lib/types";

const translations: Record<Language, TranslationKeys> = { en, am, om };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: en,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLang] = useState<Language>(
    () => (localStorage.getItem("app_language") as Language) || "en"
  );

  const setLanguage = useCallback((lang: Language) => {
    setLang(lang);
    localStorage.setItem("app_language", lang);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
