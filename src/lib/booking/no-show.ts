import type { BookingStatus } from "@/lib/database.types";

/**
 * Whether the owner may mark this booking as a no-show.
 *
 * Two rules, enforced in the app here and again by the database trigger
 * `bookings_guard_no_show` (20261026000000_beta_ops.sql):
 *  - only a live booking (pending or confirmed), and
 *  - only once its start time has been reached, so a mis-tap on tomorrow's
 *    appointment cannot corrupt the beta's no-show numbers.
 */
export function canMarkNoShow(
  booking: { status: BookingStatus; starts_at: string },
  now: Date = new Date(),
): boolean {
  if (booking.status !== "pending" && booking.status !== "confirmed") return false;
  return new Date(booking.starts_at).getTime() <= now.getTime();
}
