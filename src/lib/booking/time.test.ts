import { describe, expect, it } from "vitest";
import { formatMoney, formatSlotTime, minutesToSlotLabel } from "./time";

describe("formatMoney", () => {
  it("puts the baht sign in front for THB", () => {
    expect(formatMoney(1500)).toBe("฿1,500");
    expect(formatMoney(350.5, "THB")).toBe("฿350.50");
  });

  it("leaves other currencies to Intl", () => {
    expect(formatMoney(12, "USD")).toBe("$12");
  });
});

describe("formatSlotTime", () => {
  const iso = "2026-11-02T07:00:00Z"; // 14:00 in Bangkok

  it("uses the 24-hour clock in Thai and 12-hour in English", () => {
    expect(formatSlotTime(iso, "Asia/Bangkok", "th")).toBe("14:00");
    expect(formatSlotTime(iso, "Asia/Bangkok", "en")).toBe("2:00 PM");
  });

  it("formats minutes the same way", () => {
    expect(minutesToSlotLabel(13 * 60 + 30, "th")).toBe("13:30");
    expect(minutesToSlotLabel(13 * 60 + 30, "en")).toBe("1:30 PM");
  });
});
