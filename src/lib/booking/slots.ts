import type {
  AvailabilityOverrideRow,
  BusinessBreakRow,
  BusinessHoursRow,
} from "@/lib/database.types";
import {
  type DateKey,
  daysBetween,
  localMinutesFromMidnight,
  minutesToDisplay,
  parseTimeToMinutes,
  toDateKey,
  weekdayOf,
  zonedDayMinutesToUtc,
} from "./time";

/**
 * A stretch of the day that is already spoken for. Existing bookings arrive in
 * this shape so the engine never has to know what a booking is.
 */
export interface BusyInterval {
  starts_at: string | Date;
  ends_at: string | Date;
}

export interface AvailabilityRules {
  timezone: string;
  /** Offered start times land on multiples of this many minutes. */
  slotIntervalMin: number;
  /** A slot starting sooner than `now + minNoticeMin` is not offered. */
  minNoticeMin: number;
  /** How far ahead the calendar is open. */
  maxAdvanceDays: number;
}

export interface GetAvailableSlotsInput {
  date: DateKey;
  rules: AvailabilityRules;
  /** How long the customer occupies the business, including any clean-up. */
  serviceDurationMin: number;
  bufferMin?: number;
  /** The weekly template. Rows for other weekdays are ignored. */
  hours: Pick<BusinessHoursRow, "weekday" | "open_time" | "close_time" | "is_closed">[];
  breaks?: Pick<BusinessBreakRow, "weekday" | "start_time" | "end_time">[];
  /** The override for `date`, if the business set one. */
  override?: Pick<
    AvailabilityOverrideRow,
    "is_closed" | "open_time" | "close_time"
  > | null;
  /** Bookings that hold a slot (pending or confirmed). */
  busy?: BusyInterval[];
  now?: Date;
}

export interface Slot {
  /** ISO 8601 UTC instant — what gets written to the database. */
  startsAt: string;
  endsAt: string;
  /** Minutes past local midnight; handy for rendering and for tests. */
  startMinute: number;
  /** e.g. `"9:30 AM"`, already in the business's timezone. */
  label: string;
}

export type DayClosedReason =
  | "override_closed"
  | "weekly_closed"
  | "past_date"
  | "beyond_horizon";

export interface DayAvailability {
  date: DateKey;
  isOpen: boolean;
  closedReason?: DayClosedReason;
  /** Local opening window, in minutes past midnight. */
  openMinute?: number;
  closeMinute?: number;
  slots: Slot[];
}

interface Window {
  startMinute: number;
  endMinute: number;
}

function toMs(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function overlaps(a: Window, b: Window): boolean {
  return a.startMinute < b.endMinute && a.endMinute > b.startMinute;
}

/**
 * Resolve the opening window for one date: a same-day override wins outright
 * over the weekly template, which is what makes holidays and one-off late
 * openings work.
 */
function resolveOpeningWindow(
  input: GetAvailableSlotsInput,
): { window: Window } | { closedReason: DayClosedReason } {
  const { override, hours, date } = input;

  if (override) {
    if (override.is_closed || !override.open_time || !override.close_time) {
      return { closedReason: "override_closed" };
    }
    return {
      window: {
        startMinute: parseTimeToMinutes(override.open_time),
        endMinute: parseTimeToMinutes(override.close_time),
      },
    };
  }

  const weekday = weekdayOf(date);
  const row = hours.find((h) => h.weekday === weekday);
  if (!row || row.is_closed) {
    return { closedReason: "weekly_closed" };
  }

  return {
    window: {
      startMinute: parseTimeToMinutes(row.open_time),
      endMinute: parseTimeToMinutes(row.close_time),
    },
  };
}

/**
 * Every bookable start time on `date`, in the business's timezone.
 *
 * Pure: the only ambient input is `now`, which the caller may pin. The result
 * is derived from opening hours, minus breaks, minus overrides, minus anything
 * already booked, minus the notice and horizon policy.
 */
export function getDayAvailability(input: GetAvailableSlotsInput): DayAvailability {
  const { date, rules, serviceDurationMin } = input;
  const now = input.now ?? new Date();
  const bufferMin = input.bufferMin ?? 0;
  const occupyMin = serviceDurationMin + bufferMin;

  const today = toDateKey(now, rules.timezone);
  const offset = daysBetween(today, date);

  if (offset < 0) {
    return { date, isOpen: false, closedReason: "past_date", slots: [] };
  }
  if (offset > rules.maxAdvanceDays) {
    return { date, isOpen: false, closedReason: "beyond_horizon", slots: [] };
  }

  const resolved = resolveOpeningWindow(input);
  if ("closedReason" in resolved) {
    return { date, isOpen: false, closedReason: resolved.closedReason, slots: [] };
  }

  const { startMinute: openMinute, endMinute: closeMinute } = resolved.window;
  const base: Omit<DayAvailability, "slots"> = {
    date,
    isOpen: true,
    openMinute,
    closeMinute,
  };

  if (occupyMin <= 0 || openMinute + occupyMin > closeMinute) {
    // The service cannot fit in the day at all.
    return { ...base, slots: [] };
  }

  const weekday = weekdayOf(date);
  const breakWindows: Window[] = (input.breaks ?? [])
    .filter((b) => b.weekday === weekday)
    .map((b) => ({
      startMinute: parseTimeToMinutes(b.start_time),
      endMinute: parseTimeToMinutes(b.end_time),
    }));

  // Existing bookings are compared as absolute instants. Projecting them onto
  // local minutes would drift by an hour across a daylight-saving boundary.
  const busySpans = (input.busy ?? []).map((b) => ({
    start: toMs(b.starts_at),
    end: toMs(b.ends_at),
  }));

  const earliestMs = now.getTime() + rules.minNoticeMin * 60_000;
  const step = Math.max(1, rules.slotIntervalMin);
  const slots: Slot[] = [];

  // Start times sit on an interval grid measured from opening time, so a 09:00
  // open with a 15 minute interval offers 09:00, 09:15, 09:30 …
  //
  // `occupyMin` is real elapsed time (a 60 minute haircut takes an hour of the
  // chair), so the end instant is derived by adding it to the start instant and
  // the local end minute is read back off that instant.
  for (let startMinute = openMinute; startMinute < closeMinute; startMinute += step) {
    const startsAt = zonedDayMinutesToUtc(date, startMinute, rules.timezone);
    const endsAt = new Date(startsAt.getTime() + occupyMin * 60_000);
    const endMinute = localMinutesFromMidnight(endsAt, rules.timezone, date);

    // Monotonic in `startMinute`, so the first overrun ends the day.
    if (endMinute > closeMinute) break;

    const candidate: Window = { startMinute, endMinute };

    if (breakWindows.some((w) => overlaps(candidate, w))) continue;

    const startMs = startsAt.getTime();
    const endMs = endsAt.getTime();
    if (busySpans.some((b) => startMs < b.end && endMs > b.start)) continue;

    if (startMs < earliestMs) continue;

    slots.push({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      startMinute,
      label: minutesToDisplay(startMinute),
    });
  }

  return { ...base, slots };
}

/** Convenience wrapper matching the name used across the app. */
export function getAvailableSlots(input: GetAvailableSlotsInput): Slot[] {
  return getDayAvailability(input).slots;
}

/**
 * Server-side gate. Never trust the start time a client posts: recompute the
 * day and confirm the requested instant is genuinely on offer.
 */
export function findSlot(
  input: GetAvailableSlotsInput,
  requestedStartsAtIso: string,
): Slot | null {
  const requested = new Date(requestedStartsAtIso).getTime();
  if (Number.isNaN(requested)) return null;
  return (
    getDayAvailability(input).slots.find(
      (slot) => new Date(slot.startsAt).getTime() === requested,
    ) ?? null
  );
}

/**
 * Which days in a range have at least one slot — this is what greys out dates
 * in the customer-facing calendar.
 */
export function summariseDays(
  dates: DateKey[],
  build: (date: DateKey) => GetAvailableSlotsInput,
): Record<DateKey, boolean> {
  const out: Record<DateKey, boolean> = {};
  for (const date of dates) {
    out[date] = getDayAvailability(build(date)).slots.length > 0;
  }
  return out;
}
