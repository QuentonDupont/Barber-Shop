import type { BookingRow } from "@/lib/database.types";
import { shiftDateKey, toDateKey, weekdayOf, type DateKey } from "@/lib/booking/time";

/**
 * Weekly numbers for one shop, the owner-facing twin of the SQL views
 * `beta_weekly_shop_metrics` / `beta_weekly_totals`
 * (supabase/migrations/20261026000000_beta_ops.sql). Keep the definitions in step:
 *
 *  - week: Monday-start, in the shop's own timezone, by appointment time
 *  - bookings: everything except cancelled
 *  - customer_booked / shop_entered: by `source`, cancelled excluded
 *  - no-show rate: no_shows / (completed + no_shows), null when neither
 *  - weekly-active: at least 3 customer-booked bookings in the week
 *    (operations-plan.md §4; shop-entered bookings never count)
 */
export const WEEKLY_ACTIVE_THRESHOLD = 3;

export type WeeklyBooking = Pick<BookingRow, "starts_at" | "status" | "source">;

export interface WeeklyMetrics {
  /** Monday of the week, `yyyy-MM-dd` in the shop's timezone. */
  weekStart: DateKey;
  bookingsTotal: number;
  customerBooked: number;
  shopEntered: number;
  completed: number;
  noShows: number;
  cancelled: number;
  /** 0..1, or null when nothing has finished yet. */
  noShowRate: number | null;
  isWeeklyActive: boolean;
}

/** The Monday on or before `date`. */
export function weekStartKey(date: DateKey): DateKey {
  const sinceMonday = (weekdayOf(date) + 6) % 7;
  return shiftDateKey(date, -sinceMonday);
}

function emptyWeek(weekStart: DateKey): WeeklyMetrics {
  return {
    weekStart,
    bookingsTotal: 0,
    customerBooked: 0,
    shopEntered: 0,
    completed: 0,
    noShows: 0,
    cancelled: 0,
    noShowRate: null,
    isWeeklyActive: false,
  };
}

/**
 * The last `weeks` weeks (including the current one), newest first, with
 * empty weeks present as zeros so the table never has gaps.
 */
export function computeWeeklyMetrics(
  bookings: WeeklyBooking[],
  timezone: string,
  { weeks = 8, now = new Date() }: { weeks?: number; now?: Date } = {},
): WeeklyMetrics[] {
  const thisWeek = weekStartKey(toDateKey(now, timezone));
  const byWeek = new Map<DateKey, WeeklyMetrics>();
  for (let i = 0; i < weeks; i += 1) {
    const key = shiftDateKey(thisWeek, -7 * i);
    byWeek.set(key, emptyWeek(key));
  }

  for (const b of bookings) {
    const row = byWeek.get(weekStartKey(toDateKey(new Date(b.starts_at), timezone)));
    if (!row) continue; // outside the window

    if (b.status === "cancelled") {
      row.cancelled += 1;
      continue;
    }
    row.bookingsTotal += 1;
    if (b.source === "shop") row.shopEntered += 1;
    else row.customerBooked += 1;
    if (b.status === "completed") row.completed += 1;
    if (b.status === "no_show") row.noShows += 1;
  }

  const out = [...byWeek.values()];
  for (const row of out) {
    const finished = row.completed + row.noShows;
    row.noShowRate = finished > 0 ? row.noShows / finished : null;
    row.isWeeklyActive = row.customerBooked >= WEEKLY_ACTIVE_THRESHOLD;
  }
  return out; // insertion order is already newest first
}

/** First instant of the oldest week in the window, for the database query. */
export function windowStartKey(timezone: string, weeks = 8, now: Date = new Date()): DateKey {
  return shiftDateKey(weekStartKey(toDateKey(now, timezone)), -7 * (weeks - 1));
}
