import { describe, expect, it } from "vitest";
import { barbersToKeep, canAddBarber, FOUNDING, PER_BOOKING_FEE_SATANG, periodPriceSatang, PLANS } from "./plans";

describe("plans (decision 25)", () => {
  it("has the approved limits and prices, in satang", () => {
    expect([PLANS.free.priceSatang, PLANS.free.maxBarbers]).toEqual([0, 2]);
    expect([PLANS.pro.priceSatang, PLANS.pro.maxBarbers]).toEqual([49_000, 5]);
    expect([PLANS.studio.priceSatang, PLANS.studio.maxBarbers]).toEqual([99_000, 15]);
    expect(PLANS.free.paidExtras).toBe(false);
    expect(PER_BOOKING_FEE_SATANG).toBe(0);
  });
  it("founding Pro: 3 months free, 12 at THB 290, then list price", () => {
    const p = (i: number) => periodPriceSatang("pro", true, i);
    expect([p(0), p(1), p(2)]).toEqual([0, 0, 0]);
    expect(p(3)).toBe(29_000);
    expect(p(14)).toBe(29_000);
    expect(p(15)).toBe(49_000);
    expect(p(40)).toBe(49_000);
    expect(FOUNDING.freeMonths + FOUNDING.discountedMonths).toBe(15);
  });
  it("non-founding pays list from the start; founding is Pro only", () => {
    expect(periodPriceSatang("pro", false, 0)).toBe(49_000);
    expect(periodPriceSatang("studio", false, 5)).toBe(99_000);
    expect(() => periodPriceSatang("studio", true, 0)).toThrow();
    expect(() => periodPriceSatang("free", true, 0)).toThrow();
    expect(() => periodPriceSatang("pro", false, -1)).toThrow();
  });
  it("limits barbers by plan", () => {
    expect(canAddBarber("free", 1)).toBe(true);
    expect(canAddBarber("free", 2)).toBe(false);
    expect(canAddBarber("pro", 4)).toBe(true);
    expect(canAddBarber("pro", 5)).toBe(false);
    expect(canAddBarber("studio", 14)).toBe(true);
  });
  it("downgrade keeps the owner's choice, else the oldest", () => {
    const b = [
      { id: "c", createdAt: "2026-03-01" },
      { id: "a", createdAt: "2026-01-01" },
      { id: "b", createdAt: "2026-02-01" },
      { id: "d", createdAt: "2026-04-01" },
    ];
    expect(barbersToKeep(b, 2)).toEqual(["a", "b"]);
    expect(barbersToKeep(b, 2, ["d", "c"])).toEqual(["d", "c"]);
    expect(barbersToKeep(b, 2, ["d"])).toEqual(["d", "a"]);
    expect(barbersToKeep(b, 2, ["zzz"])).toEqual(["a", "b"]);
    expect(barbersToKeep(b.slice(0, 1), 2)).toEqual(["c"]);
  });
});

describe("founding cohort", () => {
  it("is capped at 20 and one use per business", async () => {
    const { foundingAvailable } = await import("./plans");
    expect(foundingAvailable({ everGranted: false, grantedCount: 19 })).toBe(true);
    expect(foundingAvailable({ everGranted: false, grantedCount: 20 })).toBe(false);
    expect(foundingAvailable({ everGranted: true, grantedCount: 0 })).toBe(false);
  });
});
