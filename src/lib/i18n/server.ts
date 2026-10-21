import "server-only";

import { cookies } from "next/headers";
import { DEFAULT_LOCALE, type Locale } from "./dictionaries";

export const LOCALE_COOKIE = "bookly-locale";

/** Reads the visitor's locale preference from the cookie `LocaleProvider` writes. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value === "en" ? "en" : DEFAULT_LOCALE;
}
