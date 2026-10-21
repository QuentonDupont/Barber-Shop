"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession, requireBusiness, requireSession } from "@/lib/auth";
import { buildSlotInput, loadAvailabilitySources } from "@/lib/booking/availability";
import { findSlot, getDayAvailability } from "@/lib/booking/slots";
import { toDateKey } from "@/lib/booking/time";
import { notifyBookingCancelled, notifyBookingCreated } from "@/lib/notifications";
import { errorState, successState, type ActionState } from "./types";
import { businessPath } from "@/lib/routes";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

const createSchema = z.object({
  businessId: z.uuid(),
  serviceId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
  notes: z.string().trim().max(400).optional().or(z.literal("")),
});

/**
 * The one place a booking comes into existence.
 *
 * The start time posted by the client is never trusted: the day is recomputed
 * from the business's own hours, breaks, overrides and existing bookings, and
 * the request is only accepted if the requested instant is genuinely on offer.
 * The database's exclusion constraint then catches the last race — two people
 * tapping the same slot in the same second.
 */
export async function createBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createSchema.safeParse({
    businessId: formData.get("businessId"),
    serviceId: formData.get("serviceId"),
    startsAt: formData.get("startsAt"),
    notes: formData.get("notes"),
  });

  const locale = await getLocale();

  if (!parsed.success) {
    return errorState(t(locale, "toast.incompleteBooking"));
  }

  const session = await getSession();
  if (!session) {
    return errorState(t(locale, "toast.signInToFinish"));
  }
  if (session.profile.role !== "customer") {
    return errorState(t(locale, "toast.businessCannotBook"));
  }

  const supabase = await createClient();
  const { businessId, serviceId, startsAt, notes } = parsed.data;

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .eq("is_published", true)
    .maybeSingle();

  if (!business) {
    return errorState(t(locale, "toast.businessNotTakingBookings"));
  }

  const { data: service } = await supabase
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .eq("business_id", businessId)
    .eq("is_active", true)
    .maybeSingle();

  if (!service) {
    return errorState(t(locale, "toast.serviceUnavailable"));
  }

  const date = toDateKey(new Date(startsAt), business.timezone);
  const sources = await loadAvailabilitySources(supabase, business, date, date);
  const slot = findSlot(buildSlotInput(business, service, sources, date), startsAt);

  if (!slot) {
    return errorState(t(locale, "toast.slotTaken"));
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      business_id: businessId,
      service_id: serviceId,
      customer_id: session.userId,
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      status: business.auto_confirm ? "confirmed" : "pending",
      notes: notes || null,
      service_name: service.name,
      price: service.price,
      currency: service.currency,
      customer_name: session.profile.full_name || session.email || "Customer",
      customer_phone: session.profile.phone,
    })
    .select("*")
    .single();

  if (error) {
    // 23P01 is the exclusion-constraint violation: someone else won the race.
    if (error.code === "23P01") {
      return errorState(t(locale, "toast.slotTaken"));
    }
    return errorState(error.message);
  }

  await notifyBookingCreated(booking, business);

  revalidatePath("/app/bookings");
  revalidatePath(businessPath(business.slug));
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");

  return successState(
    t(locale, business.auto_confirm ? "toast.bookedAutoConfirm" : "toast.bookedManualConfirm"),
  );
}

/** Either side may cancel. RLS decides which rows are reachable at all. */
export async function cancelBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = await getLocale();
  const id = String(formData.get("id") ?? "");
  if (!id) return errorState(t(locale, "toast.bookingGone"));

  const session = await requireSession();
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, businesses(name, slug, timezone, phone)")
    .eq("id", id)
    .maybeSingle();

  if (!booking) return errorState(t(locale, "toast.bookingGone"));
  if (booking.status === "cancelled") return successState(t(locale, "toast.alreadyCancelled"));
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return errorState(t(locale, "toast.cannotCancel"));
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: session.userId,
    })
    .eq("id", id);

  if (error) return errorState(error.message);

  await notifyBookingCancelled(booking, booking.businesses);

  revalidatePath("/app/bookings");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  return successState(t(locale, "toast.cancelled"));
}

const statusSchema = z.enum(["confirmed", "cancelled", "completed", "no_show"]);

/** Owner-side status changes from the calendar. */
export async function updateBookingStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const parsedStatus = statusSchema.safeParse(formData.get("status"));

  if (!id || !parsedStatus.success) {
    return errorState("That update could not be applied.");
  }

  const ctx = await requireBusiness();
  const supabase = await createClient();
  const status = parsedStatus.data;

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .eq("business_id", ctx.business.id)
    .maybeSingle();

  if (!booking) return errorState("That booking no longer exists.");

  const { error } = await supabase
    .from("bookings")
    .update({
      status,
      ...(status === "cancelled"
        ? { cancelled_at: new Date().toISOString(), cancelled_by: ctx.userId }
        : { cancelled_at: null, cancelled_by: null }),
    })
    .eq("id", id)
    .eq("business_id", ctx.business.id);

  if (error) {
    if (error.code === "23P01") {
      return errorState(
        "Confirming this would clash with another booking at the same time.",
      );
    }
    return errorState(error.message);
  }

  if (status === "cancelled") {
    await notifyBookingCancelled(booking, ctx.business);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/app/bookings");

  const labels: Record<typeof status, string> = {
    confirmed: "Booking confirmed.",
    cancelled: "Booking cancelled.",
    completed: "Marked as completed.",
    no_show: "Marked as a no-show.",
  };
  return successState(labels[status]);
}

const rescheduleSchema = z.object({
  id: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
});

/**
 * Owner-side reschedule (drag on the calendar, or the edit sheet).
 *
 * Re-validates against availability exactly like a fresh booking, with the
 * booking being moved excluded from the busy set so it does not block itself.
 */
export async function rescheduleBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rescheduleSchema.safeParse({
    id: formData.get("id"),
    startsAt: formData.get("startsAt"),
  });

  if (!parsed.success) return errorState("That new time could not be read.");

  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", parsed.data.id)
    .eq("business_id", ctx.business.id)
    .maybeSingle();

  if (!booking) return errorState("That booking no longer exists.");
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return errorState("Only a live booking can be moved.");
  }

  const { data: service } = await supabase
    .from("services")
    .select("*")
    .eq("id", booking.service_id)
    .maybeSingle();

  if (!service) return errorState("The service for this booking no longer exists.");

  const date = toDateKey(new Date(parsed.data.startsAt), ctx.business.timezone);
  const sources = await loadAvailabilitySources(supabase, ctx.business, date, date, {
    ignoreBookingId: booking.id,
  });

  // The owner may move a booking closer than the public notice window allows —
  // that rule exists to protect them, not to constrain them.
  const input = buildSlotInput(ctx.business, service, sources, date);
  const slot = findSlot({ ...input, rules: { ...input.rules, minNoticeMin: 0 } }, parsed.data.startsAt);

  if (!slot) {
    return errorState(
      "That time is outside opening hours, inside a break, or already booked.",
    );
  }

  const { error } = await supabase
    .from("bookings")
    .update({ starts_at: slot.startsAt, ends_at: slot.endsAt })
    .eq("id", booking.id)
    .eq("business_id", ctx.business.id);

  if (error) {
    if (error.code === "23P01") {
      return errorState("Another booking already occupies that time.");
    }
    return errorState(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/app/bookings");
  return successState("Booking moved.");
}

/* -------------------------------------------------------------------------- */
/* Reschedule support                                                          */
/* -------------------------------------------------------------------------- */

export interface MoveOption {
  startsAt: string;
  label: string;
}

export type MoveOptionsResult =
  | { status: "ok"; isOpen: boolean; slots: MoveOption[]; current: string }
  | { status: "error"; message: string };

/**
 * Bookable start times for moving one booking onto `date`.
 *
 * Called imperatively from the move sheet as the owner flicks between days.
 * The booking being moved is excluded from the busy set — otherwise it would
 * block its own current slot — and the public notice window is waived, since
 * that rule protects the owner from customers, not from themselves.
 */
export async function getMoveOptionsAction(
  bookingId: string,
  date: string,
): Promise<MoveOptionsResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: "error", message: "That date could not be read." };
  }

  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, service_id, starts_at, status")
    .eq("id", bookingId)
    .eq("business_id", ctx.business.id)
    .maybeSingle();

  if (!booking) return { status: "error", message: "That booking no longer exists." };

  const { data: service } = await supabase
    .from("services")
    .select("duration_min, buffer_min")
    .eq("id", booking.service_id)
    .maybeSingle();

  if (!service) return { status: "error", message: "The service for this booking no longer exists." };

  const sources = await loadAvailabilitySources(supabase, ctx.business, date, date, {
    ignoreBookingId: booking.id,
  });

  const input = buildSlotInput(ctx.business, service, sources, date);
  const day = getDayAvailability({
    ...input,
    rules: { ...input.rules, minNoticeMin: 0 },
  });

  return {
    status: "ok",
    isOpen: day.isOpen,
    current: booking.starts_at,
    slots: day.slots.map((slot) => ({ startsAt: slot.startsAt, label: slot.label })),
  };
}
