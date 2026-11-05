import { describe, expect, it } from "vitest";
import { dictionaries } from "./dictionaries";
import { PLANS } from "../about";

// About page (tatnat-accounts-billing stage 1): same keys and placeholders in both
// languages, Thai side really Thai, and the plan numbers match decisions #24/#25.
const th = (dictionaries.th as Record<string, Record<string, string>>).about!;
const en = (dictionaries.en as Record<string, Record<string, string>>).about!;
const THAI = /[฀-๿]/;

describe("about strings", () => {
  it("has identical keys in both languages", () => {
    expect(Object.keys(th).sort()).toEqual(Object.keys(en).sort());
  });

  it("is Thai on the Thai side (plan and brand names aside)", () => {
    for (const [key, value] of Object.entries(th)) {
      const rest = value.replace(/\{\w+\}|TatNat|Pro|Studio|LINE|Instagram|Facebook/g, "");
      if (/[A-Za-z]{2,}/.test(rest)) expect(THAI.test(value), `about.${key}: ${value}`).toBe(true);
    }
  });

  it("keeps the same placeholders", () => {
    for (const key of Object.keys(th)) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(th[key]!), key).toEqual(ph(en[key]!));
    }
  });

  it("states the approved plans and the no-sale notice", () => {
    expect(PLANS.map((p) => [p.pricePerMonth, p.barbers])).toEqual([[0, 2], [490, 5], [990, 15]]);
    expect(en.plansNotice).toMatch(/not on sale yet/i);
    expect(th.plansNotice).toContain("ยังไม่เปิดให้ซื้อ");
    expect(en.neverCut).toBe("Free to start. We never take a cut of your bookings.");
  });

  it("never uses the banned promises", () => {
    const all = [...Object.values(th), ...Object.values(en)].join("\n");
    expect(all).not.toMatch(/free forever|zero cost|no commission ever|ฟรีตลอดไป/i);
  });
});
