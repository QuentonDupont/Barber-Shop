import { describe, expect, it } from "vitest";
import { findSlot, getAvailableSlots, getDayAvailability } from "./slots";
import type { GetAvailableSlotsInput } from "./slots";
import { parseTimeToMinutes, minutesToDisplay, weekdayOf } from "./time";

const BKK = "Asia/Bangkok";

// 2026-03-16 is a Monday; 2026-03-15 a Sunday.
const MONDAY = "2026-03-16";
const SUNDAY = "2026-03-15";

/** "now" pinned well before opening so notice rules never fire by accident. */
const NOW = new Date("2026-03-16T00:00:00+07:00");

const WEEK_9_TO_5 = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  open_time: "09:00:00",
  close_time: "17:00:00",
  is_closed: weekday === 0, // closed Sundays
}));

function input(overrides: Partial<GetAvailableSlotsInput> = {}): GetAvailableSlotsInput {
  return {
    date: MONDAY,
    rules: {
      timezone: BKK,
      slotIntervalMin: 15,
      minNoticeMin: 0,
      maxAdvanceDays: 60,
    },
    serviceDurationMin: 60,
    hours: WEEK_9_TO_5,
    now: NOW,
    ...overrides,
  };
}

describe("time helpers", () => {
  it("parses postgres time values", () => {
    expect(parseTimeToMinutes("09:00")).toBe(540);
    expect(parseTimeToMinutes("09:00:00")).toBe(540);
    expect(parseTimeToMinutes("13:45:00+07")).toBe(825);
  });

  it("renders 12-hour labels", () => {
    expect(minutesToDisplay(0)).toBe("12:00 AM");
    expect(minutesToDisplay(540)).toBe("9:00 AM");
    expect(minutesToDisplay(720)).toBe("12:00 PM");
    expect(minutesToDisplay(1035)).toBe("5:15 PM");
  });

  it("reads weekdays off a date key", () => {
    expect(weekdayOf(SUNDAY)).toBe(0);
    expect(weekdayOf(MONDAY)).toBe(1);
  });
});

describe("getAvailableSlots — the happy path", () => {
  it("offers every interval that fits inside opening hours", () => {
    const slots = getAvailableSlots(input());
    // 09:00 → 17:00 is 480 min; a 60 min service fits from 09:00 to 16:00,
    // every 15 min => 29 starts.
    expect(slots).toHaveLength(29);
    expect(slots[0]?.label).toBe("9:00 AM");
    expect(slots.at(-1)?.label).toBe("4:00 PM");
  });

  it("never offers a slot that would run past closing", () => {
    const slots = getAvailableSlots(input({ serviceDurationMin: 90 }));
    expect(slots.at(-1)?.label).toBe("3:30 PM");
    for (const slot of slots) {
      expect(new Date(slot.endsAt).getTime()).toBeLessThanOrEqual(
        new Date(`${MONDAY}T17:00:00+07:00`).getTime(),
      );
    }
  });

  it("counts the service buffer as occupied time", () => {
    const withBuffer = getAvailableSlots(
      input({ serviceDurationMin: 60, bufferMin: 30 }),
    );
    // 90 minutes of occupancy: last start is 15:30.
    expect(withBuffer.at(-1)?.label).toBe("3:30 PM");
  });

  it("honours a coarser slot interval", () => {
    const slots = getAvailableSlots(
      input({ rules: { ...input().rules, slotIntervalMin: 60 } }),
    );
    expect(slots.map((s) => s.label)).toEqual([
      "9:00 AM",
      "10:00 AM",
      "11:00 AM",
      "12:00 PM",
      "1:00 PM",
      "2:00 PM",
      "3:00 PM",
      "4:00 PM",
    ]);
  });
});

describe("getAvailableSlots — closures", () => {
  it("returns nothing on a weekly closed day", () => {
    const day = getDayAvailability(input({ date: SUNDAY, now: new Date("2026-03-15T00:00:00+07:00") }));
    expect(day.isOpen).toBe(false);
    expect(day.closedReason).toBe("weekly_closed");
    expect(day.slots).toEqual([]);
  });

  it("returns nothing when an override closes the day", () => {
    const day = getDayAvailability(
      input({ override: { is_closed: true, open_time: null, close_time: null } }),
    );
    expect(day.closedReason).toBe("override_closed");
    expect(day.slots).toEqual([]);
  });

  it("lets an override widen a normally closed day", () => {
    const day = getDayAvailability(
      input({
        date: SUNDAY,
        now: new Date("2026-03-15T00:00:00+07:00"),
        override: { is_closed: false, open_time: "12:00:00", close_time: "15:00:00" },
      }),
    );
    expect(day.isOpen).toBe(true);
    expect(day.slots[0]?.label).toBe("12:00 PM");
    expect(day.slots.at(-1)?.label).toBe("2:00 PM");
  });

  it("lets an override narrow an open day and beats the weekly template", () => {
    const day = getDayAvailability(
      input({ override: { is_closed: false, open_time: "14:00:00", close_time: "16:00:00" } }),
    );
    expect(day.openMinute).toBe(840);
    expect(day.slots[0]?.label).toBe("2:00 PM");
    expect(day.slots.at(-1)?.label).toBe("3:00 PM");
  });

  it("refuses dates in the past", () => {
    const day = getDayAvailability(input({ date: "2026-03-01" }));
    expect(day.closedReason).toBe("past_date");
  });

  it("refuses dates beyond the booking horizon", () => {
    const day = getDayAvailability(input({ date: "2026-09-01" }));
    expect(day.closedReason).toBe("beyond_horizon");
  });

  it("returns no slots when the service is longer than the open window", () => {
    const day = getDayAvailability(input({ serviceDurationMin: 600 }));
    expect(day.isOpen).toBe(true);
    expect(day.slots).toEqual([]);
  });
});

describe("getAvailableSlots — breaks", () => {
  const lunch = [{ weekday: 1, start_time: "12:00:00", end_time: "13:00:00" }];

  it("removes every start that would run through lunch", () => {
    const labels = getAvailableSlots(input({ breaks: lunch })).map((s) => s.label);
    // A 60 min service starting 11:15 would still be running at 12:00.
    expect(labels).not.toContain("11:15 AM");
    expect(labels).not.toContain("12:00 PM");
    expect(labels).not.toContain("12:45 PM");
    // 11:00–12:00 ends exactly as lunch starts, so it survives.
    expect(labels).toContain("11:00 AM");
    // 13:00 is the first start after lunch.
    expect(labels).toContain("1:00 PM");
  });

  it("ignores breaks belonging to another weekday", () => {
    const labels = getAvailableSlots(
      input({ breaks: [{ weekday: 3, start_time: "12:00:00", end_time: "13:00:00" }] }),
    ).map((s) => s.label);
    expect(labels).toContain("12:00 PM");
  });

  it("handles several breaks in one day", () => {
    const labels = getAvailableSlots(
      input({
        serviceDurationMin: 30,
        breaks: [
          { weekday: 1, start_time: "10:00:00", end_time: "10:30:00" },
          { weekday: 1, start_time: "12:00:00", end_time: "13:00:00" },
        ],
      }),
    ).map((s) => s.label);
    expect(labels).not.toContain("10:00 AM");
    expect(labels).not.toContain("12:30 PM");
    expect(labels).toContain("9:30 AM");
    expect(labels).toContain("10:30 AM");
  });
});

describe("getAvailableSlots — existing bookings", () => {
  it("removes slots overlapping a booking", () => {
    const labels = getAvailableSlots(
      input({
        serviceDurationMin: 30,
        busy: [
          {
            starts_at: `${MONDAY}T10:00:00+07:00`,
            ends_at: `${MONDAY}T11:00:00+07:00`,
          },
        ],
      }),
    ).map((s) => s.label);

    expect(labels).not.toContain("10:00 AM");
    expect(labels).not.toContain("10:30 AM");
    expect(labels).toContain("9:30 AM");
    expect(labels).toContain("11:00 AM");
  });

  it("treats touching intervals as free, not as an overlap", () => {
    const labels = getAvailableSlots(
      input({
        serviceDurationMin: 60,
        busy: [
          {
            starts_at: `${MONDAY}T10:00:00+07:00`,
            ends_at: `${MONDAY}T11:00:00+07:00`,
          },
        ],
      }),
    ).map((s) => s.label);
    expect(labels).toContain("9:00 AM");
    expect(labels).toContain("11:00 AM");
    expect(labels).not.toContain("9:30 AM");
  });

  it("ignores bookings on other days", () => {
    const labels = getAvailableSlots(
      input({
        busy: [
          {
            starts_at: "2026-03-17T10:00:00+07:00",
            ends_at: "2026-03-17T11:00:00+07:00",
          },
        ],
      }),
    ).map((s) => s.label);
    expect(labels).toContain("10:00 AM");
  });
});

describe("getAvailableSlots — notice and horizon", () => {
  it("drops slots inside the minimum notice window", () => {
    const labels = getAvailableSlots(
      input({
        now: new Date(`${MONDAY}T09:10:00+07:00`),
        rules: { ...input().rules, minNoticeMin: 60 },
      }),
    ).map((s) => s.label);

    // Earliest bookable start is 10:10, so 10:15 is the first slot on the grid.
    expect(labels[0]).toBe("10:15 AM");
  });

  it("keeps the whole day available when notice is zero", () => {
    const labels = getAvailableSlots(
      input({ now: new Date(`${MONDAY}T00:00:00+07:00`) }),
    ).map((s) => s.label);
    expect(labels[0]).toBe("9:00 AM");
  });
});

describe("timezone correctness", () => {
  it("produces the same Bangkok slots no matter where the server clock sits", () => {
    const fromBangkok = getAvailableSlots(input());
    const fromLondon = getAvailableSlots(
      input({ now: new Date("2026-03-15T17:00:00Z") }), // still 2026-03-16 in BKK
    );
    expect(fromLondon.map((s) => s.startsAt)).toEqual(
      fromBangkok.map((s) => s.startsAt),
    );
  });

  it("emits UTC instants that match the business wall clock", () => {
    const [first] = getAvailableSlots(input());
    // 09:00 in Bangkok (UTC+7) is 02:00 UTC.
    expect(first?.startsAt).toBe("2026-03-16T02:00:00.000Z");
    expect(first?.endsAt).toBe("2026-03-16T03:00:00.000Z");
  });

  it("respects a timezone that observes daylight saving", () => {
    // 2026-03-29 is the UK clock change: 01:00 GMT becomes 02:00 BST.
    const slots = getAvailableSlots(
      input({
        date: "2026-03-29",
        now: new Date("2026-03-29T00:00:00Z"),
        rules: {
          timezone: "Europe/London",
          slotIntervalMin: 60,
          minNoticeMin: 0,
          maxAdvanceDays: 60,
        },
        hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          open_time: "09:00:00",
          close_time: "17:00:00",
          is_closed: false,
        })),
      }),
    );
    // 09:00 local on that Sunday is 08:00 UTC, because BST is already in force.
    expect(slots[0]?.startsAt).toBe("2026-03-29T08:00:00.000Z");
    expect(slots[0]?.label).toBe("9:00 AM");
  });
});

describe("findSlot — the server-side gate", () => {
  it("accepts an instant the engine actually offers", () => {
    expect(findSlot(input(), "2026-03-16T02:00:00.000Z")).not.toBeNull();
  });

  it("rejects an instant off the interval grid", () => {
    expect(findSlot(input(), "2026-03-16T02:07:00.000Z")).toBeNull();
  });

  it("rejects a slot that is blocked by a break", () => {
    const withLunch = input({
      breaks: [{ weekday: 1, start_time: "12:00:00", end_time: "13:00:00" }],
    });
    // 12:00 Bangkok == 05:00 UTC
    expect(findSlot(withLunch, "2026-03-16T05:00:00.000Z")).toBeNull();
  });

  it("rejects a slot that is already booked", () => {
    const taken = input({
      busy: [
        { starts_at: `${MONDAY}T09:00:00+07:00`, ends_at: `${MONDAY}T10:00:00+07:00` },
      ],
    });
    expect(findSlot(taken, "2026-03-16T02:00:00.000Z")).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(findSlot(input(), "not-a-date")).toBeNull();
  });
});
