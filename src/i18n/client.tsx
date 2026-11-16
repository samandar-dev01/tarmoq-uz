"use client";
// The language for CLIENT components. The root layout resolves it on the server and hands it to <LocaleProvider>, so the
// first render in the browser is the same text the server wrote (no hydration mismatch, nothing guessed in an effect).
//   const t = useT();   t("Chiqish")        const locale = useLocale();
// The full guide is at the top of ./dictionary.ts.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { translator, type Translator } from "./dictionary";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = (): Locale => useContext(LocaleContext);

export function useT(): Translator {
  const locale = useLocale();
  return useMemo(() => translator(locale), [locale]);
}
