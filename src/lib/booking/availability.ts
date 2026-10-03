import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, BusinessRow, ServiceRow } from "@/lib/database.types";
import { getDayAvailability, type DayAvailability, type GetAvailableSlotsInput } from "./slots";
import { type DateKey, shiftDateKey, zonedDayMinutesToUtc } from "./time";

type Client = SupabaseClient<Database>;

export interface AvailabilitySources {
  hours: GetAvailableSlotsInput["hours"];
  breaks: NonNullable<GetAvailableSlotsInput["breaks"]>;
  overrides: Record<DateKey, { is_closed: boolean; open_time: string | null; close_time: string | null }>;
  busy: { starts_at: string; ends_at: string }[];
}

/**
 * Loads everything the pure engine needs for a date range in one pass, so a
 * month of calendar days costs four queries rather than four per day.
 *
 * `ignoreBookingId` lets the reschedule path ask "would this slot be free if
 * the booking being moved were not in the way?".
 */
export async function loadAvailabilitySources(
  supabase: Client,
  business: Pick<BusinessRow, "id" | "timezone">,
  fromDate: DateKey,
  toDate: DateKey,
  options: { ignoreBookingId?: string } = {},
): Promise<AvailabilitySources> {
  // Widen by a day on each side: a booking can start before local midnight and
  // still occupy the first minutes of the day being asked about.
  const windowStart = zonedDayMinutesToUtc(shiftDateKey(fromDate, -1), 0, business.timezone);
  const windowEnd = zonedDayMinutesToUtc(shiftDateKey(toDate, 2), 0, business.timezone);

  const [hoursResult, breaksResult, overridesResult, bookingsResult] = await Promise.all([
    supabase
      .from("business_hours")
      .select("weekday, open_time, close_time, is_closed")
      .eq("business_id", business.id),
    supabase
      .from("business_breaks")
      .select("weekday, start_time, end_time")
      .eq("business_id", business.id),
    supabase
      .from("availability_overrides")
      .select("date, is_closed, open_time, close_time")
      .eq("business_id", business.id)
      .gte("date", fromDate)
      .lte("date", toDate),
    // Not a `from("bookings")` select: RLS hides other customers' rows, which
    // would make a busy day look wide open. `busy_intervals` is a SECURITY
    // DEFINER function returning nothing but anonymous start/end pairs.
    supabase.rpc("busy_intervals", {
      target_business: business.id,
      from_ts: windowStart.toISOString(),
      to_ts: windowEnd.toISOString(),
      exclude_booking: options.ignoreBookingId ?? null,
    }),
  ]);

  const overrides: AvailabilitySources["overrides"] = {};
  for (const row of overridesResult.data ?? []) {
    overrides[row.date] = {
      is_closed: row.is_closed,
      open_time: row.open_time,
      close_time: row.close_time,
    };
  }

  const busy = (bookingsResult.data ?? []).map((row) => ({
    starts_at: row.starts_at,
    ends_at: row.ends_at,
  }));

  return {
    hours: hoursResult.data ?? [],
    breaks: breaksResult.data ?? [],
    overrides,
    busy,
  };
}

export function buildSlotInput(
  business: Pick<
    BusinessRow,
    "timezone" | "slot_interval_min" | "min_notice_min" | "max_advance_days"
  >,
  service: Pick<ServiceRow, "duration_min" | "buffer_min">,
  sources: AvailabilitySources,
  date: DateKey,
  now?: Date,
): GetAvailableSlotsInput {
  return {
    date,
    rules: {
      timezone: business.timezone,
      slotIntervalMin: business.slot_interval_min,
      minNoticeMin: business.min_notice_min,
      maxAdvanceDays: business.max_advance_days,
    },
    serviceDurationMin: service.duration_min,
    bufferMin: service.buffer_min,
    hours: sources.hours,
    breaks: sources.breaks,
    override: sources.overrides[date] ?? null,
    busy: sources.busy,
    now,
  };
}

/** Availability for each date in an inclusive range. */
export function availabilityForRange(
  business: Pick<
    BusinessRow,
    "timezone" | "slot_interval_min" | "min_notice_min" | "max_advance_days"
  >,
  service: Pick<ServiceRow, "duration_min" | "buffer_min">,
  sources: AvailabilitySources,
  fromDate: DateKey,
  days: number,
  now?: Date,
): DayAvailability[] {
  const out: DayAvailability[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = shiftDateKey(fromDate, i);
    out.push(getDayAvailability(buildSlotInput(business, service, sources, date, now)));
  }
  return out;
}
