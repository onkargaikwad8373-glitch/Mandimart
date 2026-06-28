import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, Language, translateDynamic } from "../utils/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dt: (text: string | null | undefined) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("mandimate_lang");
    if (saved === "en" || saved === "mr" || saved === "hi") {
      return saved as Language;
    }
    return "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("mandimate_lang", lang);
  };

  const t = (key: string): string => {
    const dict = translations[language] || translations["en"];
    // Typecast to avoid TS dict access complaints
    const val = (dict as Record<string, string>)[key];
    if (val) return val;

    // Fallback to English dictionary
    const fallbackDict = translations["en"] as Record<string, string>;
    return fallbackDict[key] || key;
  };

  const dt = (text: string | null | undefined): string => {
    return translateDynamic(text, language);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dt }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
