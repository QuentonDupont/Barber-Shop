import { addDays, differenceInCalendarDays } from "date-fns";
import { th as thDateLocale } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Locale } from "@/lib/i18n/dictionaries";

export const DEFAULT_TIMEZONE = "Asia/Bangkok";

/** `yyyy-MM-dd`, the canonical way a calendar day is passed around. */
export type DateKey = string;

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * `"09:00"`, `"09:00:00"` and `"09:00:00+07"` all mean 540 minutes past local
 * midnight. Postgres `time` columns come back in the second form.
 */
export function parseTimeToMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (!match) {
    throw new Error(`Not a time value: ${value}`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) {
    throw new Error(`Not a time value: ${value}`);
  }
  return hours * 60 + minutes;
}

/** 540 -> `"09:00"`. Used for writing back to Postgres `time` columns. */
export function minutesToTimeString(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 540 -> `"9:00 AM"`. What a human sees. */
export function minutesToDisplay(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * The instant at which the local wall clock on `date` reads `minutes` past
 * midnight, in `timezone`. This is the only place wall-clock becomes UTC.
 *
 * The wall-clock string is rebuilt and handed to `fromZonedTime` rather than
 * adding elapsed milliseconds to local midnight: on a daylight-saving boundary
 * the two disagree by an hour, because the clock jumps while real time does
 * not. Minutes at or beyond 1440 roll into the following date.
 */
export function zonedDayMinutesToUtc(
  date: DateKey,
  minutes: number,
  timezone: string,
): Date {
  const whole = Math.round(minutes);
  const dayOffset = Math.floor(whole / 1440);
  const within = whole - dayOffset * 1440;
  const day = dayOffset === 0 ? date : shiftDateKey(date, dayOffset);
  const hh = String(Math.floor(within / 60)).padStart(2, "0");
  const mm = String(within % 60).padStart(2, "0");
  return fromZonedTime(`${day}T${hh}:${mm}:00`, timezone);
}

/**
 * Wall-clock minutes between local midnight on `date` and `instant`, as read in
 * `timezone`. Can exceed 1440 (or go negative) when `instant` lands on another
 * day, which is how a booking running to the end of the day stays comparable
 * against a closing time instead of wrapping back round to 00:00.
 */
export function localMinutesFromMidnight(
  instant: Date,
  timezone: string,
  date: DateKey,
): number {
  const key = formatInTimeZone(instant, timezone, "yyyy-MM-dd");
  const clock = formatInTimeZone(instant, timezone, "HH:mm");
  return daysBetween(date, key) * 1440 + parseTimeToMinutes(clock);
}

/** The `yyyy-MM-dd` that `instant` falls on, as seen from `timezone`. */
export function toDateKey(instant: Date, timezone: string): DateKey {
  return formatInTimeZone(instant, timezone, "yyyy-MM-dd");
}

/** Today in the business's timezone, not the viewer's. */
export function businessToday(timezone: string, now: Date = new Date()): DateKey {
  return toDateKey(now, timezone);
}

/**
 * 0 = Sunday … 6 = Saturday.
 *
 * No timezone argument: the weekday of a calendar date is the same everywhere.
 * Reading it at noon UTC keeps it away from any offset that could tip the date.
 */
export function weekdayOf(date: DateKey): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** Calendar days between two `yyyy-MM-dd` keys; negative if `to` is earlier. */
export function daysBetween(from: DateKey, to: DateKey): number {
  return differenceInCalendarDays(
    new Date(`${to}T12:00:00Z`),
    new Date(`${from}T12:00:00Z`),
  );
}

/** Shift a `yyyy-MM-dd` key by whole days without touching timezones. */
export function shiftDateKey(date: DateKey, days: number): DateKey {
  return formatInTimeZone(addDays(new Date(`${date}T12:00:00Z`), days), "UTC", "yyyy-MM-dd");
}

/**
 * `formatInTimeZone` with the app's house formats.
 *
 * `locale` is optional and defaults to English formatting (no behaviour
 * change for the many existing call sites that don't pass it yet — mostly
 * the owner dashboard, not translated in this pass, see handoff 02). Pass
 * the active locale explicitly at a call site that has already switched to
 * `useT()`/`getLocale()`, so month and day names come out in Thai there
 * without silently flipping dashboard screens that haven't been touched.
 */
export function formatInBusinessTz(
  instant: Date | string,
  timezone: string,
  pattern: string,
  locale: Locale = "en",
): string {
  return formatInTimeZone(
    typeof instant === "string" ? new Date(instant) : instant,
    timezone,
    pattern,
    locale === "th" ? { locale: thDateLocale } : undefined,
  );
}

export function formatMoney(amount: number, currency = "THB"): string {
  const rounded = Math.round(Number(amount) * 100) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(rounded);
  } catch {
    return `${rounded} ${currency}`;
  }
}

/** "1 hr 30 min" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
