import { describe, expect, it } from "vitest";
import { dictionaries } from "./dictionaries";

// Handoff 07: every owner billing string exists in Thai and English with the same
// keys, the Thai side is really Thai, and placeholders match between languages.
const th = dictionaries.th.billing as Record<string, string>;
const en = dictionaries.en.billing as Record<string, string>;
const THAI = /[฀-๿]/;
const placeholders = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(",");

describe("billing strings", () => {
  it("has identical keys in both languages", () => {
    expect(Object.keys(th).length).toBeGreaterThan(50);
    expect(Object.keys(th).sort()).toEqual(Object.keys(en).sort());
  });
  it("is Thai on the Thai side", () => {
    const bad = Object.entries(th).filter(([k, v]) => k !== "nextChargeValue" && !THAI.test(v)) // that one is only placeholders.map(([k]) => k);
    expect(bad).toEqual([]);
  });
  it("uses the same placeholders in both languages", () => {
    for (const k of Object.keys(th)) expect(placeholders(th[k]!), k).toBe(placeholders(en[k]!));
  });
  it("shows the demo banner wording the CEO asked for", () => {
    expect(en.demoBanner).toBe("Demo — no real charges");
  });
});
