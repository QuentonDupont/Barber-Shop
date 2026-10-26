import { describe, expect, it } from "vitest";
import { dictionaries } from "./dictionaries";

// Handoff 10: the strings added for the beta-ops screens must exist in both
// languages, and the Thai ones must really be Thai (Thai-first company rule).
const NEW_KEYS: [string, string][] = [
  ["nav", "numbers"],
  ...[
    "noShowQuick",
    "undoNoShow",
    "errorNoShowTooEarly",
    "sourceLabel",
    "sourceCustomer",
    "sourceShop",
  ].map((k): [string, string] => ["bookingAdmin", k]),
  ...[
    "title",
    "subtitle",
    "weekOf",
    "thisWeek",
    "bookings",
    "customerBooked",
    "shopEntered",
    "completed",
    "noShows",
    "cancelled",
    "noShowRate",
    "noShowRateNone",
    "activeYes",
    "activeNo",
    "activeRule",
    "rateRule",
    "empty",
  ].map((k): [string, string] => ["numbers", k]),
];

const lookup = (locale: "th" | "en", section: string, key: string): unknown =>
  (dictionaries[locale] as unknown as Record<string, Record<string, unknown>>)[section]?.[key];

describe("beta-ops strings", () => {
  it.each(NEW_KEYS)("%s.%s exists in th and en", (section, key) => {
    expect(typeof lookup("th", section, key)).toBe("string");
    expect(typeof lookup("en", section, key)).toBe("string");
  });

  it.each(NEW_KEYS)("%s.%s is written in Thai script in th", (section, key) => {
    expect(String(lookup("th", section, key))).toMatch(/[฀-๿]/);
  });
});
