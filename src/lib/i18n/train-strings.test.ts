import { describe, expect, it } from "vitest";
import { dictionaries } from "./dictionaries";

// Handoff 11: the strings that QA report 11 found hard-coded in English, plus the
// owner "add booking" screen, must exist in both languages with the same keys,
// and the Thai side must really be Thai (Thai is the default language).
const SECTIONS = [
  "landing",
  "customer",
  "status",
  "bookingDetail",
  "account",
  "pages",
  "msg",
  "ownerAdd",
  "ui",
] as const;

const THAI = /[฀-๿]/;

describe.each(SECTIONS)("section %s", (section) => {
  const th: Record<string, string> = (dictionaries.th as Record<string, Record<string, string>>)[section] ?? {};
  const en: Record<string, string> = (dictionaries.en as Record<string, Record<string, string>>)[section] ?? {};

  it("exists in both languages with identical keys", () => {
    expect(Object.keys(th).length).toBeGreaterThan(0);
    expect(Object.keys(th).sort()).toEqual(Object.keys(en).sort());
  });

  it("is Thai on the Thai side (brand names and symbols aside)", () => {
    for (const [key, value] of Object.entries(th)) {
      expect(value.length, `${section}.${key} is empty`).toBeGreaterThan(0);
      // Allow a value that is only a placeholder/brand, e.g. "{n}".
      if (/[A-Za-z]{3,}/.test(value.replace(/\{\w+\}|TatNat|Stripe|Visa|Mastercard|Amex|Safari|Supabase|QR|README|supabase db push|\.env(\.\w+)*/g, ""))) {
        expect(THAI.test(value), `${section}.${key} should be Thai: ${value}`).toBe(true);
      }
    }
  });

  it("keeps the same {placeholders} in both languages", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en)) {
      expect(names(th[key] ?? ""), `${section}.${key}`).toEqual(names(en[key] ?? ""));
    }
  });
});
