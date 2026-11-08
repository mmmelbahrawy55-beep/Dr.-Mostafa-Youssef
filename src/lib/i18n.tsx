import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SiteSettings } from "../../shared/types";
import { content, type Dict, type Lang } from "../content";
import { buildDict } from "./merge-content";
import { useSiteData } from "./site-data";

interface LangContextValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: Dict;
  settings: SiteSettings | null;
  setLang: (lang: Lang) => void;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue | null>(null);
const STORAGE_KEY = "my-lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { data } = useSiteData();
  // Default to English on first visit; an explicit choice is remembered.
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "ar" ? "ar" : "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable — ignore */
    }
  }, [lang]);

  const t = useMemo(() => buildDict(content[lang], lang, data), [lang, data]);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      t,
      settings: data?.settings ?? null,
      setLang: setLangState,
      toggle: () => setLangState((prev) => (prev === "ar" ? "en" : "ar")),
    }),
    [lang, t, data]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
