import { describe, expect, it } from "vitest";
import { canMarkNoShow } from "./no-show";

const NOW = new Date("2026-10-26T10:00:00Z");
const PAST = "2026-10-26T09:00:00Z";
const FUTURE = "2026-10-26T11:00:00Z";

describe("canMarkNoShow", () => {
  it("allows a confirmed booking whose start has passed", () => {
    expect(canMarkNoShow({ status: "confirmed", starts_at: PAST }, NOW)).toBe(true);
  });
  it("allows a pending booking whose start has passed", () => {
    expect(canMarkNoShow({ status: "pending", starts_at: PAST }, NOW)).toBe(true);
  });
  it("refuses a booking that has not started yet", () => {
    expect(canMarkNoShow({ status: "confirmed", starts_at: FUTURE }, NOW)).toBe(false);
  });
  it("refuses completed, cancelled and already-no-show bookings", () => {
    for (const status of ["completed", "cancelled", "no_show"] as const) {
      expect(canMarkNoShow({ status, starts_at: PAST }, NOW)).toBe(false);
    }
  });
  it("allows it exactly at the start time", () => {
    expect(canMarkNoShow({ status: "confirmed", starts_at: NOW.toISOString() }, NOW)).toBe(true);
  });
});
