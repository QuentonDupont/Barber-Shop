import { describe, expect, it } from "vitest";
import { addDays, addMonths, bangkokDate, daysBetween, startOfBangkokDay } from "./time";

describe("Asia/Bangkok dates", () => {
  it("rolls to the next Bangkok day at 17:00Z", () => {
    expect(bangkokDate(new Date("2026-01-30T16:59:59Z"))).toBe("2026-01-30");
    expect(bangkokDate(new Date("2026-01-30T17:00:00Z"))).toBe("2026-01-31");
    expect(bangkokDate(new Date("2026-01-30T17:30:00Z"))).toBe("2026-01-31");
  });
  it("day starts are 17:00Z the evening before", () => {
    expect(startOfBangkokDay("2026-04-25").toISOString()).toBe("2026-04-24T17:00:00.000Z");
  });
  it("keeps the anchor day with no drift", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-03", 3)).toBe("2027-02-03");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
  it("adds and counts days across month ends", () => {
    expect(addDays("2026-02-27", 3)).toBe("2026-03-02");
    expect(daysBetween("2026-02-27", "2026-03-02")).toBe(3);
  });
  it("rejects junk", () => {
    expect(() => addDays("03/11/2026", 1)).toThrow();
  });
});
