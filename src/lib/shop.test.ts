import { describe, expect, it } from "vitest";
import { formatCampaignWhen } from "./shop";

// Handoff 07: formatCampaignWhen was hard-coded to en-GB regardless of the
// active locale (flagged while merging stream T's dashboard translation with
// stream P's PDPA work). Fixed to use the same formatInBusinessTz + date-fns
// `th` locale convention booking dates already use (src/lib/booking/time.ts),
// not an Intl `th-TH` Buddhist-calendar format — this app has no Buddhist-era
// convention anywhere else, so introducing one here would be inconsistent.
describe("formatCampaignWhen", () => {
  const TZ = "Asia/Bangkok";

  it("defaults to English when no locale is passed (no behaviour change for untouched call sites)", () => {
    const event = { kind: "event" as const, starts_at: "2026-09-12T11:00:00Z", ends_at: null };
    expect(formatCampaignWhen(event, TZ)).toBe("Sat 12 Sep · 18:00");
  });

  it("renders an event's weekday/month in Thai when locale is th", () => {
    const event = { kind: "event" as const, starts_at: "2026-09-12T11:00:00Z", ends_at: null };
    const th = formatCampaignWhen(event, TZ, "th");
    expect(th).not.toContain("Sat");
    expect(th).toContain("18:00");
  });

  it("renders a dated sale range in both locales", () => {
    const sale = {
      kind: "sale" as const,
      starts_at: "2026-09-12T00:00:00Z",
      ends_at: "2026-09-19T00:00:00Z",
    };
    expect(formatCampaignWhen(sale, TZ)).toBe("12 Sep – 19 Sep");
    expect(formatCampaignWhen(sale, TZ, "th")).not.toContain("Sep");
  });

  it("translates the open-ended 'From' prefix", () => {
    const sale = { kind: "sale" as const, starts_at: "2026-09-12T00:00:00Z", ends_at: null };
    expect(formatCampaignWhen(sale, TZ)).toBe("From Sat 12 Sep");
    expect(formatCampaignWhen(sale, TZ, "th")).toContain("เริ่ม");
  });
});
