/**
 * Pure staff-eligibility logic for multi-staff booking (roadmap.md §1 row 4).
 *
 * Deliberately has no `server-only` import and no Supabase dependency — same
 * reasoning as `slots.ts` being split from `availability.ts`: anything that
 * doesn't need I/O lives here so it stays trivially unit-testable (QA report
 * #4 §2: this logic previously had no automated coverage at all, at any
 * level). `availability.ts` re-exports everything here so existing imports
 * from `@/lib/booking/availability` keep working unchanged.
 */

import type { StaffRow } from "@/lib/database.types";
import type { DateKey } from "./time";
import { weekdayOf } from "./time";

export interface StaffWithServices extends StaffRow {
  /** service ids this staff member performs. Empty = every active service. */
  serviceIds: string[];
}

/** No rows in `staff_services` for a staff member means "performs everything". */
export function staffCanPerform(
  staff: Pick<StaffWithServices, "serviceIds">,
  serviceId: string,
): boolean {
  return staff.serviceIds.length === 0 || staff.serviceIds.includes(serviceId);
}

export function staffWorksWeekday(staff: Pick<StaffRow, "works_weekdays">, date: DateKey): boolean {
  return staff.works_weekdays.includes(weekdayOf(date));
}

/**
 * The staff a customer can actually choose for one service on one date: active,
 * able to perform the service, and rostered to work that weekday. This is the
 * list the "choose your barber, or any available" step is built from — and if
 * it comes back empty, the booking flow falls back to the pre-multi-staff,
 * business-wide path (no staff step shown at all), which is also exactly what
 * happens for any shop that hasn't added staff yet.
 */
export function bookableStaffFor(
  staff: StaffWithServices[],
  serviceId: string,
  date: DateKey,
): StaffWithServices[] {
  return staff.filter(
    (s) => s.is_active && staffCanPerform(s, serviceId) && staffWorksWeekday(s, date),
  );
}

export type StaffSelection =
  | { ok: true; candidateIds: (string | null)[]; isNamedChoice: boolean }
  | { ok: false; reason: "no_staff_available" | "staff_unavailable" };

/**
 * Turns "every staff row at this business" plus what the customer asked for
 * into the ordered list of staff ids `createBookingAction` should actually
 * try, in one of three shapes:
 *   - the business has no staff configured at all: a single `null` candidate
 *     (book business-wide, exactly as before this feature existed).
 *   - the customer named one specific, eligible barber: that one candidate
 *     only (`isNamedChoice: true` — a race on this candidate is reported as
 *     "that barber became unavailable," not the generic "slot taken").
 *   - "any available" (or no choice, once staff exist): every eligible
 *     barber, in order, so a race on one moves on to the next.
 *
 * Pure and synchronous on purpose: it makes no DB calls itself (the caller
 * already loaded `allStaff`), which is what makes it unit-testable without a
 * Supabase client at all (QA report #4 §2).
 */
export function resolveStaffCandidates(
  allStaff: StaffWithServices[],
  serviceId: string,
  date: DateKey,
  requestedStaffId: string | null | undefined,
): StaffSelection {
  if (allStaff.length === 0) {
    return { ok: true, candidateIds: [null], isNamedChoice: false };
  }

  const bookable = bookableStaffFor(allStaff, serviceId, date);
  if (bookable.length === 0) {
    return { ok: false, reason: "no_staff_available" };
  }

  if (requestedStaffId && requestedStaffId !== "any") {
    if (!bookable.some((s) => s.id === requestedStaffId)) {
      return { ok: false, reason: "staff_unavailable" };
    }
    return { ok: true, candidateIds: [requestedStaffId], isNamedChoice: true };
  }

  return { ok: true, candidateIds: bookable.map((s) => s.id), isNamedChoice: false };
}
