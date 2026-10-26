"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession, requireBusiness, requireSession } from "@/lib/auth";
import {
  buildSlotInput,
  loadAvailabilitySources,
  loadStaffWithServices,
  resolveStaffCandidates,
} from "@/lib/booking/availability";
import { findSlot, getDayAvailability } from "@/lib/booking/slots";
import { toDateKey } from "@/lib/booking/time";
import { canMarkNoShow } from "@/lib/booking/no-show";
import { notifyBookingCancelled, notifyBookingCreated } from "@/lib/notifications";
import { errorState, successState, type ActionState } from "./types";
import type { BookingRow } from "@/lib/database.types";
import { businessPath } from "@/lib/routes";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { hasCurrentConsent } from "@/lib/privacy/retention";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy/policy";

const createSchema = z.object({
  businessId: z.uuid(),
  serviceId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
  notes: z.string().trim().max(400).optional().or(z.literal("")),
  // "" or "any" (or simply omitted) both mean "any available barber" — the
  // staff-choice step only ever posts a concrete uuid when the customer named
  // one explicitly.
  staffId: z.uuid().optional().or(z.literal("any")).or(z.literal("")),
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
    staffId: formData.get("staffId") ?? "",
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
  const { businessId, serviceId, startsAt, notes, staffId: requestedStaffId } = parsed.data;

  // PDPA item 15 (QA report #7 §5 fix): gated on the project's own
  // hasCurrentConsent helper, not a narrower inline check — this is the one
  // place a booking comes into existence, so it is the one place this is
  // checked, and it must catch all three "not currently consented" cases,
  // not just withdrawal:
  //  - withdrawn (the original, narrower check already caught this)
  //  - no consent record at all — reachable because signUpAction's own
  //    consent insert is deliberately best-effort (a transient DB failure
  //    shouldn't strand someone on a dead-end sign-up page); this gate is
  //    the actual backstop that makes that best-effort choice safe, by
  //    blocking booking (not account use) until they do consent
  //  - consented, never withdrawn, but under a since-superseded policy
  //    version (dormant today — only one version exists yet — but a
  //    certainty the moment PRIVACY_POLICY_VERSION is next bumped)
  // See src/lib/actions/privacy.ts for the withdraw/reconsent actions
  // themselves, and src/lib/privacy/retention.ts for hasCurrentConsent's
  // own unit tests covering exactly these three cases.
  const { data: latestConsentRow } = await supabase
    .from("consent_records")
    .select("policy_version, withdrawn_at")
    .eq("user_id", session.userId)
    .order("consented_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const consent = latestConsentRow
    ? {
        policyVersion: latestConsentRow.policy_version,
        withdrawnAt: latestConsentRow.withdrawn_at ? new Date(latestConsentRow.withdrawn_at) : null,
      }
    : null;

  if (!hasCurrentConsent(consent, PRIVACY_POLICY_VERSION)) {
    const messageKey = !consent
      ? "privacy.bookingBlockedNeverConsented"
      : consent.withdrawnAt
        ? "privacy.bookingBlockedConsentWithdrawn"
        : "privacy.bookingBlockedPolicyUpdated";
    // `consentBlocked: true` lets the UI (ConfirmSheet in booking-flow.tsx)
    // offer a direct way to act on this from the blocked state itself,
    // instead of just naming the account page in prose (QA report #7 §5).
    return { status: "error", message: t(locale, messageKey), consentBlocked: true };
  }

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

  // Staff is resolved in one of three shapes:
  //   - the business has no staff configured at all: book business-wide,
  //     staff_id stays null, exactly as before this feature existed.
  //   - the customer named a specific staff member: that one candidate only —
  //     a race there is a real "sorry, taken" rather than something to paper
  //     over by silently handing the booking to someone else.
  //   - "any available" (or no choice at all, once staff exist): every
  //     eligible staff member is a candidate, tried in order, so a last-second
  //     race just moves on to the next available barber instead of failing.
  const allStaff = await loadStaffWithServices(supabase, businessId);

  // Pure decision, unit-tested on its own (QA report #4 §2) — see
  // `resolveStaffCandidates` in `src/lib/booking/staff-eligibility.ts` for
  // the three shapes this can come back in.
  const selection = resolveStaffCandidates(allStaff, serviceId, date, requestedStaffId);
  if (!selection.ok) {
    return errorState(
      t(locale, selection.reason === "no_staff_available" ? "toast.noStaffAvailable" : "toast.staffUnavailable"),
    );
  }
  const { candidateIds, isNamedChoice } = selection;

  // Name lookup for the candidate being tried, denormalised onto the booking
  // row (same pattern as `service_name`/`customer_name`) so My bookings and
  // the owner's calendar still read correctly even if this staff member is
  // later renamed or deactivated.
  const staffNameById = new Map(allStaff.map((s) => [s.id, s.name]));

  let booking: BookingRow | null = null;
  let lastError: { code?: string; message: string } | null = null;

  for (const candidateStaffId of candidateIds) {
    const sources = await loadAvailabilitySources(supabase, business, date, date, {
      staffId: candidateStaffId ?? undefined,
    });
    const slot = findSlot(buildSlotInput(business, service, sources, date), startsAt);
    if (!slot) continue;

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        business_id: businessId,
        service_id: serviceId,
        customer_id: session.userId,
        staff_id: candidateStaffId,
        staff_name: candidateStaffId ? staffNameById.get(candidateStaffId) ?? null : null,
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

    if (!error) {
      booking = data;
      break;
    }

    lastError = error;
    // 23P01 is the exclusion-constraint violation: someone else won the race
    // for this candidate. If more candidates remain ("any available"), try
    // the next one; otherwise this falls through to the error below.
    if (error.code !== "23P01") break;
  }

  if (!booking) {
    if (lastError && lastError.code !== "23P01") {
      return errorState(lastError.message);
    }
    // A named barber's only candidate lost a last-instant race (the DB's
    // exclusion constraint caught what the earlier, slightly-stale
    // availability read didn't) — that specific barber is who became
    // unavailable, not "some slot, somewhere." "Any available" still falls
    // through to the generic message below, since there it genuinely means
    // every eligible candidate was tried and none were free.
    if (isNamedChoice && lastError?.code === "23P01") {
      return errorState(t(locale, "toast.staffUnavailable"));
    }
    return errorState(t(locale, "toast.slotTaken"));
  }

  await notifyBookingCreated(booking, business);

  revalidatePath("/app/bookings");
  revalidatePath(businessPath(business.slug));
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");

  // Only surface the assigned name when the customer didn't name one
  // themselves ("any available") — a named choice already knows who it
  // asked for, so repeating it back adds nothing.
  const wasAnyAvailable = allStaff.length > 0 && (!requestedStaffId || requestedStaffId === "any");
  if (wasAnyAvailable && booking.staff_name) {
    return successState(
      t(
        locale,
        business.auto_confirm ? "toast.bookedAutoConfirmWithStaff" : "toast.bookedManualConfirmWithStaff",
        { name: booking.staff_name },
      ),
      { assignedStaffId: booking.staff_id ?? undefined, assignedStaffName: booking.staff_name },
    );
  }

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
  const locale = await getLocale();

  if (!id || !parsedStatus.success) {
    return errorState(t(locale, "bookingAdmin.errorUpdateFailed"));
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

  if (!booking) return errorState(t(locale, "toast.bookingGone"));

  // Beta ops: no-shows feed the kill/pivot gate numbers, so only a live
  // booking whose time has come can become one (the database trigger
  // `bookings_guard_no_show` enforces the same rule underneath).
  if (status === "no_show" && !canMarkNoShow(booking)) {
    return errorState(t(locale, "bookingAdmin.errorNoShowTooEarly"));
  }

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
      return errorState(t(locale, "bookingAdmin.errorConfirmClash"));
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
    confirmed: t(locale, "bookingAdmin.statusConfirmed"),
    cancelled: t(locale, "toast.cancelled"),
    completed: t(locale, "bookingAdmin.statusCompleted"),
    no_show: t(locale, "bookingAdmin.statusNoShow"),
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
  const locale = await getLocale();

  if (!parsed.success) return errorState(t(locale, "bookingAdmin.errorTimeUnreadable"));

  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", parsed.data.id)
    .eq("business_id", ctx.business.id)
    .maybeSingle();

  if (!booking) return errorState(t(locale, "toast.bookingGone"));
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return errorState(t(locale, "bookingAdmin.errorOnlyLiveCanMove"));
  }

  const { data: service } = await supabase
    .from("services")
    .select("*")
    .eq("id", booking.service_id)
    .maybeSingle();

  if (!service) return errorState(t(locale, "bookingAdmin.errorServiceGone"));

  const date = toDateKey(new Date(parsed.data.startsAt), ctx.business.timezone);
  const sources = await loadAvailabilitySources(supabase, ctx.business, date, date, {
    ignoreBookingId: booking.id,
    // A booking with no staff assigned (business-wide path) checks against
    // the whole business, same as before. One with staff_id set only needs
    // to avoid that one staff member's own other bookings.
    staffId: booking.staff_id ?? undefined,
  });

  // The owner may move a booking closer than the public notice window allows —
  // that rule exists to protect them, not to constrain them.
  const input = buildSlotInput(ctx.business, service, sources, date);
  const slot = findSlot({ ...input, rules: { ...input.rules, minNoticeMin: 0 } }, parsed.data.startsAt);

  if (!slot) {
    return errorState(t(locale, "bookingAdmin.errorSlotUnavailable"));
  }

  const { error } = await supabase
    .from("bookings")
    .update({ starts_at: slot.startsAt, ends_at: slot.endsAt })
    .eq("id", booking.id)
    .eq("business_id", ctx.business.id);

  if (error) {
    if (error.code === "23P01") {
      return errorState(t(locale, "bookingAdmin.errorSlotClash"));
    }
    return errorState(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/app/bookings");
  return successState(t(locale, "common.bookingMoved"));
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
  const locale = await getLocale();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: "error", message: t(locale, "bookingAdmin.errorDateUnreadable") };
  }

  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, service_id, starts_at, status, staff_id")
    .eq("id", bookingId)
    .eq("business_id", ctx.business.id)
    .maybeSingle();

  if (!booking) return { status: "error", message: t(locale, "toast.bookingGone") };

  const { data: service } = await supabase
    .from("services")
    .select("duration_min, buffer_min")
    .eq("id", booking.service_id)
    .maybeSingle();

  if (!service) return { status: "error", message: t(locale, "bookingAdmin.errorServiceGone") };

  const sources = await loadAvailabilitySources(supabase, ctx.business, date, date, {
    ignoreBookingId: booking.id,
    staffId: booking.staff_id ?? undefined,
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
