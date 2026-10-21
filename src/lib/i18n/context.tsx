"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { t as translate, type Locale } from "./dictionaries";
import { LOCALE_COOKIE } from "./server";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Wraps the app once, at the root layout. `initialLocale` comes from the
 * cookie read server-side, so the very first paint already matches — no
 * flash of the wrong language (same pattern the dark-theme inline script
 * already uses in `layout.tsx`).
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof document !== "undefined") {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    }
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within <LocaleProvider>");
  }
  return ctx;
}

/** `const t = useT(); t("confirm.title")` */
export function useT() {
  const { locale } = useLocale();
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );
}
