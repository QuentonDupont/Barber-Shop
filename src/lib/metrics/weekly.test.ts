import { describe, expect, it } from "vitest";
import {
  computeWeeklyMetrics as compute,
  weekStartKey,
  type WeeklyBooking,
  type WeeklyMetrics,
} from "./weekly";

/** Same function, typed as non-empty so tests can index [0] under strict flags. */
const computeWeeklyMetrics = (...args: Parameters<typeof compute>) =>
  compute(...args) as [WeeklyMetrics, ...WeeklyMetrics[]];

const TZ = "Asia/Bangkok";
// Wednesday 2026-10-28 noon Bangkok; its week starts Monday 2026-10-26.
const NOW = new Date("2026-10-28T05:00:00Z");

const b = (
  starts_at: string,
  status: WeeklyBooking["status"] = "confirmed",
  source: WeeklyBooking["source"] = "customer",
): WeeklyBooking => ({ starts_at, status, source });

describe("weekStartKey", () => {
  it("returns the Monday on or before a date", () => {
    expect(weekStartKey("2026-10-26")).toBe("2026-10-26"); // Monday
    expect(weekStartKey("2026-10-28")).toBe("2026-10-26"); // Wednesday
    expect(weekStartKey("2026-11-01")).toBe("2026-10-26"); // Sunday belongs to the old week
  });
});

describe("computeWeeklyMetrics", () => {
  it("returns exactly N weeks, newest first, with empty weeks as zeros", () => {
    const out = computeWeeklyMetrics([], TZ, { weeks: 8, now: NOW });
    expect(out).toHaveLength(8);
    expect(out[0].weekStart).toBe("2026-10-26");
    expect(out[7]?.weekStart).toBe("2026-09-07");
    expect(out.every((w) => w.bookingsTotal === 0 && w.noShowRate === null && !w.isWeeklyActive)).toBe(true);
  });

  it("splits customer-booked from shop-entered and leaves cancelled out of both", () => {
    const [week] = computeWeeklyMetrics(
      [
        b("2026-10-27T03:00:00Z"),
        b("2026-10-27T04:00:00Z", "confirmed", "shop"),
        b("2026-10-27T05:00:00Z", "cancelled"),
        b("2026-10-27T06:00:00Z", "cancelled", "shop"),
      ],
      TZ,
      { now: NOW },
    );
    expect(week.customerBooked).toBe(1);
    expect(week.shopEntered).toBe(1);
    expect(week.bookingsTotal).toBe(2);
    expect(week.cancelled).toBe(2);
  });

  it("counts no-shows and completed, and the rate is no_show / (completed + no_show)", () => {
    const [week] = computeWeeklyMetrics(
      [
        b("2026-10-26T03:00:00Z", "completed"),
        b("2026-10-26T04:00:00Z", "completed"),
        b("2026-10-26T05:00:00Z", "completed"),
        b("2026-10-26T06:00:00Z", "no_show"),
        b("2026-10-27T06:00:00Z", "confirmed"), // not finished: not in the rate
      ],
      TZ,
      { now: NOW },
    );
    expect(week.completed).toBe(3);
    expect(week.noShows).toBe(1);
    expect(week.noShowRate).toBeCloseTo(0.25);
  });

  it("gives a null rate, not 0, when nothing has finished", () => {
    const [week] = computeWeeklyMetrics([b("2026-10-27T03:00:00Z")], TZ, { now: NOW });
    expect(week.noShowRate).toBeNull();
  });

  it("is weekly-active at 3 customer bookings, never from shop-entered ones", () => {
    const three = [1, 2, 3].map((h) => b(`2026-10-27T0${h}:00:00Z`));
    const twoPlusShop = [
      b("2026-10-27T01:00:00Z"),
      b("2026-10-27T02:00:00Z"),
      ...[3, 4, 5, 6, 7].map((h) => b(`2026-10-27T0${h}:00:00Z`, "confirmed", "shop")),
    ];
    expect(computeWeeklyMetrics(three, TZ, { now: NOW })[0].isWeeklyActive).toBe(true);
    expect(computeWeeklyMetrics(twoPlusShop, TZ, { now: NOW })[0].isWeeklyActive).toBe(false);
  });

  it("buckets by the shop's timezone: Sunday 23:30 Bangkok is still the old week", () => {
    // 2026-11-01 23:30 Bangkok = 16:30Z Sunday -> week of 2026-10-26.
    // 2026-11-02 00:30 Bangkok = 17:30Z Sunday (UTC) -> week of 2026-11-02 in Bangkok.
    const later = new Date("2026-11-03T05:00:00Z");
    const out = computeWeeklyMetrics(
      [b("2026-11-01T16:30:00Z"), b("2026-11-01T17:30:00Z")],
      TZ,
      { now: later },
    );
    expect(out[0].weekStart).toBe("2026-11-02");
    expect(out[0].bookingsTotal).toBe(1);
    expect(out[1]?.weekStart).toBe("2026-10-26");
    expect(out[1]?.bookingsTotal).toBe(1);
  });

  it("ignores bookings outside the window", () => {
    const out = computeWeeklyMetrics([b("2025-01-01T03:00:00Z"), b("2027-01-01T03:00:00Z")], TZ, { now: NOW });
    expect(out.reduce((n, w) => n + w.bookingsTotal, 0)).toBe(0);
  });
});
