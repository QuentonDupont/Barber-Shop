import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, BusinessRow, ServiceRow } from "@/lib/database.types";
import { getDayAvailability, type DayAvailability, type GetAvailableSlotsInput } from "./slots";
import { type DateKey, shiftDateKey, zonedDayMinutesToUtc } from "./time";
import type { StaffWithServices } from "./staff-eligibility";

// Re-exported so existing imports from "@/lib/booking/availability" (the
// customer- and owner-side streams both import staff helpers from here) keep
// working unchanged — the logic itself moved to staff-eligibility.ts so it
// has no `server-only`/Supabase dependency and can be unit-tested directly
// (QA report #4 §2).
export {
  bookableStaffFor,
  staffCanPerform,
  staffWorksWeekday,
  resolveStaffCandidates,
  type StaffWithServices,
  type StaffSelection,
} from "./staff-eligibility";

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
 *
 * `staffId` narrows the busy set to one staff member's own bookings — pass it
 * to compute a specific barber's availability instead of the whole
 * business's. Leave it unset for the pre-multi-staff behaviour (and for
 * businesses that have no staff configured at all, which keep booking exactly
 * as they did before this feature existed).
 */
export async function loadAvailabilitySources(
  supabase: Client,
  business: Pick<BusinessRow, "id" | "timezone">,
  fromDate: DateKey,
  toDate: DateKey,
  options: { ignoreBookingId?: string; staffId?: string } = {},
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
      target_staff: options.staffId ?? null,
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

/* -------------------------------------------------------------------------- */
/* Multi-staff (roadmap.md §1 row 4)                                          */
/* -------------------------------------------------------------------------- */

/**
 * Every staff row for a business, each annotated with the services it's
 * narrowed to (if any). One extra query, always run together so the "no
 * staff_services rows = performs everything" default only has to be applied
 * in one place (`staffCanPerform` below).
 */
export async function loadStaffWithServices(
  supabase: Client,
  businessId: string,
): Promise<StaffWithServices[]> {
  const { data: staffRows } = await supabase
    .from("staff")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  const rows = staffRows ?? [];
  if (rows.length === 0) return [];

  const { data: links } = await supabase
    .from("staff_services")
    .select("staff_id, service_id")
    .in(
      "staff_id",
      rows.map((s) => s.id),
    );

  const byStaff = new Map<string, string[]>();
  for (const link of links ?? []) {
    const list = byStaff.get(link.staff_id) ?? [];
    list.push(link.service_id);
    byStaff.set(link.staff_id, list);
  }

  return rows.map((s) => ({ ...s, serviceIds: byStaff.get(s.id) ?? [] }));
}
